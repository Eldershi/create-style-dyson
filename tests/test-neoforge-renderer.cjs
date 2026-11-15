// Script/Java boundary contracts for the NeoForge 1.21.1 renderer.
const fs = require('node:fs')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const source = fs.readFileSync(__dirname + '/../src/runtime/renderer-main-neoforge-1.21.1.js', 'utf8')
const BOUNDS = JSON.parse(fs.readFileSync(__dirname + '/../src/compat/resources/approved-bounds.json', 'utf8'))
const I = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
const BER_METHODS = ['render', 'shouldRenderOffScreen', 'getViewDistance', 'shouldRender', 'getRenderBoundingBox']

function fixture() {
  let phase = 'startup'
  let missing = false
  let failure = null
  const metrics = { adapted: 0, poses: 0, modelLookups: 0, modelDraws: 0, buffers: 0, boxes: 0 }
  const nativeDraws = []
  const listeners = new Map()
  const resources = new Set(['dcp_scripted_rail:models/block/rail_parts.json', 'dcp_scripted_receiver:models/block/receiver_parts.json'])
  class AABB {
    constructor(minX, minY, minZ, maxX, maxY, maxZ) { Object.assign(this, { minX, minY, minZ, maxX, maxY, maxZ }); metrics.boxes++ }
    equals(o) { return ['minX', 'minY', 'minZ', 'maxX', 'maxY', 'maxZ'].every(k => this[k] === o[k]) }
  }
  AABB.INFINITE = { infinite: true }
  class Composite {
    constructor(kind) { this.kind = kind }
    getPart(name) { return missing ? null : { name, kind: this.kind } }
  }
  const roots = { rail: new Composite('rail'), receiver: new Composite('receiver') }
  const ResourceLocation = { fromNamespaceAndPath: (namespace, path) => ({ namespace, path, toString: () => namespace + ':' + path }) }
  const ModelResourceLocation = { standalone: id => ({ id, variant: 'standalone', toString: () => id + '#standalone' }) }
  class Matrix { set() { return this } }
  class WeakHashMap extends Map { put(key, value) { this.set(key, value) } }
  class Pos {
    constructor(x, y, z) { Object.assign(this, { x, y, z }) }
    getX() { return this.x } getY() { return this.y } getZ() { return this.z }
  }
  class RailBE { constructor() { this.pos = new Pos(10, 64, -3) } getCurrentYaw() { return 0 } getCurrentPitch() { return 0 } getBlockPos() { return this.pos } }
  class ReceiverBE { constructor() { this.pos = new Pos(-7, 70, 5) } getCurrentPitch() { return 0 } getBlockPos() { return this.pos } }
  const nativeBox = be => new AABB(be.pos.x - 1, be.pos.y, be.pos.z - 1, be.pos.x + 2, be.pos.y + 3, be.pos.z + 2)
  const BER = { name: 'BlockEntityRenderer' }
  // Java.cast adapts through Rhino's proxy, which calls a script function for
  // abstract and default interface methods alike.
  const cast = (type, callbacks) => {
    assert.equal(type, BER, 'renderer is adapted to the BlockEntityRenderer interface')
    assert.equal(phase, 'startup', 'Rhino interface adaptation must occur while startup owns the top-call')
    for (const name of BER_METHODS) assert.equal(typeof callbacks[name], 'function', 'renderer implements ' + name)
    metrics.adapted++
    return Object.freeze({ ...callbacks })
  }
  class NativeRenderer {
    render(...args) {
      nativeDraws.push({ args, depth: args[2].depth })
      if (failure === 'native') throw Error('intentional native render failure')
    }
    getRenderBoundingBox(be) { return nativeBox(be) }
  }
  const cutout = {}
  const mc = {
    getResourceManager: () => ({ getResource: id => ({ isPresent: () => resources.has(String(id)) }) }),
    getModelManager: () => ({ getModel(location) {
      metrics.modelLookups++
      assert.equal(location.variant, 'standalone')
      return roots[location.id.namespace === 'dcp_scripted_rail' ? 'rail' : 'receiver']
    } }),
    getBlockRenderer: () => ({ getModelRenderer: () => ({ renderModel(...args) {
      assert.equal(args.length, 9, 'vanilla renderModel overload')
      metrics.modelDraws++
      if (failure === 'model') throw Error('intentional model draw failure')
    } }) })
  }
  const Vec3 = { atCenterOf: p => ({ x: p.x + 0.5, y: p.y + 0.5, z: p.z + 0.5, closerThan(o, d) { return Math.hypot(this.x - o.x, this.y - o.y, this.z - o.z) < d } }) }
  const LOWEST = { name: 'LOWEST' }
  const events = {
    RegisterRenderers: { name: 'RegisterRenderers' },
    RegisterAdditional: { name: 'RegisterAdditional' },
    BakingCompleted: { name: 'BakingCompleted' }
  }
  const classes = {
    'net.minecraft.resources.ResourceLocation': ResourceLocation,
    'net.minecraft.client.resources.model.ModelResourceLocation': ModelResourceLocation,
    'net.minecraft.client.Minecraft': { getInstance: () => mc },
    'org.joml.Matrix4f': Matrix,
    'net.minecraft.client.renderer.RenderType': { cutout: () => cutout },
    'net.minecraft.world.phys.AABB': AABB,
    'net.minecraft.world.phys.Vec3': Vec3,
    'java.util.WeakHashMap': WeakHashMap,
    'net.minecraft.core.registries.BuiltInRegistries': { BLOCK_ENTITY_TYPE: { get: id => ({ id: String(id) }) } },
    'net.neoforged.neoforge.client.model.CompositeModel$Baked': Composite,
    'com.buuz135.dysoncubeproject.client.tile.EMRailEjectorRender': NativeRenderer,
    'com.buuz135.dysoncubeproject.client.tile.RayReceiverRender': NativeRenderer,
    'com.buuz135.dysoncubeproject.block.tile.EMRailEjectorBlockEntity': RailBE,
    'com.buuz135.dysoncubeproject.block.tile.RayReceiverBlockEntity': ReceiverBE,
    'net.neoforged.bus.api.EventPriority': { LOWEST },
    'net.neoforged.neoforge.client.event.EntityRenderersEvent$RegisterRenderers': events.RegisterRenderers,
    'net.neoforged.neoforge.client.event.ModelEvent$RegisterAdditional': events.RegisterAdditional,
    'net.neoforged.neoforge.client.event.ModelEvent$BakingCompleted': events.BakingCompleted,
    'net.minecraft.client.renderer.blockentity.BlockEntityRenderer': BER
  }
  const global = {}
  const pose = name => {
    metrics.poses++
    return [{ ref: name, part: name, instance: name, id: name, m: I(), matrix: I() }]
  }
  vm.runInNewContext(source, {
    Java: { loadClass(name) { assert.ok(name in classes, 'unexpected Java dependency: ' + name); return classes[name] }, cast },
    NativeEvents: {
      onEvent(...args) {
        const [priority, type, callback] = args.length === 3 ? args : [null, ...args]
        assert.ok(!listeners.has(type.name), 'one handler per event')
        listeners.set(type.name, { priority, callback })
      }
    },
    DCP_APPROVED_BOUNDS: BOUNDS,
    dcpRailV17PoseFromNative: () => ({ worldAdapter: I(), parts: pose('fixed_base') }),
    DCP_RECEIVER_V6_POSE: { fromNative: () => pose('base_frame') },
    global, console: { info() {}, error() {} }
  })
  phase = 'reload'
  const providers = new Map()
  const reload = () => {
    const registered = []
    listeners.get('RegisterAdditional').callback({ register: id => registered.push(String(id)) })
    listeners.get('BakingCompleted').callback({})
    return registered
  }
  listeners.get('RegisterRenderers').callback({ registerBlockEntityRenderer: (type, provider) => providers.set(type.id, provider) })
  const makeArgs = be => {
    const stack = {
      depth: 0, lifts: [],
      pushPose() { this.depth++ },
      popPose() { this.depth--; assert.ok(this.depth >= 0, 'pose stack must not underflow') },
      mulPose(m) { assert.ok(m instanceof Matrix); if (failure === 'matrix') throw Error('intentional matrix failure') },
      last: () => ({}),
      translate(x, y, z) { this.lifts.push(y) }
    }
    const buffers = {
      getBuffer(type) { assert.equal(type, cutout); metrics.buffers++; return {} },
      endBatch() { assert.fail('renderer must not flush the dispatcher-owned buffers') }
    }
    return [be, .25, stack, buffers, 1234, 655360]
  }
  const ids = ['dysoncubeproject:em_railejector_controller', 'dysoncubeproject:ray_receiver_controller']
  return {
    global, metrics, nativeDraws, listeners, providers, ids, roots, resources, reload, makeArgs, nativeBox, LOWEST,
    renderer: () => providers.get(ids[0])({}),
    makeRail: () => new RailBE(), makeReceiver: () => new ReceiverBE(),
    setMissing: value => { missing = value }, fail: value => { failure = value }
  }
}

{
  const f = fixture()
  assert.equal(f.metrics.adapted, 1)
  assert.equal(f.listeners.get('RegisterRenderers').priority, f.LOWEST, 'replace original renderers after normal-priority registration')
  assert.deepEqual([...f.providers.keys()].sort(), f.ids)
  const renderer = f.renderer()
  for (let i = 0; i < 4; i++) for (const id of f.ids) assert.equal(f.providers.get(id)({}), renderer, 'reload returns the prepared renderer')
  assert.equal(f.metrics.adapted, 1, 'reload providers perform no new interface adaptation')
  assert.equal(renderer.shouldRenderOffScreen(f.makeRail()), true)
  assert.equal(renderer.getViewDistance(), 64)
  const be = f.makeRail()
  assert.equal(renderer.shouldRender(be, { x: 10.5, y: 64.5, z: 60 }), true)
  assert.equal(renderer.shouldRender(be, { x: 10.5, y: 64.5, z: 61.6 }), false)
  console.log('PASS one prepared renderer with every BlockEntityRenderer method explicit')
}

{
  const f = fixture()
  const renderer = f.renderer()
  const rail = f.makeRail(), receiver = f.makeReceiver()
  assert.equal(renderer.getRenderBoundingBox(rail).minX, f.nativeBox(rail).minX, 'before the first bake bounds stay native')
  assert.equal(f.metrics.modelLookups, 0)
  assert.deepEqual(f.reload().sort(), ['dcp_scripted_rail:block/rail_parts#standalone', 'dcp_scripted_receiver:block/receiver_parts#standalone'])
  for (const [be, kind, lift] of [[rail, 'rail', 1.25], [receiver, 'receiver', 0]]) {
    const original = f.nativeBox(be), local = BOUNDS[kind], p = be.pos
    const box = renderer.getRenderBoundingBox(be)
    assert.equal(box.minX, Math.min(original.minX, local[0] + p.x))
    assert.equal(box.minY, Math.min(original.minY, local[1] + p.y))
    assert.equal(box.maxX, Math.max(original.maxX, local[3] + p.x))
    assert.equal(box.maxY, Math.max(original.maxY + lift, local[4] + p.y))
    assert.equal(box.maxZ, Math.max(original.maxZ, local[5] + p.z))
    assert.equal(renderer.getRenderBoundingBox(be), box, 'unchanged controller reuses its bounds')
  }
  const first = renderer.getRenderBoundingBox(rail)
  rail.pos = { x: 11, y: 64, z: -3, getX() { return this.x }, getY() { return this.y }, getZ() { return this.z } }
  assert.notEqual(renderer.getRenderBoundingBox(rail), first, 'moved controller recomputes bounds')
  const moved = renderer.getRenderBoundingBox(rail)
  f.reload()
  assert.notEqual(renderer.getRenderBoundingBox(rail), moved, 'model baking invalidates bounds')
  console.log('PASS bounds union native, lifted effects and approved envelopes with cache invalidation')
}

{
  const f = fixture()
  f.reload()
  const be = f.makeRail()
  const first = f.global.DCPVisual.debugModelState(be)
  assert.equal(f.global.DCPVisual.debugModelState(be).parts, first.parts, 'unchanged pose reuses prepared transforms')
  assert.equal(f.metrics.poses, 1)
  assert.equal(f.metrics.modelLookups, 1)
  const replacement = new (f.roots.rail.constructor)('rail')
  f.roots.rail = replacement
  f.reload()
  const second = f.global.DCPVisual.debugModelState(be)
  assert.notEqual(second.parts, first.parts, 'model baking invalidates pose cache')
  assert.equal(second.root, replacement, 'model baking invalidates cached composite roots')
  console.log('PASS model baking clears pose and root reuse')
}

{
  const f = fixture()
  f.resources.clear()
  assert.deepEqual(f.reload(), [], 'absent resources register no additional model roots')
  const renderer = f.renderer()
  for (const [index, be] of [f.makeRail(), f.makeReceiver()].entries()) {
    const args = f.makeArgs(be)
    renderer.render(...args)
    assert.deepEqual(f.nativeDraws[index].args, args, 'pack-off fallback preserves every dispatcher argument')
    assert.equal(f.nativeDraws[index].depth, 0, 'pack-off fallback applies no approved transforms')
    assert.equal(renderer.getRenderBoundingBox(be).minX, f.nativeBox(be).minX, 'pack-off keeps native bounds')
  }
  assert.equal(f.metrics.modelLookups, 0, 'pack-off never queries absent model roots')
  assert.equal(f.metrics.modelDraws + f.metrics.poses + f.metrics.buffers, 0)
  f.resources.add('dcp_scripted_rail:models/block/rail_parts.json')
  f.resources.add('dcp_scripted_receiver:models/block/receiver_parts.json')
  f.reload()
  ;[f.makeRail(), f.makeReceiver()].forEach(be => renderer.render(...f.makeArgs(be)))
  assert.equal(f.metrics.modelDraws, 2, 'restored resources resume both custom machine renderers')
  f.setMissing(true)
  f.reload()
  const args = f.makeArgs(f.makeRail())
  renderer.render(...args)
  assert.equal(f.nativeDraws.at(-1).depth, 0, 'composite without approved parts falls back to native rendering')
  assert.equal(f.global.DCPVisual.stats.errors, 0)
  console.log('PASS pack-off and incomplete roots delegate to native rendering; reload restores custom rendering')
}

for (const failure of [null, 'matrix', 'model', 'native']) {
  const f = fixture()
  f.reload()
  f.fail(failure)
  const args = f.makeArgs(f.makeRail())
  f.renderer().render(...args)
  assert.equal(args[2].depth, 0, 'pose stack is balanced after ' + (failure || 'successful rendering'))
  assert.equal(f.global.DCPVisual.stats.errors, failure ? 1 : 0)
  if (!failure) {
    assert.equal(f.metrics.modelDraws, 1)
    assert.equal(f.nativeDraws.length, 1, 'approved models retain the native FX draw')
    assert.deepEqual(args[2].lifts, [1.25], 'rail effects keep the approved lift')
    assert.equal(f.metrics.buffers, 1)
  }
}
console.log('PASS custom/native draw failures are contained and restore the dispatcher pose stack')
