// Loaded only on the client, together with the exact approved pose functions.
// Geometry, sprite pixels, joint locations and component roles are resources.
// This file supplies the independent draw transforms the original BER lacks.
var $DCPRL = Java.loadClass('net.minecraft.resources.ResourceLocation');
var $DCPMC = Java.loadClass('net.minecraft.client.Minecraft');
var $DCPM4 = Java.loadClass('org.joml.Matrix4f');
var $DCPM3 = Java.loadClass('org.joml.Matrix3f');
var $DCPRenderType = Java.loadClass('net.minecraft.client.renderer.RenderType');
var $DCPWeakMap = Java.loadClass('java.util.WeakHashMap');
var $DCPCompat = Java.loadClass('dev.eldershi.dysoncompat.client.ApprovedRendererBridge');
var $DCPRegistries = Java.loadClass('net.minecraftforge.registries.ForgeRegistries');
var $DCPNativeRail = Java.loadClass('org.mob.dysoncubeproject.client.tile.EMRailEjectorRender');
var $DCPNativeReceiver = Java.loadClass('org.mob.dysoncubeproject.client.tile.RayReceiverRender');
var $DCPPriority = Java.loadClass('net.minecraftforge.eventbus.api.EventPriority');
var $DCPRegisterRenderers = Java.loadClass('net.minecraftforge.client.event.EntityRenderersEvent$RegisterRenderers');
var $DCPRendererRegistry = Java.loadClass('dev.architectury.registry.client.rendering.BlockEntityRendererRegistry');
var $DCPBER = Java.loadClass('net.minecraft.client.renderer.blockentity.BlockEntityRenderer');
var dcpCache = new $DCPWeakMap();
var dcpEpoch = 0;
var dcpRoots = {};
var dcpFirst = {};
var dcpErrors = {};
var dcpNative = {rail: new $DCPNativeRail(), receiver: new $DCPNativeReceiver()};
var dcpStats = {rail:0,receiver:0,errors:0};

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
function dcpNormal3(m) {
  return new $DCPM3().set(m[0],m[1],m[2],m[4],m[5],m[6],m[8],m[9],m[10]).invert().transpose();
}
function dcpKind(be) {
  return be instanceof $DCPNativeRailBE ? 'rail' : be instanceof $DCPNativeReceiverBE ? 'receiver' : null;
}
var $DCPNativeRailBE = Java.loadClass('org.mob.dysoncubeproject.block.entity.EMRailEjectorBlockEntity');
var $DCPNativeReceiverBE = Java.loadClass('org.mob.dysoncubeproject.block.entity.RayReceiverBlockEntity');

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
    part.normal=dcpNormal3(m);
  }
  var value={key:key,kind:kind,parts:parts};
  dcpCache.put(be,value);
  return value;
}

function dcpRoot(kind) {
  if(!$DCPCompat.isActive()) return null;
  if(dcpRoots[kind]) return dcpRoots[kind];
  var ns=kind==='rail'?'dcp_scripted_rail':'dcp_scripted_receiver';
  var name=kind==='rail'?'rail_parts':'receiver_parts';
  var root=$DCPMC.getInstance().getModelManager().getModel(new $DCPRL(ns,'block/'+name));
  // With the bundle disabled, preserve the original renderer as a real fallback.
  try {if(root.getPart(kind==='rail'?'fixed_base':'base_frame')==null) return null;}
  catch(missing) {return null;}
  dcpRoots[kind]=root;
  return root;
}

function dcpDrawMachine(be,partial,stack,buffers,light,overlay) {
  var kind=dcpKind(be),nativeRenderer=dcpNative[kind];
  var root=dcpRoot(kind);
  if(root==null) {nativeRenderer.render(be,partial,stack,buffers,light,overlay);return;}
  var p=dcpPose(be),mc=$DCPMC.getInstance();
  var draw=mc.getBlockRenderer().getModelRenderer();
  var consumer=buffers.getBuffer($DCPRenderType.cutout());
  for(var i=0;i<p.parts.length;i++) {
    var part=p.parts[i],model=root.getPart(part.name);
    if(model==null) throw new Error('Missing approved model part '+kind+'/'+part.name);
    stack.pushPose();
    try {
      stack.mulPoseMatrix(part.matrix);
      // 1.20.1 mulPoseMatrix only updates the position matrix.
      stack.last().normal().mul(part.normal);
      if(global.DCPQAModelAudit) global.DCPQAModelAudit.inspectPart(be,part,model,stack,consumer);
      draw.renderModel(stack.last(),consumer,null,model,1,1,1,light,overlay);
      if(global.DCPQAModelAudit) global.DCPQAModelAudit.afterPart(be,part,consumer);
    } finally {stack.popPose();}
  }
  // Six original body slots are empty resource models while this bundle is
  // enabled. The original Java renderer therefore contributes only its native
  // shaders/projectile. Do not replace timing, uniforms, formulas or shaders.
  stack.pushPose();
  try {
    if(kind==='rail') stack.translate(0,1.25,0);
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
    // Never turn a visual failure into a recurring crash. Installation requires
    // this counter to stay at zero in the actual-game acceptance run.
  }
}

global.DCPVisual={
  stats:dcpStats,
  nativeCompat:$DCPCompat,
  debugModelState:function(be){var p=dcpPose(be);return {kind:p.kind,root:dcpRoot(p.kind),parts:p.parts};},
  drawMachine:dcpGuardDraw
};

var dcpProviders=['rail','receiver'].map(function(kind){
  // Build the interface proxy while this startup script owns a Rhino top-call.
  // A provider called later by a Java reload thread must return an already
  // adapted Java BER, rather than coerce a fresh plain JS object on that thread.
  var delegate=new $DCPBER({m_6922_:function(be,partial,stack,buffers,light,overlay){dcpGuardDraw(be,partial,stack,buffers,light,overlay);}});
  var renderer=$DCPCompat.wrap(delegate);
  return [kind==='rail'?'em_railejector_controller':'ray_receiver_controller',function(context){
    console.info('[DCP_APPROVED] provider-created '+kind);
    return renderer;
  }];
});
function dcpRegister(registration,reason) {
  dcpProviders.forEach(function(entry){
    var type=$DCPRegistries.BLOCK_ENTITY_TYPES.getValue(new $DCPRL('dysoncubeproject',entry[0]));
    if(type==null) throw new Error('Missing original DCP BE type '+entry[0]);
    registration(type,entry[1]);
  });
  console.info('[DCP_APPROVED] providers-registered '+reason);
}
ClientEvents.init(function(event){dcpRegister(function(type,provider){event.registerBlockEntityRenderer(type,provider);},'ClientEvents.init');});
ForgeModEvents.eventBus().addListener($DCPPriority.LOWEST,false,$DCPRegisterRenderers,function(event){
  dcpRegister(function(type,provider){$DCPRendererRegistry.register(type,provider);},'RegisterRenderers');
});
ForgeModEvents.onEvent('net.minecraftforge.client.event.ModelEvent$RegisterAdditional',function(event){
  if(!$DCPCompat.hasPreparedResources()) return;
  event.register(new $DCPRL('dcp_scripted_rail','block/rail_parts'));
  event.register(new $DCPRL('dcp_scripted_receiver','block/receiver_parts'));
  console.info('[DCP_APPROVED] approved-composite-models registered=2');
});
ForgeModEvents.onEvent('net.minecraftforge.client.event.ModelEvent$BakingCompleted',function(event){
  dcpEpoch++;dcpRoots={};dcpCache.clear();
  $DCPCompat.onModelBakingCompleted();
  console.info('[DCP_APPROVED] model-baking-completed epoch='+dcpEpoch);
});
console.info('[DCP_APPROVED] startup-listeners-ready; original models and mechanical roles preserved');
