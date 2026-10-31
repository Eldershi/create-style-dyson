// Contract test using hostile event/lifecycle sequences, not a game simulation.
const fs = require('node:fs')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const source = fs.readFileSync(__dirname + '/../src/runtime/frustum-fallback.js', 'utf8')
for (const mapping of ['mojang', 'srg']) {
  const named = (object, mojang, srg, value) => { object[mapping === 'mojang' ? mojang : srg] = value }
  const identity = object => Object.assign(object, { equals(other) { return this === other } })
  const iterator = array => { let index = 0; return { hasNext: () => index < array.length, next: () => array[index++] } }
  class HashMap extends Map {
    put(key, value) { this.set(key, value) }
    remove(key) { return this.delete(key) }
    size() { return super.size }
    entrySet() { return { iterator: () => iterator(Array.from(this.entries(), ([key, value]) => ({ getKey: () => key, getValue: () => value }))) } }
  }
  class AABB { constructor(name) { this.name = name } }
  class RailBE { }
  class ReceiverBE { }
  const world = identity({}); const world2 = identity({})
  named(world, 'isClientSide', 'm_5776_', () => true)
  named(world2, 'isClientSide', 'm_5776_', () => true)
  const server = identity({}); named(server, 'isClientSide', 'm_5776_', () => false)
  const mc = {}; named(mc, 'level', 'f_91073_', world)
  const connection = {}; named(connection, 'getLevel', 'm_105147_', () => mc[mapping === 'mojang' ? 'level' : 'f_91073_'])
  named(mc, 'getConnection', 'm_91403_', () => connection)
  const MC = {}; named(MC, 'getInstance', 'm_91087_', () => mc)
  const LR = {}; named(LR, 'getLightColor', 'm_109541_', () => 1234)
  const END = identity({}); const AFTER = identity({})
  const type = { id: 'dysoncubeproject:em_railejector_controller' }
  const makeBe = (owner = world) => {
    const be = new RailBE(); be.removed = false; be.owner = owner
    const pos = {}; named(pos, 'getX', 'm_123341_', () => 10); named(pos, 'getY', 'm_123342_', () => 20); named(pos, 'getZ', 'm_123343_', () => 30)
    named(be, 'getType', 'm_58903_', () => type)
    named(be, 'getBlockPos', 'm_58899_', () => pos)
    named(be, 'getLevel', 'm_58904_', () => be.owner)
    named(be, 'isRemoved', 'm_58901_', () => be.removed)
    be.getRenderBoundingBox = () => original
    return be
  }
  const makeChunk = (bes = []) => {
    const chunk = identity({ bes }); named(chunk, 'getPos', 'm_7697_', () => '[0,0]')
    named(chunk, 'getBlockEntities', 'm_62954_', () => ({ values: () => ({ iterator: () => iterator(chunk.bes) }) }))
    return chunk
  }
  const original = new AABB('original'); const full = new AABB('full')
  const visible = new Set([full]); const frustum = {}; named(frustum, 'isVisible', 'm_113029_', bounds => visible.has(bounds))
  const cameraPos = {}; named(cameraPos, 'x', 'm_7096_', () => 11); named(cameraPos, 'y', 'm_7098_', () => 22); named(cameraPos, 'z', 'm_7094_', () => 33)
  const camera = {}; named(camera, 'getPosition', 'm_90583_', () => cameraPos)
  let depth = 0; let translations = []; let draws = 0; let fail = false
  const pose = {}; named(pose, 'pushPose', 'm_85836_', () => depth++); named(pose, 'popPose', 'm_85849_', () => depth--); named(pose, 'translate', 'm_85837_', (...xyz) => translations.push(xyz))
  const handlers = {}; const emit = (name, event) => handlers[name](event)
  const global = { DCPVisual: {
    getRenderBounds: () => full,
    drawFallback: (be, pt, gotPose, light, overlay) => { assert.equal(pt, .25); assert.equal(gotPose, pose); assert.equal(light, 1234); assert.equal(overlay, 655360); if (fail) throw Error('intentional'); draws++ }
  } }
  const classes = {
    'net.minecraft.client.Minecraft': MC, 'net.minecraft.client.multiplayer.ClientLevel': Object, 'net.minecraft.client.renderer.LevelRenderer': LR,
    'net.minecraft.world.phys.AABB': AABB, 'org.mob.dysoncubeproject.block.entity.EMRailEjectorBlockEntity': RailBE,
    'org.mob.dysoncubeproject.block.entity.RayReceiverBlockEntity': ReceiverBE,
    'net.minecraftforge.registries.ForgeRegistries': { BLOCK_ENTITY_TYPES: { getKey: type => type.id } },
    'net.minecraftforge.client.event.RenderLevelStageEvent$Stage': { AFTER_BLOCK_ENTITIES: AFTER },
    'net.minecraftforge.event.TickEvent$Phase': { END }, 'java.util.HashMap': HashMap
  }
  vm.runInNewContext(source, { Platform: { isClientEnvironment: () => true }, Java: { loadClass: name => { assert.ok(name in classes, name); return classes[name] } },
    ForgeEvents: { onEvent: (name, callback) => handlers[name.split('.').pop()] = callback }, global, console: { info() {}, error() {} } })
  const tick = () => emit('TickEvent$ClientTickEvent', { phase: END })
  const render = () => emit('RenderLevelStageEvent', { getStage: () => AFTER, getFrustum: () => frustum, getPartialTick: () => .25, getCamera: () => camera, getPoseStack: () => pose })
  const chunkEvent = (chunk, level = world) => ({ getLevel: () => level, getChunk: () => chunk })
  const be = makeBe(); const chunk = makeChunk([be])
  emit('ChunkEvent$Load', chunkEvent(chunk, server)); tick(); render(); assert.equal(draws, 0, 'server chunk ignored')
  emit('ChunkEvent$Load', chunkEvent(chunk)); tick(); render(); assert.equal(draws, 1); assert.deepEqual(translations[0], [-1, -2, -3]); assert.equal(depth, 0)
  visible.add(original); render(); assert.equal(draws, 1, 'visible native AABB never double drawn')
  visible.delete(original); visible.delete(full); render(); assert.equal(draws, 1, 'invisible full model not drawn')
  visible.add(full); be.removed = true; render(); assert.equal(draws, 1, 'removed BE rejected immediately'); be.removed = false
  const replacement = makeChunk([be]); emit('ChunkEvent$Load', chunkEvent(replacement)); emit('ChunkEvent$Unload', chunkEvent(chunk)); tick(); render(); assert.equal(draws, 2, 'late old chunk unload cannot remove replacement')
  replacement.bes = []; for (let i = 0; i < 10; i++) tick(); render(); assert.equal(draws, 2, 'live map refresh removes stale BE')
  replacement.bes = [be]; for (let i = 0; i < 10; i++) tick(); fail = true; render(); assert.equal(depth, 0, 'draw exception balances pose'); assert.equal(global.DCPFrustumFallback.stats().errors, 1); assert.equal(global.DCPFrustumFallback.stats().disabled, true); render(); assert.equal(global.DCPFrustumFallback.stats().errors, 1, 'unexpected error disables future callbacks'); fail = false
  named(mc, 'level', 'f_91073_', world2); tick(); render(); assert.equal(global.DCPFrustumFallback.stats().controllers, 0, 'world identity change clears old references even after rendering disabled')
  emit('ClientPlayerNetworkEvent$LoggingOut', {}); assert.equal(global.DCPFrustumFallback.stats().chunks, 0)
  console.log('PASS ' + mapping + ': client filtering, fallback predicate, no duplicate draw, camera translation, replacement/unload, live map refresh, removed/world/leave guards, pose exception balance')
}
