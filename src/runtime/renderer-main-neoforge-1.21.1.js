// NeoForge 1.21.1 client renderer. Loaded only on the client, together with
// the approved pose functions and DCP_APPROVED_BOUNDS.
// Geometry, sprite pixels, joint locations and component roles are resources.
// This file supplies the independent draw transforms the original BER lacks.
var $DCPRL = Java.loadClass('net.minecraft.resources.ResourceLocation');
var $DCPMRL = Java.loadClass('net.minecraft.client.resources.model.ModelResourceLocation');
var $DCPMC = Java.loadClass('net.minecraft.client.Minecraft');
var $DCPM4 = Java.loadClass('org.joml.Matrix4f');
var $DCPRenderType = Java.loadClass('net.minecraft.client.renderer.RenderType');
var $DCPAABB = Java.loadClass('net.minecraft.world.phys.AABB');
var $DCPVec3 = Java.loadClass('net.minecraft.world.phys.Vec3');
var $DCPWeakMap = Java.loadClass('java.util.WeakHashMap');
var $DCPRegistries = Java.loadClass('net.minecraft.core.registries.BuiltInRegistries');
var $DCPComposite = Java.loadClass('net.neoforged.neoforge.client.model.CompositeModel$Baked');
var $DCPNativeRail = Java.loadClass('com.buuz135.dysoncubeproject.client.tile.EMRailEjectorRender');
var $DCPNativeReceiver = Java.loadClass('com.buuz135.dysoncubeproject.client.tile.RayReceiverRender');
var $DCPNativeRailBE = Java.loadClass('com.buuz135.dysoncubeproject.block.tile.EMRailEjectorBlockEntity');
var $DCPNativeReceiverBE = Java.loadClass('com.buuz135.dysoncubeproject.block.tile.RayReceiverBlockEntity');
var $DCPPriority = Java.loadClass('net.neoforged.bus.api.EventPriority');
var $DCPRegisterRenderers = Java.loadClass('net.neoforged.neoforge.client.event.EntityRenderersEvent$RegisterRenderers');
var $DCPRegisterAdditional = Java.loadClass('net.neoforged.neoforge.client.event.ModelEvent$RegisterAdditional');
var $DCPBakingCompleted = Java.loadClass('net.neoforged.neoforge.client.event.ModelEvent$BakingCompleted');
var $DCPBER = Java.loadClass('net.minecraft.client.renderer.blockentity.BlockEntityRenderer');

var DCP_MACHINES = {
  rail: {namespace:'dcp_scripted_rail', root:'rail_parts', probe:'fixed_base', type:'em_railejector_controller', lift:1.25},
  receiver: {namespace:'dcp_scripted_receiver', root:'receiver_parts', probe:'base_frame', type:'ray_receiver_controller', lift:0}
};
var DCP_VIEW_DISTANCE = 64;
var dcpCache = new $DCPWeakMap();
var dcpBoxes = new $DCPWeakMap();
var dcpEpoch = 0;
var dcpRoots = {};
var dcpFirst = {};
var dcpErrors = {};
// Resource state of the reload in progress, and of the last completed bake.
var dcpIncoming = {rail:false, receiver:false};
var dcpActive = {rail:false, receiver:false};
var dcpNative = {rail: new $DCPNativeRail(), receiver: new $DCPNativeReceiver()};
var dcpStats = {rail:0, receiver:0, errors:0};

function dcpFinite(n,label) {
  if(typeof n!=='number' || n!==n || n-n!==0) throw new Error('Non-finite approved transform '+label);
}

function dcpMultiply(a,b) {
  var out=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
  for(var c=0;c<4;c++) for(var r=0;r<4;r++) for(var k=0;k<4;k++) out[c*4+r]+=a[k*4+r]*b[c*4+k];
  return out;
}
function dcpMatrix4(m) {
  return new $DCPM4().set(m[0],m[1],m[2],m[3],m[4],m[5],m[6],m[7],m[8],m[9],m[10],m[11],m[12],m[13],m[14],m[15]);
}
function dcpKind(be) {
  return be instanceof $DCPNativeRailBE ? 'rail' : be instanceof $DCPNativeReceiverBE ? 'receiver' : null;
}
function dcpLocation(kind) {
  var machine=DCP_MACHINES[kind];
  return $DCPMRL.standalone($DCPRL.fromNamespaceAndPath(machine.namespace,'block/'+machine.root));
}

function dcpPose(be) {
  var kind=dcpKind(be);
  if (!kind) return null;
  var nativePitch=Number(be.getCurrentPitch());
  var nativeYaw=kind==='rail'?Number(be.getCurrentYaw()):0;
  dcpFinite(nativePitch,'nativePitch');dcpFinite(nativeYaw,'nativeYaw');
  var key=kind+':'+nativeYaw+':'+nativePitch+':'+dcpEpoch;
  var old=dcpCache.get(be);
  if(old!=null && old.key===key) return old;
  var parts;
  if(kind==='rail') {
    var p=dcpRailV17PoseFromNative(nativeYaw,nativePitch);
    parts=p.parts.map(function(part){return {name:part.ref,instance:part.instance,m:dcpMultiply(p.worldAdapter,part.m)};});
  } else {
    // Keep the approved 0..70 degree mechanical travel. This changes neither
    // the original BE angle/power logic nor the meshes, rods or hose opening.
    // It is not a claim of a 180-degree optical head travel.
    parts=DCP_RECEIVER_V6_POSE.fromNative(nativePitch,'linear_70').map(function(part){return {name:part.part,instance:part.id,m:part.matrix};});
  }
  for(var i=0;i<parts.length;i++) {
    var part=parts[i],m=part.m;
    if(m.length!==16) throw new Error('Invalid approved matrix size '+kind+'/'+part.name);
    for(var component=0;component<16;component++) dcpFinite(m[component],kind+'/'+part.instance+'['+component+']');
    part.matrix=dcpMatrix4(m);
  }
  var value={key:key,kind:kind,parts:parts};
  dcpCache.put(be,value);
  return value;
}

function dcpRoot(kind) {
  // Absent resources never query the model manager, so the pack-off path
  // keeps the original renderer without missing-model lookups.
  if(!dcpActive[kind]) return null;
  if(dcpRoots[kind]) return dcpRoots[kind];
  var root=$DCPMC.getInstance().getModelManager().getModel(dcpLocation(kind));
  if(!(root instanceof $DCPComposite) || root.getPart(DCP_MACHINES[kind].probe)==null) return null;
  dcpRoots[kind]=root;
  return root;
}

function dcpDrawMachine(be,partial,stack,buffers,light,overlay) {
  var kind=dcpKind(be),nativeRenderer=dcpNative[kind];
  var root=dcpRoot(kind);
  if(root==null) {nativeRenderer.render(be,partial,stack,buffers,light,overlay);return;}
  var p=dcpPose(be);
  var draw=$DCPMC.getInstance().getBlockRenderer().getModelRenderer();
  var consumer=buffers.getBuffer($DCPRenderType.cutout());
  for(var i=0;i<p.parts.length;i++) {
    var part=p.parts[i],model=root.getPart(part.name);
    if(model==null) throw new Error('Missing approved model part '+kind+'/'+part.name);
    stack.pushPose();
    try {
      // 1.21.1 mulPose(Matrix4f) also updates the normal matrix.
      stack.mulPose(part.matrix);
      draw.renderModel(stack.last(),consumer,null,model,1,1,1,light,overlay);
    } finally {stack.popPose();}
  }
  // The original body models are empty resources while this pack is enabled.
  // The original Java renderer therefore contributes only its native
  // shaders/projectile. Do not replace timing, uniforms, formulas or shaders.
  stack.pushPose();
  try {
    if(DCP_MACHINES[kind].lift) stack.translate(0,DCP_MACHINES[kind].lift,0);
    nativeRenderer.render(be,partial,stack,buffers,light,overlay);
  } finally {stack.popPose();}
  dcpStats[kind]++;
  if(!dcpFirst[kind]) {
    dcpFirst[kind]=true;
    console.info('[DCP_APPROVED] first-render '+kind+' instances='+p.parts.length+' exact-source-geometry; native-FX delegated');
  }
}

function dcpGuardDraw(be,partial,stack,buffers,light,overlay) {
  try {dcpDrawMachine(be,partial,stack,buffers,light,overlay);}
  catch(error) {
    var kind=dcpKind(be)||'unknown';dcpStats.errors++;
    if(!dcpErrors[kind]) {dcpErrors[kind]=true;console.error('[DCP_APPROVED] render error '+kind+': '+error);}
    // Never turn a visual failure into a recurring crash.
  }
}

// Union of the original box, the lifted native effects box and the approved
// continuous pose envelope, cached per controller, position and model epoch.
function dcpBounds(be) {
  var kind=dcpKind(be),original=dcpNative[kind].getRenderBoundingBox(be);
  if(original==null || dcpRoot(kind)==null) return original;
  var pos=be.getBlockPos(),x=pos.getX(),y=pos.getY(),z=pos.getZ();
  var old=dcpBoxes.get(be);
  if(old!=null && old.epoch===dcpEpoch && old.x===x && old.y===y && old.z===z && old.original.equals(original)) return old.box;
  var local=DCP_APPROVED_BOUNDS[kind],lift=DCP_MACHINES[kind].lift;
  var box=new $DCPAABB(
    Math.min(original.minX,local[0]+x),
    Math.min(original.minY,original.minY+lift,local[1]+y),
    Math.min(original.minZ,local[2]+z),
    Math.max(original.maxX,local[3]+x),
    Math.max(original.maxY,original.maxY+lift,local[4]+y),
    Math.max(original.maxZ,local[5]+z));
  dcpBoxes.put(be,{epoch:dcpEpoch,x:x,y:y,z:z,original:original,box:box});
  return box;
}
function dcpGuardBounds(be) {
  try {return dcpBounds(be);}
  catch(error) {
    dcpStats.errors++;
    if(!dcpErrors.bounds) {dcpErrors.bounds=true;console.error('[DCP_APPROVED] bounds error: '+error);}
    return $DCPAABB.INFINITE;
  }
}

global.DCPVisual={
  stats:dcpStats,
  active:dcpActive,
  bounds:dcpGuardBounds,
  debugModelState:function(be){var p=dcpPose(be);return {kind:p.kind,root:dcpRoot(p.kind),parts:p.parts};},
  drawMachine:dcpGuardDraw
};

// Java.cast builds a proxy that calls these functions for the interface's
// default methods too; `new BlockEntityRenderer({...})` would generate an
// adapter class overriding only render(), leaving the one-block default
// bounds. Adapting here, while the startup script owns the top-call, lets a
// reload thread later obtain an already adapted Java renderer.
var dcpRenderer=Java.cast($DCPBER,{
  render:function(be,partial,stack,buffers,light,overlay){dcpGuardDraw(be,partial,stack,buffers,light,overlay);},
  shouldRenderOffScreen:function(be){return true;},
  getViewDistance:function(){return DCP_VIEW_DISTANCE;},
  shouldRender:function(be,camera){return $DCPVec3.atCenterOf(be.getBlockPos()).closerThan(camera,DCP_VIEW_DISTANCE);},
  getRenderBoundingBox:function(be){return dcpGuardBounds(be);}
});
function dcpProvider(context) {return dcpRenderer;}

// LOWEST runs after every mod's normal-priority registration, so these
// providers replace the original renderers for the two controllers only.
NativeEvents.onEvent($DCPPriority.LOWEST,$DCPRegisterRenderers,function(event){
  Object.keys(DCP_MACHINES).forEach(function(kind){
    var id=$DCPRL.fromNamespaceAndPath('dysoncubeproject',DCP_MACHINES[kind].type);
    var type=$DCPRegistries.BLOCK_ENTITY_TYPE.get(id);
    if(type==null) throw new Error('Missing original DCP BE type '+id);
    event.registerBlockEntityRenderer(type,dcpProvider);
  });
  console.info('[DCP_APPROVED] providers-registered RegisterRenderers');
});
NativeEvents.onEvent($DCPRegisterAdditional,function(event){
  var resources=$DCPMC.getInstance().getResourceManager(),count=0;
  Object.keys(DCP_MACHINES).forEach(function(kind){
    var machine=DCP_MACHINES[kind];
    var present=resources.getResource($DCPRL.fromNamespaceAndPath(machine.namespace,'models/block/'+machine.root+'.json')).isPresent();
    dcpIncoming[kind]=present;
    if(present) {event.register(dcpLocation(kind));count++;}
  });
  console.info('[DCP_APPROVED] approved-composite-models registered='+count);
});
NativeEvents.onEvent($DCPBakingCompleted,function(event){
  dcpEpoch++;dcpRoots={};dcpCache.clear();dcpBoxes.clear();
  dcpActive.rail=dcpIncoming.rail;dcpActive.receiver=dcpIncoming.receiver;
  console.info('[DCP_APPROVED] model-baking-completed epoch='+dcpEpoch+' rail='+dcpActive.rail+' receiver='+dcpActive.receiver);
});
console.info('[DCP_APPROVED] startup-listeners-ready; original models and mechanical roles preserved');
