// Startup script; client only. Public Forge events, no reflection or world edits.
// Required hooks (provided by the approved-model renderer):
//   global.DCPVisual.getRenderBounds(be, partialTick) -> WORLD-SPACE AABB
//   global.DCPVisual.drawFallback(be, partialTick, cameraRelativePose, light, overlay)
// drawFallback owns its buffer and flush. This script never creates/endBatch's one.
if (Platform.isClientEnvironment()) {
  (function () {
  var $Minecraft = Java.loadClass('net.minecraft.client.Minecraft')
  var $ClientLevel = Java.loadClass('net.minecraft.client.multiplayer.ClientLevel')
  var $LevelRenderer = Java.loadClass('net.minecraft.client.renderer.LevelRenderer')
  var $AABB = Java.loadClass('net.minecraft.world.phys.AABB')
  var $RailBE = Java.loadClass('org.mob.dysoncubeproject.block.entity.EMRailEjectorBlockEntity')
  var $ReceiverBE = Java.loadClass('org.mob.dysoncubeproject.block.entity.RayReceiverBlockEntity')
  var $Registries = Java.loadClass('net.minecraftforge.registries.ForgeRegistries')
  var $Stage = Java.loadClass('net.minecraftforge.client.event.RenderLevelStageEvent$Stage')
  var $Phase = Java.loadClass('net.minecraftforge.event.TickEvent$Phase')
  var $ChunkStatus = Java.loadClass('net.minecraft.world.level.chunk.ChunkStatus')

  // Rhino exposes mapped Mojang members in a normal game, raw SRG members in an
  // unmapped context. Interface callback keys are a separate issue; none here.
  var member = (target, names) => {
    for (var name of names) {
      try {
        var value = target[name]
        if (value !== undefined) return value
      } catch (ignored) { }
    }
    throw new Error('[DCP_FRUSTUM] missing public member ' + names.join('/'))
  }
  var call = (target, names, args) => {
    var fn = member(target, names)
    return fn.apply(target, args || [])
  }
  var same = (a, b) => a != null && b != null && a.equals(b)
  var minecraft = () => call($Minecraft, ['getInstance', 'm_91087_'])
  var levelReported = false
  var clientLevel = () => {
    var connection = call(minecraft(), ['getConnection', 'm_91403_'])
    if (connection == null) return null
    var world = call(connection, ['getLevel', 'm_105147_'])
    if (world != null && !levelReported) {
      levelReported = true
      console.info('[DCP_FRUSTUM] public connection.getLevel ClientLevel=' + (world instanceof $ClientLevel) + ' world=' + String(world))
    }
    return world
  }
  // Reconcile only cached chunks within the native BER's 64-block distance.
  // Both chunk lookups and live-map iteration have independent per-tick caps.
  var RADIUS = 4, RESUMES_PER_TICK = 3, DISCOVERIES_PER_TICK = 5, ENTITIES_PER_CHUNK = 32
  var offsets = []
  for (var dz = -RADIUS; dz <= RADIUS; dz++) {
    for (var dx = -RADIUS; dx <= RADIUS; dx++) offsets.push([dx, dz])
  }
  offsets.sort((a, b) => a[0] * a[0] + a[1] * a[1] - b[0] * b[0] - b[1] * b[1])
  var chunks = {}
  var pending = []
  var level = null
  var cameraChunk = null
  var cursor = 0
  var hookReported = false
  var errorReported = false
  var disabled = false
  var counters = { refreshes: 0, draws: 0, errors: 0, scannedEntities: 0, chunkLookups: 0, scanRestarts: 0 }
  var clear = () => {
    chunks = {}
    pending = []
    level = null
    cameraChunk = null
    cursor = 0
  }
  var adopt = candidate => {
    if (!same(level, candidate)) {
      clear()
      level = candidate
    }
  }
  var keyAt = (x, z) => x + ',' + z
  var chunkKey = chunk => {
    var pos = call(chunk, ['getPos', 'm_7697_'])
    return keyAt(Number(member(pos, ['x', 'f_45578_'])), Number(member(pos, ['z', 'f_45579_'])))
  }
  var captureCamera = (x, z) => {
    if (!isFinite(x) || !isFinite(z)) throw new Error('[DCP_FRUSTUM] non-finite camera')
    var cx = Math.floor(x / 16), cz = Math.floor(z / 16)
    if (cameraChunk != null && cameraChunk[0] === cx && cameraChunk[1] === cz) return
    cameraChunk = [cx, cz]
    cursor = 0
    // At most 81 records exist. Discard distant iterators and BE references as
    // soon as the camera moves, including same-dimension teleports.
    for (var key in chunks) {
      var record = chunks[key]
      if (Math.abs(record.x - cx) > RADIUS || Math.abs(record.z - cz) > RADIUS) delete chunks[key]
    }
    pending = pending.filter(record => chunks[record.key] === record)
  }
  var controllerId = be => {
    var isRail = be instanceof $RailBE
    var isReceiver = be instanceof $ReceiverBE
    if (!isRail && !isReceiver) return null
    var type = call(be, ['getType', 'm_58903_'])
    var id = $Registries.BLOCK_ENTITY_TYPES.getKey(type)
    if (id == null) return null
    var name = String(id)
    if ((isRail && name === 'dysoncubeproject:em_railejector_controller') ||
        (isReceiver && name === 'dysoncubeproject:ray_receiver_controller')) return name
    return null
  }
  var enqueue = record => {
    if (record.queued) return
    record.queued = true
    pending.push(record)
  }
  var cachedRecord = (source, x, z) => {
    var key = keyAt(x, z)
    // ClientChunkCache with create=false returns only an already cached
    // LevelChunk or null. It never loads/generates/requests a chunk.
    var chunk = call(source, ['getChunk', 'm_7587_'], [x, z, member($ChunkStatus, ['FULL', 'f_62326_']), false])
    counters.chunkLookups++
    if (chunk == null) { delete chunks[key]; return null }
    var record = chunks[key]
    if (record == null || !same(record.chunk, chunk)) {
      record = { key: key, x: x, z: z, chunk: chunk, controllers: [], iterator: null, next: null, queued: false }
      chunks[key] = record
    }
    return record
  }
  var scan = (record, budget) => {
    var count = 0
    try {
      if (record.iterator == null) {
        record.iterator = call(record.chunk, ['getBlockEntities', 'm_62954_']).values().iterator()
        record.next = []
      }
      while (count < budget && record.iterator.hasNext()) {
        var be = record.iterator.next()
        count++; counters.scannedEntities++
        // Reject unrelated machines before any mapped Java member queries.
        if (controllerId(be) != null && !call(be, ['isRemoved', 'm_58901_']) &&
            same(call(be, ['getLevel', 'm_58904_']), level)) record.next.push(be)
      }
      if (!record.iterator.hasNext()) {
        record.controllers = record.next
        record.iterator = null
        record.next = null
        counters.refreshes++
        return count
      }
    } catch (error) {
      // HashMap iterators span ticks; late BE packets can mutate the live map.
      // Retry this one chunk on its next turn, within the same work budgets.
      if (String(error).indexOf('ConcurrentModificationException') < 0) throw error
      record.iterator = null
      record.next = null
      counters.scanRestarts++
    }
    enqueue(record)
    return count
  }
  var refresh = () => {
    if (cameraChunk == null) return
    var source = call(level, ['getChunkSource', 'm_7726_'])
    pending = pending.filter(record => chunks[record.key] === record)
    // Resume a FIFO slice, then reserve discovery work even when maps churn.
    // A single dense chunk progresses each tick instead of waiting a grid lap.
    var resumes = Math.min(RESUMES_PER_TICK, pending.length)
    for (var i = 0; i < resumes; i++) {
      var previous = pending.shift()
      previous.queued = false
      var record = cachedRecord(source, previous.x, previous.z)
      if (record != null) scan(record, ENTITIES_PER_CHUNK)
    }
    var remaining = ENTITIES_PER_CHUNK
    for (var visit = 0; visit < DISCOVERIES_PER_TICK; visit++) {
      var offset = offsets[cursor]
      cursor = (cursor + 1) % offsets.length
      var record = cachedRecord(source, cameraChunk[0] + offset[0], cameraChunk[1] + offset[1])
      if (record == null || record.queued) continue
      if (remaining > 0) remaining -= scan(record, remaining)
      else enqueue(record)
    }
    pending = pending.filter(record => chunks[record.key] === record)
  }

  var fail = error => {
    disabled = true
    clear()
    counters.errors++
    if (!errorReported) {
      errorReported = true
      console.error('[DCP_FRUSTUM] disabled after unexpected event error: ' + error)
    }
  }

  ForgeEvents.onEvent('net.minecraftforge.event.level.ChunkEvent$Load', event => {
    if (disabled) return
    var eventLevel = event.getLevel()
    if (!call(eventLevel, ['isClientSide', 'm_5776_'])) return
    var current = clientLevel()
    if (!same(eventLevel, current)) return
    adopt(current)
    var chunk = event.getChunk()
    var key = chunkKey(chunk), record = chunks[key]
    if (record != null && !same(record.chunk, chunk)) delete chunks[key]
  })
  ForgeEvents.onEvent('net.minecraftforge.event.level.ChunkEvent$Unload', event => {
    if (!same(event.getLevel(), level)) return
    var chunk = event.getChunk()
    var key = chunkKey(chunk)
    // A late unload for an older chunk object cannot remove its replacement.
    if (chunks[key] != null && same(chunks[key].chunk, chunk)) delete chunks[key]
  })
  ForgeEvents.onEvent('net.minecraftforge.event.level.LevelEvent$Unload', event => {
    if (same(event.getLevel(), level)) clear()
  })
  ForgeEvents.onEvent('net.minecraftforge.client.event.ClientPlayerNetworkEvent$LoggingOut', event => clear())
  ForgeEvents.onEvent('net.minecraftforge.event.TickEvent$ClientTickEvent', event => {
    if (!same(event.phase, $Phase.END)) return
    var current = clientLevel()
    if (current == null) { clear(); return }
    adopt(current)
    if (disabled) return
    try { refresh() } catch (error) { fail(error) }
  })

  var renderFallback = event => {
    if (!same(event.getStage(), $Stage.AFTER_BLOCK_ENTITIES)) return
    var current = clientLevel()
    if (current == null) { clear(); return }
    adopt(current)
    var cameraPos = call(event.getCamera(), ['getPosition', 'm_90583_'])
    // Vec3 fields overlap x()/y()/z() methods in Rhino. Call the methods.
    var cameraX = Number(call(cameraPos, ['x', 'm_7096_']))
    var cameraY = Number(call(cameraPos, ['y', 'm_7098_']))
    var cameraZ = Number(call(cameraPos, ['z', 'm_7094_']))
    captureCamera(cameraX, cameraZ)
    var visual = global.DCPVisual
    if (visual == null || typeof visual.getRenderBounds !== 'function' ||
        typeof visual.drawFallback !== 'function') return
    if (!hookReported) {
      hookReported = true
      console.info('[DCP_FRUSTUM] approved bounds/draw hooks ready')
    }
    var frustum = event.getFrustum()
    if (frustum == null) return
    var partial = event.getPartialTick()
    var pose = event.getPoseStack()
    for (var key in chunks) {
      var record = chunks[key]
      for (var be of record.controllers) {
        if (call(be, ['isRemoved', 'm_58901_']) ||
            !same(call(be, ['getLevel', 'm_58904_']), current)) continue
        var pos = call(be, ['getBlockPos', 'm_58899_'])
        var x = Number(call(pos, ['getX', 'm_123341_']))
        var y = Number(call(pos, ['getY', 'm_123342_']))
        var z = Number(call(pos, ['getZ', 'm_123343_']))
        // Preserve native BER default's 64-block distance from block center.
        var dx = x + 0.5 - cameraX
        var dy = y + 0.5 - cameraY
        var dz = z + 0.5 - cameraZ
        if (dx * dx + dy * dy + dz * dz >= 64 * 64) continue
        // If native AABB passes, normal dispatcher owns this machine this frame.
        if (call(frustum, ['isVisible', 'm_113029_'], [be.getRenderBoundingBox()])) continue
        var fullBounds = visual.getRenderBounds(be, partial)
        if (!(fullBounds instanceof $AABB)) {
          if (fullBounds == null) continue // Renderer may reject unformed machines.
          throw new Error('[DCP_FRUSTUM] getRenderBounds must return world-space AABB or null')
        }
        if (!call(frustum, ['isVisible', 'm_113029_'], [fullBounds])) continue
        var light = call($LevelRenderer, ['getLightColor', 'm_109541_'], [current, pos])
        call(pose, ['pushPose', 'm_85836_'])
        try {
          call(pose, ['translate', 'm_85837_'], [x - cameraX, y - cameraY, z - cameraZ])
          visual.drawFallback(be, partial, pose, light, 655360 /* OverlayTexture.NO_OVERLAY */)
          counters.draws++
          if (counters.draws === 1) console.info('[DCP_FRUSTUM] first-fallback-draw ' + controllerId(be))
        } finally {
          call(pose, ['popPose', 'm_85849_'])
        }
      }
    }
  }
  ForgeEvents.onEvent('net.minecraftforge.client.event.RenderLevelStageEvent', event => {
    if (disabled) return
    try { renderFallback(event) }
    catch (error) { fail(error) }
  })
  global.DCPFrustumFallback = {
    clear: clear,
    stats: () => {
      var count = 0, controllers = 0
      for (var key in chunks) { count++; controllers += chunks[key].controllers.length }
      return { chunks: count, controllers: controllers, refreshes: counters.refreshes,
        draws: counters.draws, errors: counters.errors, disabled: disabled,
        scannedEntities: counters.scannedEntities, chunkLookups: counters.chunkLookups,
        scanRestarts: counters.scanRestarts }
    }
  }
  console.info('[DCP_FRUSTUM] public-event tracker ready; source AABB and approved geometry unchanged')
  })()
}
