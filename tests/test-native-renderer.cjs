// Script/Java boundary contracts. Native wrapper bounds are tested in Java.
const fs = require('node:fs')
const vm = require('node:vm')
const assert = require('node:assert/strict')
const source = fs.readFileSync(__dirname + '/../src/runtime/renderer-main.js', 'utf8')
const I = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

function fixture() {
  let phase = 'startup'
  let missing = false
  let failure = null
  const metrics = { adapted: 0, wrapped: 0, baked: 0, poses: 0, modelLookups: 0, modelDraws: 0, buffers: 0 }
  const nativeDraws = []
  const runtimeEvents = []
  const modEvents = new Map()
  const initCallbacks = []
  const listeners = []
  const initProviders = new Map()
  const forgeProviders = new Map()
  const wrappers = []
  const resources = { active: true, prepared: true }
  const roots = {
    rail: { getPart: name => missing ? null : { name, kind: 'rail' } },
    receiver: { getPart: name => missing ? null : { name, kind: 'receiver' } }
  }
  class ResourceLocation {
    constructor(namespace, path) { this.namespace = namespace; this.path = path }
    toString() { return this.namespace + ':' + this.path }
  }
  class Matrix {
    set() { return this }
    invert() { return this }
    transpose() { return this }
  }
  class WeakHashMap extends Map { put(key, value) { this.set(key, value) } }
  class RailBE { getCurrentYaw() { return 0 } getCurrentPitch() { return 0 } }
  class ReceiverBE { getCurrentPitch() { return 0 } }
  class BER {
    constructor(callbacks) {
      assert.equal(phase, 'startup', 'Rhino interface adaptation must occur while startup owns the top-call')
      this.callbacks = callbacks
      metrics.adapted++
    }
    render(...args) { this.callbacks.m_6922_(...args) }
  }
  class NativeRenderer {
    render(...args) {
      nativeDraws.push({ args, depth: args[2].depth })
      if (failure === 'native') throw Error('intentional native render failure')
    }
  }
  const cutout = {}
  const nativeBridge = {
    wrap(delegate) {
      assert.equal(phase, 'startup', 'Java bridge construction must not be deferred to a reload provider')
      assert.ok(delegate instanceof BER, 'bridge receives an already adapted Java BER')
      metrics.wrapped++
      const wrapper = { render: (...args) => delegate.render(...args) }
      wrappers.push(wrapper)
      return wrapper
    },
    onModelBakingCompleted() { metrics.baked++; resources.active = resources.prepared },
    isActive: () => resources.active,
    hasPreparedResources: () => resources.prepared,
    stats: () => ({})
  }
  const mc = {
    getModelManager: () => ({ getModel(location) {
      metrics.modelLookups++
      return roots[location.namespace === 'dcp_scripted_rail' ? 'rail' : 'receiver']
    } }),
    getBlockRenderer: () => ({ getModelRenderer: () => ({ renderModel() {
      metrics.modelDraws++
      if (failure === 'model') throw Error('intentional model draw failure')
    } }) })
  }
  const LOWEST = {}; const RegisterRenderers = {}
  const classes = {
    'net.minecraft.resources.ResourceLocation': ResourceLocation,
    'net.minecraft.client.Minecraft': { getInstance: () => mc },
    'org.joml.Matrix4f': Matrix, 'org.joml.Matrix3f': Matrix,
    'net.minecraft.client.renderer.RenderType': { cutout: () => cutout },
    'java.util.WeakHashMap': WeakHashMap,
    'dev.eldershi.dysoncompat.client.ApprovedRendererBridge': nativeBridge,
    'net.minecraftforge.registries.ForgeRegistries': { BLOCK_ENTITY_TYPES: { getValue: location => ({ id: String(location) }) } },
    'org.mob.dysoncubeproject.client.tile.EMRailEjectorRender': NativeRenderer,
    'org.mob.dysoncubeproject.client.tile.RayReceiverRender': NativeRenderer,
    'net.minecraftforge.eventbus.api.EventPriority': { LOWEST },
    'net.minecraftforge.client.event.EntityRenderersEvent$RegisterRenderers': RegisterRenderers,
    'dev.architectury.registry.client.rendering.BlockEntityRendererRegistry': { register: (type, provider) => forgeProviders.set(type.id, provider) },
    'net.minecraft.client.renderer.blockentity.BlockEntityRenderer': BER,
    'org.mob.dysoncubeproject.block.entity.EMRailEjectorBlockEntity': RailBE,
    'org.mob.dysoncubeproject.block.entity.RayReceiverBlockEntity': ReceiverBE
  }
  const global = {}
  const pose = name => {
    metrics.poses++
    return [{ ref: name, part: name, instance: name, id: name, m: I(), matrix: I() }]
  }
  vm.runInNewContext(source, {
    Java: { loadClass(name) { assert.ok(name in classes, 'unexpected Java dependency: ' + name); return classes[name] } },
    ClientEvents: { init: callback => initCallbacks.push(callback) },
    ForgeEvents: { onEvent: (...args) => runtimeEvents.push(args) },
    ForgeModEvents: {
      eventBus: () => ({ addListener(priority, receiveCancelled, eventClass, callback) {
        assert.equal(priority, LOWEST); assert.equal(receiveCancelled, false); assert.equal(eventClass, RegisterRenderers)
        listeners.push(callback)
      } }),
      onEvent(name, callback) { assert.ok(!modEvents.has(name), 'one handler per model event'); modEvents.set(name, callback) }
    },
    dcpRailV17PoseFromNative: () => ({ worldAdapter: I(), parts: pose('fixed_base') }),
    DCP_RECEIVER_V6_POSE: { fromNative: () => pose('base_frame') },
    global, console: { info() {}, error() {} }
  })
  phase = 'reload'
  assert.equal(initCallbacks.length, 1)
  assert.equal(listeners.length, 1)
  initCallbacks[0]({ registerBlockEntityRenderer: (type, provider) => initProviders.set(type.id, provider) })
  listeners[0]({})
  const ids = ['dysoncubeproject:em_railejector_controller', 'dysoncubeproject:ray_receiver_controller']
  const renderers = ids.map(id => initProviders.get(id)({}))
  const makeArgs = be => {
    const stack = {
      depth: 0,
      pushPose() { this.depth++ },
      popPose() { this.depth--; assert.ok(this.depth >= 0, 'pose stack must not underflow') },
      mulPoseMatrix() { if (failure === 'matrix') throw Error('intentional matrix failure') },
      last: () => ({ normal: () => ({ mul() {} }) }),
      translate() {}
    }
    const buffers = {
      getBuffer(type) { assert.equal(type, cutout); metrics.buffers++; return {} },
      endBatch() { assert.fail('renderer must not flush the dispatcher-owned buffers') }
    }
    return [be, .25, stack, buffers, 1234, 655360]
  }
  return {
    global, metrics, nativeBridge, nativeDraws, runtimeEvents, modEvents, initProviders, forgeProviders, ids, renderers, wrappers, roots, resources,
    makeRail: () => new RailBE(), makeReceiver: () => new ReceiverBE(), makeArgs,
    setMissing: value => { missing = value }, fail: value => { failure = value }
  }
}

{
  const f = fixture()
  assert.equal(f.metrics.adapted, 2)
  assert.equal(f.metrics.wrapped, 2)
  f.ids.forEach((id, i) => {
    const initProvider = f.initProviders.get(id)
    const forgeProvider = f.forgeProviders.get(id)
    assert.equal(initProvider, forgeProvider, 'both registration routes share their prepared provider')
    for (let reload = 0; reload < 4; reload++) {
      assert.equal(initProvider({}), f.wrappers[i], 'reload returns the same Java bridge renderer')
      assert.equal(forgeProvider({}), f.wrappers[i])
    }
  })
  assert.equal(f.metrics.adapted, 2, 'reload providers perform no new interface adaptation')
  assert.equal(f.metrics.wrapped, 2)
  assert.deepEqual(f.runtimeEvents, [], 'native rendering needs no tick, chunk or render-stage discovery callback')
  assert.deepEqual([...f.modEvents.keys()].sort(), [
    'net.minecraftforge.client.event.ModelEvent$BakingCompleted',
    'net.minecraftforge.client.event.ModelEvent$RegisterAdditional'
  ])
  console.log('PASS stable pre-adapted Java BER providers and model-only lifecycle hooks')
}

{
  const f = fixture()
  const be = f.makeRail()
  const first = f.global.DCPVisual.debugModelState(be)
  assert.equal(f.global.DCPVisual.debugModelState(be).parts, first.parts, 'unchanged pose reuses prepared transforms')
  assert.equal(f.metrics.poses, 1)
  assert.equal(f.metrics.modelLookups, 1)
  const replacement = { getPart: name => ({ name, reloaded: true }) }
  f.roots.rail = replacement
  f.modEvents.get('net.minecraftforge.client.event.ModelEvent$BakingCompleted')({})
  assert.equal(f.metrics.baked, 1, 'model baking must invalidate native bridge model/bounds state too')
  const second = f.global.DCPVisual.debugModelState(be)
  assert.notEqual(second.parts, first.parts, 'model baking invalidates pose cache')
  assert.equal(second.root, replacement, 'model baking invalidates cached composite roots')
  assert.equal(f.metrics.poses, 2)
  assert.equal(f.metrics.modelLookups, 2)
  console.log('PASS model baking clears pose/root reuse and notifies the native bridge')
}

{
  const f = fixture()
  f.setMissing(true)
  for (const [index, be] of [f.makeRail(), f.makeReceiver()].entries()) {
    const args = f.makeArgs(be)
    f.renderers[index].render(...args)
    const native = f.nativeDraws[index]
    assert.deepEqual(native.args, args, 'pack-missing fallback preserves every dispatcher argument')
    assert.equal(native.depth, 0, 'pack-missing fallback applies no approved-model transforms')
    assert.equal(args[2].depth, 0)
  }
  assert.equal(f.metrics.modelDraws, 0)
  assert.equal(f.metrics.poses, 0)
  assert.equal(f.metrics.buffers, 0, 'pack-missing fallback leaves buffer ownership with the native renderer')
  assert.equal(f.global.DCPVisual.stats.errors, 0)
  console.log('PASS missing resource pack delegates both machines directly to native rendering')
}

{
  const f = fixture()
  f.resources.active = false; f.resources.prepared = false
  const registered = []
  const register = () => f.modEvents.get('net.minecraftforge.client.event.ModelEvent$RegisterAdditional')({ register: id => registered.push(String(id)) })
  register()
  assert.deepEqual(registered, [], 'absent resources must not register unresolved additional model roots')
  const machines = [f.makeRail(), f.makeReceiver()]
  machines.forEach((be, index) => {
    const args = f.makeArgs(be)
    f.renderers[index].render(...args)
    assert.deepEqual(f.nativeDraws[index].args, args, 'resources-off fallback preserves every native dispatcher argument')
    assert.equal(f.nativeDraws[index].depth, 0)
    assert.equal(args[2].depth, 0)
  })
  assert.equal(f.metrics.modelLookups, 0, 'resources-off rendering never queries ModernFix for absent model roots')
  assert.equal(f.metrics.modelDraws, 0)
  assert.equal(f.metrics.poses, 0)
  assert.equal(f.metrics.buffers, 0)

  // Prepared resource presence describes the incoming reload, even while the
  // currently active renderer still delegates to the original models.
  f.resources.prepared = true
  register()
  assert.deepEqual(registered.sort(), ['dcp_scripted_rail:block/rail_parts', 'dcp_scripted_receiver:block/receiver_parts'])
  assert.equal(f.resources.active, false)
  f.renderers[0].render(...f.makeArgs(machines[0]))
  assert.equal(f.metrics.modelLookups, 0, 'prepared resources are not queried before model baking activates them')
  f.modEvents.get('net.minecraftforge.client.event.ModelEvent$BakingCompleted')({})
  machines.forEach((be, index) => f.renderers[index].render(...f.makeArgs(be)))
  assert.equal(f.metrics.baked, 1)
  assert.equal(f.metrics.modelLookups, 2, 'completed reload resolves both newly available roots')
  assert.equal(f.metrics.modelDraws, 2, 'restored resources resume both custom machine renderers')
  const lookups = f.metrics.modelLookups
  const draws = f.metrics.modelDraws
  f.resources.prepared = false
  f.modEvents.get('net.minecraftforge.client.event.ModelEvent$BakingCompleted')({})
  machines.forEach((be, index) => f.renderers[index].render(...f.makeArgs(be)))
  assert.equal(f.metrics.modelLookups, lookups, 'disabling resources again does not reuse or query custom roots')
  assert.equal(f.metrics.modelDraws, draws)
  assert.equal(f.global.DCPVisual.stats.errors, 0)
  console.log('PASS resources-off avoids additional roots/model queries and resource reload restores native/custom selection')
}

for (const failure of [null, 'matrix', 'model', 'native']) {
  const f = fixture()
  f.fail(failure)
  const args = f.makeArgs(f.makeRail())
  f.renderers[0].render(...args)
  assert.equal(args[2].depth, 0, 'pose stack is balanced after ' + (failure || 'successful rendering'))
  assert.equal(f.global.DCPVisual.stats.errors, failure ? 1 : 0)
  if (!failure) {
    assert.equal(f.metrics.modelDraws, 1)
    assert.equal(f.nativeDraws.length, 1, 'approved models retain the native FX draw')
    assert.equal(f.metrics.buffers, 1)
  }
}
console.log('PASS custom/native draw failures are contained and restore the dispatcher pose stack')
