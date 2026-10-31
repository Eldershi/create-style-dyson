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
  var $HashMap = Java.loadClass('java.util.HashMap')

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
  var chunks = new $HashMap()
  var level = null
  var controllers = []
  var dirty = false
  var ticks = 0
  var hookReported = false
  var errorReported = false
  var disabled = false
  var counters = { refreshes: 0, draws: 0, errors: 0 }
  var clear = () => {
    chunks.clear()
    controllers = []
    level = null
    dirty = false
    ticks = 0
  }
  var adopt = candidate => {
    if (!same(level, candidate)) {
      clear()
      level = candidate
    }
  }
  var chunkKey = chunk => String(call(chunk, ['getPos', 'm_7697_']))
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
  var refresh = () => {
    var next = []
    var entries = chunks.entrySet().iterator()
    while (entries.hasNext()) {
      var entry = entries.next()
      var chunk = entry.getValue()
      // getBlockEntities is the existing live map. No getChunk or network call.
      var values = call(chunk, ['getBlockEntities', 'm_62954_']).values().iterator()
      while (values.hasNext()) {
        var be = values.next()
        if (!call(be, ['isRemoved', 'm_58901_']) &&
            same(call(be, ['getLevel', 'm_58904_']), level) && controllerId(be) != null) {
          next.push({ be: be, chunk: chunk, key: String(entry.getKey()) })
        }
      }
    }
    controllers = next
    dirty = false
    counters.refreshes++
  }

  ForgeEvents.onEvent('net.minecraftforge.event.level.ChunkEvent$Load', event => {
    var eventLevel = event.getLevel()
    if (!call(eventLevel, ['isClientSide', 'm_5776_'])) return
    var current = clientLevel()
    if (!same(eventLevel, current)) return
    adopt(current)
    var chunk = event.getChunk()
    chunks.put(chunkKey(chunk), chunk)
    dirty = true
  })
  ForgeEvents.onEvent('net.minecraftforge.event.level.ChunkEvent$Unload', event => {
    if (!same(event.getLevel(), level)) return
    var chunk = event.getChunk()
    var key = chunkKey(chunk)
    // A late unload for an older chunk object cannot remove its replacement.
    if (same(chunks.get(key), chunk)) chunks.remove(key)
    dirty = true
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
    ticks++
    if (dirty || ticks % 10 === 0) refresh()
  })

  var renderFallback = event => {
    if (!same(event.getStage(), $Stage.AFTER_BLOCK_ENTITIES)) return
    var current = clientLevel()
    if (current == null) { clear(); return }
    if (!same(current, level)) { adopt(current); return }
    if (controllers.length === 0) return
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
    var cameraPos = call(event.getCamera(), ['getPosition', 'm_90583_'])
    // Vec3 has BOTH public fields and Position x()/y()/z() methods. Rhino's
    // FieldAndMethods value coercion is ambiguous; call the public methods.
    var cameraX = Number(call(cameraPos, ['x', 'm_7096_']))
    var cameraY = Number(call(cameraPos, ['y', 'm_7098_']))
    var cameraZ = Number(call(cameraPos, ['z', 'm_7094_']))
    var pose = event.getPoseStack()
    for (var entry of controllers) {
      var be = entry.be
      if (!same(chunks.get(entry.key), entry.chunk) ||
          call(be, ['isRemoved', 'm_58901_']) ||
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
  ForgeEvents.onEvent('net.minecraftforge.client.event.RenderLevelStageEvent', event => {
    if (disabled) return
    try { renderFallback(event) }
    catch (error) {
      disabled = true
      counters.errors++
      if (!errorReported) {
        errorReported = true
        console.error('[DCP_FRUSTUM] disabled after unexpected event error: ' + error)
      }
    }
  })
  global.DCPFrustumFallback = {
    clear: clear,
    stats: () => ({ chunks: chunks.size(), controllers: controllers.length,
      refreshes: counters.refreshes, draws: counters.draws, errors: counters.errors, disabled: disabled })
  }
  console.info('[DCP_FRUSTUM] public-event tracker ready; source AABB and approved geometry unchanged')
  })()
}
