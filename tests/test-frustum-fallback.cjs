// Public-event contract tests; scan work is measured at the mocked Java boundary.
const fs = require('node:fs')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const source = fs.readFileSync(__dirname + '/../src/runtime/frustum-fallback.js', 'utf8')

function fixture(mapping) {
  const named = (object, mojang, srg, value) => { object[mapping === 'mojang' ? mojang : srg] = value }
  const identity = object => Object.assign(object, { equals(other) { return this === other } })
  const metrics = { maps: 0, visits: 0, lookups: 0, unrelatedQueries: 0 }
  const iterator = (array, count = false) => {
    let index = 0
    return { hasNext: () => index < array.length, next: () => { if (count) metrics.visits++; return array[index++] } }
  }
  class HashMap extends Map {
    put(key, value) { const old = this.get(key); this.set(key, value); return old }
    remove(key) { const old = this.get(key); this.delete(key); return old }
    size() { return super.size }
    values() { return { iterator: () => iterator(Array.from(super.values())) } }
    entrySet() { return { iterator: () => iterator(Array.from(this.entries(), ([key, value]) => ({ getKey: () => key, getValue: () => value }))) } }
  }
  class AABB { constructor(name) { this.name = name } }
  class RailBE { }
  class ReceiverBE { }
  class ConcurrentModificationException extends Error { constructor() { super('concurrent live-map update'); this.name = 'java.util.ConcurrentModificationException' } }
  const worlds = [identity({}), identity({})]
  const FULL = identity({})
  const caches = new Map(worlds.map(world => [world, new Map()]))
  for (const world of worlds) {
    named(world, 'isClientSide', 'm_5776_', () => true)
    const source = {}
    named(source, 'getChunk', 'm_7587_', (x, z, status, load) => {
      metrics.lookups++
      assert.equal(status, FULL, 'discovery requests only FULL chunks')
      assert.equal(load, false, 'discovery must never request a chunk load')
      return caches.get(world).get(x + ',' + z) || null
    })
    named(world, 'getChunkSource', 'm_7726_', () => source)
  }
  const server = identity({}); named(server, 'isClientSide', 'm_5776_', () => false)
  let current = worlds[0]
  const connection = {}; named(connection, 'getLevel', 'm_105147_', () => current)
  const mc = {}; named(mc, 'getConnection', 'm_91403_', () => current == null ? null : connection)
  const MC = {}; named(MC, 'getInstance', 'm_91087_', () => mc)
  const LR = {}; named(LR, 'getLightColor', 'm_109541_', () => 1234)
  const END = identity({}); const START = identity({}); const AFTER = identity({}); const OTHER = identity({})
  const original = new AABB('original'); const full = new AABB('full')
  const visible = new Set([full]); const frustum = {}; named(frustum, 'isVisible', 'm_113029_', bounds => visible.has(bounds))
  const xyz = [11, 22, 33]
  const position = (x, y, z) => {
    const pos = {}; named(pos, 'getX', 'm_123341_', () => x); named(pos, 'getY', 'm_123342_', () => y); named(pos, 'getZ', 'm_123343_', () => z)
    return pos
  }
  const cameraPos = {}; named(cameraPos, 'x', 'm_7096_', () => xyz[0]); named(cameraPos, 'y', 'm_7098_', () => xyz[1]); named(cameraPos, 'z', 'm_7094_', () => xyz[2])
  const camera = {}; named(camera, 'getPosition', 'm_90583_', () => cameraPos)
  const gameRenderer = {}; named(gameRenderer, 'getMainCamera', 'm_109153_', () => camera)
  named(mc, 'gameRenderer', 'f_91063_', gameRenderer)
  const makeBe = ({ owner = worlds[0], x = 10, y = 20, z = 30, receiver = false, unrelated = false } = {}) => {
    if (unrelated) {
      const be = {}
      for (const name of ['getType', 'm_58903_', 'getBlockPos', 'm_58899_', 'getLevel', 'm_58904_', 'isRemoved', 'm_58901_']) {
        Object.defineProperty(be, name, { get() { metrics.unrelatedQueries++; throw Error('unrelated BE member queried: ' + name) } })
      }
      return be
    }
    const be = receiver ? new ReceiverBE() : new RailBE()
    be.removed = false; be.owner = owner; be.pos = position(x, y, z)
    const type = { id: receiver ? 'dysoncubeproject:ray_receiver_controller' : 'dysoncubeproject:em_railejector_controller' }
    named(be, 'getType', 'm_58903_', () => type)
    named(be, 'getBlockPos', 'm_58899_', () => be.pos)
    named(be, 'getLevel', 'm_58904_', () => be.owner)
    named(be, 'isRemoved', 'm_58901_', () => be.removed)
    be.getRenderBoundingBox = () => original
    return be
  }
  const makeChunk = (bes = [], x = 0, z = 1) => {
    const chunk = identity({ bes, x, z, scans: 0 })
    const pos = { toString: () => '[' + x + ', ' + z + ']' }; named(pos, 'x', 'f_45578_', x); named(pos, 'z', 'f_45579_', z)
    named(chunk, 'getPos', 'm_7697_', () => pos)
    named(chunk, 'getBlockEntities', 'm_62954_', () => {
      metrics.maps++; chunk.scans++
      return { size: () => chunk.bes.length, values: () => ({ iterator: () => {
        const scan = iterator(chunk.bes, true)
        return { hasNext: scan.hasNext, next: () => {
          if (chunk.concurrentFailure > 0) { chunk.concurrentFailure--; throw new ConcurrentModificationException() }
          return scan.next()
        } }
      } }) }
    })
    return chunk
  }
  let depth = 0; const translations = []; const drawn = []; let failure = false
  const pose = {}; named(pose, 'pushPose', 'm_85836_', () => depth++); named(pose, 'popPose', 'm_85849_', () => depth--); named(pose, 'translate', 'm_85837_', (...values) => translations.push(values))
  const handlers = {}; const emit = (name, event) => { assert.equal(typeof handlers[name], 'function', name); return handlers[name](event) }
  const global = { DCPVisual: {
    getRenderBounds: () => full,
    drawFallback: (be, pt, gotPose, light, overlay) => {
      assert.equal(pt, .25); assert.equal(gotPose, pose); assert.equal(light, 1234); assert.equal(overlay, 655360)
      if (failure) throw Error('intentional draw failure')
      drawn.push(be)
    }
  } }
  const classes = {
    'net.minecraft.client.Minecraft': MC, 'net.minecraft.client.multiplayer.ClientLevel': Object, 'net.minecraft.client.renderer.LevelRenderer': LR,
    'net.minecraft.world.phys.AABB': AABB, 'org.mob.dysoncubeproject.block.entity.EMRailEjectorBlockEntity': RailBE,
    'org.mob.dysoncubeproject.block.entity.RayReceiverBlockEntity': ReceiverBE,
    'net.minecraftforge.registries.ForgeRegistries': { BLOCK_ENTITY_TYPES: { getKey: type => type.id } },
    'net.minecraftforge.client.event.RenderLevelStageEvent$Stage': { AFTER_BLOCK_ENTITIES: AFTER },
    'net.minecraftforge.event.TickEvent$Phase': { END }, 'java.util.HashMap': HashMap,
    'net.minecraft.world.level.chunk.ChunkStatus': { [mapping === 'mojang' ? 'FULL' : 'f_62326_']: FULL },
    'java.util.ConcurrentModificationException': ConcurrentModificationException
  }
  vm.runInNewContext(source, {
    Platform: { isClientEnvironment: () => true }, Java: { loadClass: name => { assert.ok(name in classes, name); return classes[name] } },
    ForgeEvents: { onEvent: (name, callback) => handlers[name.split('.').pop()] = callback }, global, console: { info() {}, error() {} }
  })
  const tick = (phase = END) => emit('TickEvent$ClientTickEvent', { phase })
  const render = (stage = AFTER) => emit('RenderLevelStageEvent', { getStage: () => stage, getFrustum: () => frustum, getPartialTick: () => .25, getCamera: () => camera, getPoseStack: () => pose })
  const chunkEvent = (chunk, level = worlds[0]) => ({ getLevel: () => level, getChunk: () => chunk })
  const cache = (chunk, level = worlds[0]) => { if (caches.has(level)) caches.get(level).set(chunk.x + ',' + chunk.z, chunk) }
  const load = (chunk, level = worlds[0]) => { cache(chunk, level); emit('ChunkEvent$Load', chunkEvent(chunk, level)) }
  const unload = (chunk, level = worlds[0]) => {
    const entries = caches.get(level); const key = chunk.x + ',' + chunk.z
    if (entries && entries.get(key) === chunk) entries.delete(key)
    emit('ChunkEvent$Unload', chunkEvent(chunk, level))
  }
  const step = (count = 1) => { for (let i = 0; i < count; i++) { tick(); render() } }
  return { worlds, server, makeBe, makeChunk, cache, load, unload, tick, render, step, emit, global, visible, original, full, drawn, translations, metrics, xyz,
    END, START, AFTER, OTHER, stats: () => global.DCPFrustumFallback.stats(), depth: () => depth,
    setWorld: world => { current = world }, fail: value => { failure = value } }
}

for (const mapping of ['mojang', 'srg']) {
  const f = fixture(mapping)
  const be = f.makeBe(); const chunk = f.makeChunk([be])
  f.load(chunk, f.server); f.step(20)
  assert.equal(f.drawn.length, 0, 'server chunks are ignored')
  f.load(chunk); f.step(100)
  f.drawn.length = 0; f.render()
  assert.deepEqual(f.drawn, [be], 'loaded nearby controller is eventually discovered')
  assert.deepEqual(f.translations[0], [-1, -2, -3], 'fallback uses camera-relative block translation')
  assert.equal(f.depth(), 0)
  f.drawn.length = 0; f.render(f.OTHER)
  assert.equal(f.drawn.length, 0, 'only the after-block-entities stage draws')
  f.visible.add(f.original); f.render()
  assert.equal(f.drawn.length, 0, 'native-visible controller is never drawn twice')
  f.visible.delete(f.original); f.visible.delete(f.full); f.render()
  assert.equal(f.drawn.length, 0, 'invisible approved bounds are rejected')
  f.visible.add(f.full); be.removed = true; f.render()
  assert.equal(f.drawn.length, 0, 'removed controller is rejected before the next scan')
  be.removed = false

  const replacementBe = f.makeBe({ receiver: true })
  const replacement = f.makeChunk([replacementBe])
  f.load(replacement); f.unload(chunk); f.step(100)
  f.drawn.length = 0; f.render()
  assert.deepEqual(f.drawn, [replacementBe], 'late unload of an old chunk cannot evict its replacement')
  replacement.bes = []; f.step(100); f.drawn.length = 0; f.render()
  assert.equal(f.drawn.length, 0, 'refresh removes a controller no longer present in its live map')
  replacement.bes = [replacementBe]; f.step(100); f.drawn.length = 0; f.render()
  assert.deepEqual(f.drawn, [replacementBe], 'late insertion into an already-loaded chunk is discovered')
  f.unload(replacement); f.drawn.length = 0; f.render()
  assert.equal(f.drawn.length, 0, 'unloaded chunks stop drawing immediately')

  f.load(replacement); f.step(100); f.setWorld(f.worlds[1]); f.tick(); f.render()
  assert.equal(f.stats().controllers, 0, 'dimension/world identity changes clear old controllers')
  assert.equal(f.stats().chunks, 0, 'dimension/world identity changes clear old chunks')
  f.emit('ClientPlayerNetworkEvent$LoggingOut', {})
  assert.equal(f.stats().chunks, 0, 'logout releases tracked chunks')
  f.setWorld(null); f.tick(); f.render()
  assert.equal(f.stats().controllers, 0, 'disconnected client has no retained controllers')
  console.log('PASS ' + mapping + ': discovery, predicates, camera translation, replacement/unload, late insertion/removal, world/logout guards')
}

for (const mapping of ['mojang', 'srg']) {
  const f = fixture(mapping)
  const far = []
  for (let i = 0; i < 1024; i++) {
    const chunk = f.makeChunk(Array.from({ length: 32 }, () => f.makeBe({ unrelated: true })), 1000 + i, 1)
    far.push(chunk); f.load(chunk)
  }
  assert.equal(f.metrics.maps, 0, 'a load-event storm queues discovery without reading all block-entity maps')
  const machine = f.makeBe()
  const dense = f.makeChunk(Array.from({ length: 4096 }, () => f.makeBe({ unrelated: true })).concat(machine))
  f.load(dense)
  const denseNeighbors = [[0, 2], [1, 2], [-1, 2], [0, 3], [1, 1], [-1, 1], [1, 3]].map(([x, z]) => {
    const chunk = f.makeChunk(Array.from({ length: 4096 }, () => f.makeBe({ unrelated: true })), x, z)
    f.load(chunk); return chunk
  })
  assert.equal(f.metrics.maps, 0, 'dense chunk load events also defer all scan work until a tick')
  f.render()
  let maxVisits = 0; let maxMaps = 0
  const boundedTick = () => {
    const visits = f.metrics.visits; const maps = f.metrics.maps; const lookups = f.metrics.lookups
    f.tick()
    const visitDelta = f.metrics.visits - visits; const mapDelta = f.metrics.maps - maps
    maxVisits = Math.max(maxVisits, visitDelta); maxMaps = Math.max(maxMaps, mapDelta)
    assert.ok(visitDelta <= 128, 'block-entity work per tick must stay bounded: ' + visitDelta)
    assert.ok(mapDelta <= 8, 'chunk-map work per tick must stay bounded: ' + mapDelta)
    assert.ok(f.metrics.lookups - lookups <= 8, 'no-load chunk lookups per tick must stay bounded')
    assert.ok(f.stats().chunks <= 81, 'tracker only retains the 9 by 9 camera neighborhood')
  }
  const initialVisits = f.metrics.visits
  f.tick(f.START)
  assert.equal(f.metrics.visits, initialVisits, 'START phase does no discovery work')
  for (let i = 0; i < 2000; i++) { boundedTick(); f.render() }
  assert.ok(f.drawn.includes(machine), 'dense nearby chunk is eventually completed across multiple ticks')
  assert.equal(maxVisits, 128, 'multiple dense nearby chunks exercise the complete global entity budget')
  assert.equal(f.metrics.unrelatedQueries, 0, 'unrelated block entities are rejected before any mapped member query')
  assert.ok(far.every(chunk => chunk.scans === 0), 'unrelated distant chunks never have their entity maps scanned')

  const arrival = f.makeBe({ x: 8010 })
  const arrivalChunk = f.makeChunk([arrival], 500, 1)
  f.cache(arrivalChunk)
  f.xyz[0] = 8011; f.drawn.length = 0; f.render()
  assert.equal(f.drawn.length, 0, 'teleport immediately rejects controllers outside render range')
  assert.equal(f.stats().chunks, 0, 'same-dimension teleport immediately releases all distant chunk records')
  assert.equal(f.stats().controllers, 0, 'same-dimension teleport immediately releases distant controllers')
  const oldScans = dense.scans
  const oldNeighborScans = denseNeighbors.map(chunk => chunk.scans)
  for (let i = 0; i < 100; i++) { boundedTick(); f.render() }
  assert.ok(f.drawn.includes(arrival), 'camera teleport discovers arrival chunk without a new chunk-load event')
  assert.equal(dense.scans, oldScans, 'teleport stops rescanning the previous distant base')
  assert.deepEqual(denseNeighbors.map(chunk => chunk.scans), oldNeighborScans, 'all dense previous-base iterators stop after teleport')
  assert.equal(f.metrics.unrelatedQueries, 0)
  assert.ok(far.every(chunk => chunk.scans === 0), 'teleport does not turn unrelated chunk loads into global scans')
  f.drawn.length = 0; f.render()
  assert.deepEqual(f.drawn, [arrival], 'only the arrival controller draws after teleport')
  console.log('PASS ' + mapping + ': 1,024 unrelated chunks and eight dense nearby chunks; max tick visits=' + maxVisits + ', maps=' + maxMaps)
}

for (const mapping of ['mojang', 'srg']) {
  const f = fixture(mapping)
  const be = f.makeBe(); const chunk = f.makeChunk([be])
  f.load(chunk); f.step(100)
  f.fail(true); f.render()
  assert.equal(f.depth(), 0, 'draw failure restores the pose stack')
  assert.equal(f.stats().errors, 1)
  assert.equal(f.stats().disabled, true, 'unexpected event error disables fallback')
  const visits = f.metrics.visits; const maps = f.metrics.maps
  for (let i = 0; i < 50; i++) f.load(f.makeChunk([be], 10 + i, 1))
  f.step(100)
  assert.equal(f.metrics.visits, visits, 'disabled fallback stops discovery and entity scans')
  assert.equal(f.metrics.maps, maps, 'disabled fallback stops live-map refreshes')
  assert.equal(f.stats().errors, 1, 'disabled fallback never repeatedly throws')
  f.setWorld(f.worlds[1]); f.tick(); f.render()
  assert.equal(f.stats().controllers, 0, 'world cleanup remains active after rendering is disabled')
  assert.equal(f.stats().chunks, 0)
  f.emit('ClientPlayerNetworkEvent$LoggingOut', {})
  assert.equal(f.stats().chunks, 0)
  console.log('PASS ' + mapping + ': error containment, balanced pose and disabled-scan cleanup')
}

for (const mapping of ['mojang', 'srg']) {
  const f = fixture(mapping)
  const be = f.makeBe(); const chunk = f.makeChunk([be])
  chunk.concurrentFailure = 1; f.cache(chunk)
  f.tick()
  assert.equal(f.metrics.maps, 0, 'discovery waits for a real rendered-camera snapshot')
  f.step(200)
  assert.ok(f.drawn.includes(be), 'an interrupted live-map iterator is retried and discovers its controller')
  assert.ok(f.stats().scanRestarts >= 1, 'concurrent map change is counted as a scan restart')
  assert.equal(f.stats().errors, 0, 'concurrent map change is not a fatal renderer error')
  assert.equal(f.stats().disabled, false)
  console.log('PASS ' + mapping + ': no-event recovery and concurrent live-map retry')
}

for (const mapping of ['mojang', 'srg']) {
  const negative = fixture(mapping)
  negative.xyz.splice(0, 3, -1, 20.5, -1)
  const edge = negative.makeBe({ x: -65, y: 20, z: -1 })
  negative.cache(negative.makeChunk([edge], -5, -1))
  negative.step(100); negative.drawn.length = 0; negative.render()
  assert.deepEqual(negative.drawn, [edge], 'negative camera coordinates use floor so the nearby negative edge chunk is included')

  const distance = fixture(mapping)
  const be = distance.makeBe()
  distance.cache(distance.makeChunk([be]))
  distance.xyz.splice(0, 3, 10.5, 84.5, 30.5)
  distance.step(100); distance.drawn.length = 0; distance.render()
  assert.equal(distance.drawn.length, 0, 'exactly 64 blocks from block center matches the native exclusion')
  distance.xyz[1] = 84.499; distance.render()
  assert.deepEqual(distance.drawn, [be], 'a controller just inside the native distance is drawn')
  console.log('PASS ' + mapping + ': negative chunk floor and exact 64-block distance boundary')
}

for (const mapping of ['mojang', 'srg']) {
  const dense = fixture(mapping)
  const tail = dense.makeBe()
  dense.cache(dense.makeChunk(Array.from({ length: 4096 }, () => dense.makeBe({ unrelated: true })).concat(tail)))
  dense.render()
  let tailTicks = 0
  while (!dense.drawn.includes(tail) && tailTicks < 200) { dense.step(); tailTicks++ }
  assert.ok(dense.drawn.includes(tail), 'pending dense-map scans make progress every tick and discover the 4,097th entity within 200 ticks')
  assert.equal(dense.stats().errors, 0)

  for (const obstruction of ['huge', 'continuously mutating']) {
    const f = fixture(mapping)
    const blocked = f.makeChunk(Array.from({ length: 4097 }, () => f.makeBe({ unrelated: true })), 0, 2)
    if (obstruction === 'continuously mutating') blocked.concurrentFailure = Infinity
    f.cache(blocked); f.render(); f.step(3)
    assert.ok(blocked.scans > 0, obstruction + ' map is pending before the new arrival')
    const arrival = f.makeBe({ x: 50, y: 20, z: 50 })
    f.cache(f.makeChunk([arrival], 3, 3))
    let arrivalTicks = 0
    while (!f.drawn.includes(arrival) && arrivalTicks < 20) {
      const visits = f.metrics.visits; const lookups = f.metrics.lookups
      f.step(); arrivalTicks++
      assert.ok(f.metrics.visits - visits <= 128, obstruction + ' map preserves the entity work cap')
      assert.ok(f.metrics.lookups - lookups <= 8, obstruction + ' map preserves the chunk lookup cap')
    }
    assert.ok(f.drawn.includes(arrival), obstruction + ' pending map cannot starve discovery of another nearby chunk for more than 20 ticks')
    assert.equal(f.stats().errors, 0)
    assert.equal(f.stats().disabled, false)
    if (obstruction === 'continuously mutating') assert.ok(f.stats().scanRestarts > 0)
  }
  console.log('PASS ' + mapping + ': dense-tail discovery within ' + tailTicks + ' ticks and reserved discovery under pending-map pressure')
}
