// Requires existing KubeJS; no new companion mod. Client environment only.
if (Platform.isClientEnvironment()) {
(function(){

if (!Math.hypot) Math.hypot=function(){var s=0;for(var i=0;i<arguments.length;i++)s+=arguments[i]*arguments[i];return Math.sqrt(s);};

var DCP_PI=3.141592653589793;
var DCP_MODEL_BOUNDS={"rail":{"modern_staged_package":[[0.25,3.5,-1.875],[0.75,4.0,-1.25]],"modern_rammer_rod":[[-0.0625,-0.0625,0.0],[0.0625,0.0625,0.0625]],"modern_slew_rotor_plain":[[-0.1875,1.5,-0.1875],[1.1875,2.4375,1.1875]],"electromagnetic_modules":[[-0.125,0.25,-0.5],[1.125,0.875,2.25]],"modern_tail_hatch":[[-0.0625,0.125,-1.3125],[1.0625,0.875,-1.125]],"modern_cradle":[[-0.1875,-0.25,-0.875],[1.1875,0.75,1.0]],"modern_ram_barrel":[[-0.125,-0.1875,-0.1875],[0.125,1.125,0.1875]],"modern_loading_carriage":[[0.3125,3.5625,-2.0625],[0.6875,3.9375,-1.875]],"modern_base_transformers":[[-1.173828125,0.5625,0.0],[2.173828125,1.871337890625,1.0]],"power_fixed_v10":[[-0.0625,1.4375,1.3125],[1.0625,2.0,1.75]],"modern_mount":[[-1.0,-0.1875,-0.5],[2.0,1.8125,1.5]],"modern_rear_radiators":[[0.139404296875,1.0126953125,-1.0625],[0.860595703125,1.199951171875,0.625]],"inner_winding_rims":[[0.125,0.25,1.125],[0.875,0.75,2.5]],"em_railejector_projectile":[[0.4375,0.4375,0.4375],[0.5625,0.5625,0.5625]],"modern_rear_hood":[[-0.1875,0.5,-1.125],[1.1875,1.125,0.625]],"power_yaw_v10":[[-0.1875,2.4375,-0.5625],[1.1875,2.9375,0.96875]],"power_pitch_leg12_v10":[[-0.0625,0.0,-0.0625],[0.0625,0.75,0.0625]],"fixed_base":[[-1.0,0.0,-1.0],[2.0,1.3125,2.0]],"modern_slew_fixed_windowed":[[-0.5,1.25,-0.5],[1.5,2.0625,1.5]],"modern_ram_rod":[[-0.0625,-1.375,-0.1875],[0.0625,0.1875,0.1875]],"power_pitch_elbow_v10":[[-0.0625,-0.0625,-0.0625],[0.0625,0.0625,0.0625]],"modern_launcher":[[0.0,0.0,-1.0],[1.0,1.0,2.5]],"modern_pitch_lugs":[[-0.9375,0.75,0.375],[1.9375,1.625,1.5]],"power_breech_boots_v10":[[-0.1875,0.4375,-0.5625],[1.1875,0.5625,-0.4375]],"modern_loading_station":[[-0.1875,2.125,-2.625],[1.1875,4.0625,0.25]]},"receiver":{"hydraulic_base_pin":[[-0.4375,-0.09375,-0.09375],[0.375,0.09375,0.09375]],"upper_head":[[0.0,0.0,0.0],[1.0,1.0,1.0625]],"transformer_left":[[0.125,0.0,0.0],[0.875,0.875,1.0]],"bearing_fixed":[[-0.1875,0.0,-0.1875],[1.1875,0.734375,1.1875]],"hydraulic_barrel_skin":[[-0.125,0.0625,-0.125],[0.125,0.5,0.125]],"upper_fork":[[-0.25,0.0,0.0],[1.25,1.8125,1.0]],"metal_bearing_plate":[[0.0,0.75,0.0],[1.0,1.0,1.0]],"hydraulic_eye_rod":[[-0.0625,-0.125,-0.125],[0.0625,0.125,0.125]],"transformer_coil1":[[0.125,0.1875,0.1875],[0.4375,0.625,0.8125]],"transformer_coil2":[[0.5625,0.1875,0.1875],[0.875,0.625,0.8125]],"hydraulic_rod_skin":[[-0.0625,-0.8125,-0.0625],[0.0625,-0.0625,0.0625]],"deck_wire_north":[[0.125,-0.125,-0.640625],[0.875,0.5,0.6875]],"bearing_spacer":[[0.0,0.0,0.0],[1.0,0.1875,1.0]],"transformer_bridge_supports":[[-0.75,0.625,-0.375],[1.75,1.521972656,1.375]],"connector_small_passive":[[0.375,0.0,0.375],[0.625,0.3125,0.625]],"base_frame":[[-1.0,0.0,-0.8125],[2.0,2.0,1.8125]],"transformer_saddles":[[0.125,-0.25,0.125],[0.875,0.0625,0.875]],"transformer_right":[[0.125,0.0,0.0],[0.875,0.875,1.0]],"hydraulic_fixed_mounts":[[-1.0,0.1875,0.3125],[2.0,0.8125,0.6875]],"hydraulic_eye_base":[[-0.125,-0.125,-0.125],[0.125,0.125,0.125]],"deck":[[-1.0,0.0,-1.0],[2.0,0.3125,2.0]],"controller_output_socket":[[0.375,0.0,0.375],[0.625,0.046875,0.625]],"central_energy_hose":[[0.34375,0.1875,0.34375],[0.65625,1.5,0.65625]],"hydraulic_cranks":[[-0.9375,1.375,0.0],[1.9375,1.625,1.125]],"bearing_rotor":[[-0.0625,0.0,-0.0625],[1.0625,1.0,1.0625]]}};

/* Approved rail V17, exact rigid/IK scene port. Column-major 4x4, blocks.
 * Source-local geometry; ram=0, recoil=0, loaded=false.
 * Returns preview coordinates. Optional game world adapter is documented below.
 */
function dcpRailV17Pose(yawDegrees, elevationDegrees) {
  function I() { return [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]; }
  function T(x,y,z) { return [1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1]; }
  function S(x,y,z) { return [x,0,0,0,0,y,0,0,0,0,z,0,0,0,0,1]; }
  function mul(a,b) {
    var o=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];
    for(var c=0;c<4;c++) for(var r=0;r<4;r++) for(var k=0;k<4;k++) o[c*4+r]+=a[k*4+r]*b[c*4+k];
    return o;
  }
  function chain() { var m=I(); for(var i=0;i<arguments.length;i++) m=mul(m,arguments[i]); return m; }
  function R(axis,deg) {
    var a=deg*DCP_PI/180,c=Math.cos(a),s=Math.sin(a);
    return axis==='x'?[1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]:axis==='y'?[c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]:[c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1];
  }
  function A(axis,deg,p) { return chain(T(p[0],p[1],p[2]),R(axis,deg),T(-p[0],-p[1],-p[2])); }
  function sub(a,b) { return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]; }
  function norm(a) { var l=Math.hypot(a[0],a[1],a[2])||1; return [a[0]/l,a[1]/l,a[2]/l]; }
  function px(p) { return [p[0]/16,p[1]/16,p[2]/16]; }
  var parts=[];
  function add(ref,m,instance) { parts.push({ref:ref,model:'dcp_scripted_rail:block/'+ref,instance:instance||ref,m:m}); }
  var yaw=A('y',yawDegrees,[.5,0,.5]);
  var frame=chain(T(0,36/16,0),yaw);
  var gun=chain(yaw,T(0,52/16,.5),A('x',-elevationDegrees,[.5,.5,0]));
  add('fixed_base',I());
  add('modern_base_transformers',I());
  add('modern_slew_fixed_windowed',I());
  add('modern_slew_rotor_plain',yaw);
  add('modern_mount',frame);
  add('modern_cradle',gun);
  add('modern_rear_hood',gun);
  add('modern_rear_radiators',gun);
  add('modern_tail_hatch',gun);
  add('modern_pitch_lugs',chain(frame,A('x',-elevationDegrees,[.5,1.5,.5])));
  add('modern_launcher',chain(gun,T(0,0,0)));
  add('electromagnetic_modules',gun);
  add('inner_winding_rims',gun);
  add('power_fixed_v10',I());
  add('power_yaw_v10',yaw);
  add('power_breech_boots_v10',gun);
  var a=elevationDegrees*DCP_PI/180;
  var cableXs=[-2,18], cableJoints=[];
  for(var xi=0;xi<cableXs.length;xi++) {
    var x=cableXs[xi], A0=[x,46,-8], B0=[x,60-8*Math.sin(a),8-8*Math.cos(a)];
    var dy=B0[1]-A0[1],dz=B0[2]-A0[2],d=Math.hypot(dy,dz);
    var h=Math.sqrt(Math.max(0,144-d*d/4));
    var C0=[x,(A0[1]+B0[1])/2+h*dz/d,(A0[2]+B0[2])/2-h*dy/d];
    var pairs=[[A0,C0],[C0,B0]];
    for(var j=0;j<pairs.length;j++) {
      var s=pairs[j][0], e=pairs[j][1];
      var alpha=Math.atan2(e[2]-s[2],e[1]-s[1])*180/DCP_PI, sp=px(s);
      add('power_pitch_leg12_v10',chain(yaw,T(sp[0],sp[1],sp[2]),R('x',alpha)),'cable_'+xi+'_leg_'+j);
    }
    var cp=px(C0);
    add('power_pitch_elbow_v10',chain(yaw,T(cp[0],cp[1],cp[2])),'cable_'+xi+'_elbow');
    cableJoints.push({A:A0,B:B0,C:C0});
  }
  add('modern_loading_station',yaw);
  add('modern_loading_carriage',chain(yaw,T(0,0,0)));
  add('modern_rammer_rod',chain(yaw,T(.5,60/16,-35/16),S(1,1,2)));
  add('modern_staged_package',chain(yaw,T(0,0,0)));
  var ramXs=[-9,25],ramJoints=[];
  for(var ri=0;ri<ramXs.length;ri++) {
    var rx=ramXs[ri],B=[rx,4,0],Q=[rx,24-6*Math.cos(a)+12*Math.sin(a),8+6*Math.sin(a)+12*Math.cos(a)];
    var u=norm(sub(Q,B)),ra=Math.atan2(u[2],u[1])*180/DCP_PI,rot=R('x',ra),bp=px(B),qp=px(Q);
    add('modern_ram_barrel',chain(frame,T(bp[0],bp[1],bp[2]),rot),'hydraulic_'+ri+'_barrel');
    add('modern_ram_rod',chain(frame,T(qp[0],qp[1],qp[2]),rot),'hydraulic_'+ri+'_rod');
    ramJoints.push({B:B,Q:Q});
  }
  // Undo the -90-degree comparison alignment used by the original-model pane.
  var worldAdapter=A('y',90,[.5,0,.5]);
  // Convert original native gun local coordinates into modern gun local coords.
  var nativeLocalToModern=chain(R('y',-90),T(0,0,-1));
  var originalNativeGun=chain(T(0,2.5,0),R('y',-90),T(1,0,0),R('y',-90),R('z',90),
    A('x',-(180-yawDegrees),[0,.5,.5]),A('z',-(90-elevationDegrees),[0,.5,.5]));
  return {parts:parts,yaw:yaw,frame:frame,gun:gun,cableJoints:cableJoints,ramJoints:ramJoints,
          worldAdapter:worldAdapter,worldGun:mul(worldAdapter,gun),
          nativeFxReplacementFrame:chain(worldAdapter,gun,nativeLocalToModern),
          nativeLocalToModern:nativeLocalToModern,originalNativeGun:originalNativeGun};
}
function dcpRailV17PoseFromNative(currentYaw,currentPitch) {
  return dcpRailV17Pose(180-currentYaw,90-currentPitch);
}

// Exact approved receiver V6 pose graph. Pure arithmetic; no game API or mod.
// Coordinates are source pixels internally; .matrix is column-major BLOCK units,
// matching JOML Matrix4f.set(float[]) and the scripted rail pose interface.
var DCP_RECEIVER_V6_POSE=(function(){
var refs={"base_frame":"dcp_scripted_receiver:block/base_frame","deck":"dcp_scripted_receiver:block/deck","bearing_fixed":"dcp_scripted_receiver:block/bearing_fixed","bearing_rotor":"dcp_scripted_receiver:block/bearing_rotor","bearing_spacer":"dcp_scripted_receiver:block/bearing_spacer","upper_fork":"dcp_scripted_receiver:block/upper_fork","upper_head":"dcp_scripted_receiver:block/upper_head","hydraulic_fixed_mounts":"dcp_scripted_receiver:block/hydraulic_fixed_mounts","hydraulic_cranks":"dcp_scripted_receiver:block/hydraulic_cranks","hydraulic_eye_base":"dcp_scripted_receiver:block/hydraulic_eye_base","hydraulic_eye_rod":"dcp_scripted_receiver:block/hydraulic_eye_rod","hydraulic_base_pin":"dcp_scripted_receiver:block/hydraulic_base_pin","hydraulic_barrel_skin":"dcp_scripted_receiver:block/hydraulic_barrel_skin","hydraulic_rod_skin":"dcp_scripted_receiver:block/hydraulic_rod_skin","deck_wire_north":"dcp_scripted_receiver:block/deck_wire_north","controller_output_socket":"dcp_scripted_receiver:block/controller_output_socket","transformer_left":"dcp_scripted_receiver:block/transformer_left","transformer_right":"dcp_scripted_receiver:block/transformer_right","transformer_coil1":"dcp_scripted_receiver:block/transformer_coil1","transformer_coil2":"dcp_scripted_receiver:block/transformer_coil2","transformer_saddles":"dcp_scripted_receiver:block/transformer_saddles","transformer_bridge_supports":"dcp_scripted_receiver:block/transformer_bridge_supports","central_energy_hose":"dcp_scripted_receiver:block/central_energy_hose","metal_bearing_plate":"dcp_scripted_receiver:block/metal_bearing_plate","connector_small_passive":"dcp_scripted_receiver:block/connector_small_passive"};
function I(){return [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];}
function T(x,y,z){var m=I();m[3]=x;m[7]=y;m[11]=z;return m;}
function mul(a,b){var m=[],i,j,k;for(i=0;i<4;i++)for(j=0;j<4;j++){var s=0;for(k=0;k<4;k++)s+=a[4*i+k]*b[4*k+j];m[4*i+j]=s;}return m;}
function chain(){var m=I();for(var i=0;i<arguments.length;i++)m=mul(m,arguments[i]);return m;}
function R(axis,deg){var c=Math.cos(deg*DCP_PI/180),s=Math.sin(deg*DCP_PI/180);return axis==='x'?[1,0,0,0,0,c,-s,0,0,s,c,0,0,0,0,1]:axis==='y'?[c,0,s,0,0,1,0,0,-s,0,c,0,0,0,0,1]:[c,-s,0,0,s,c,0,0,0,0,1,0,0,0,0,1];}
function A(axis,deg,x,y,z){return chain(T(x,y,z),R(axis,deg),T(-x,-y,-z));}
function nativePose(P,mode){var w=((P+180)%360+360)%360-180,e=Math.max(0,90-Math.abs(w));return {nativeCurrentPitch:P,physicalSolarElevation:e,sourceYaw:0,sourcePitch:mode==='clamp_70'?Math.min(70,e):mode==='unsafe_raw_90'?e:e*70/90};}
function scene(p,y){var result=[],yaw=A('y',y||0,8,0,8),frame=chain(T(0,59,0),yaw),pitch=A('x',-p,8,24,8);
function add(n,m,id){var b=m.slice();b[3]/=16;b[7]/=16;b[11]/=16;var c=[];for(var i=0;i<4;i++)for(var j=0;j<4;j++)c[j*4+i]=b[i*4+j];result.push({id:id||n,part:n,model:refs[n],matrix:c,matrixRowMajor:b});}
add('base_frame',I());add('deck',T(0,32,0));add('controller_output_socket',I());
var ds=[0,180],xs=[4,8,12],i,j,x,radial,unit,n;
for(i=0;i<ds.length;i++){radial=A('y',ds[i],8,0,8);add('deck_wire_north',chain(T(0,32,0),radial,T(0,0,-8)),'deck_hoses_'+ds[i]);for(j=0;j<xs.length;j++){x=xs[j];add('connector_small_passive',chain(radial,T(x,38,0),R('x',-90),T(-8,0,-8)),'deck_connector_'+ds[i]+'_'+x);}}
add('metal_bearing_plate',T(0,24,0));add('bearing_spacer',T(0,40,0));add('bearing_fixed',T(0,43,0));add('bearing_rotor',chain(T(0,43,0),yaw));add('transformer_bridge_supports',I());
var tx=[-10,26];for(i=0;i<tx.length;i++){x=tx[i];unit=chain(T(x,28,8),R('z',x<0?12:-12),T(-8,0,-8));var ns=[x<0?'transformer_left':'transformer_right','transformer_coil1','transformer_coil2','transformer_saddles'];for(j=0;j<ns.length;j++){n=ns[j];add(n,unit,n+'_'+x);}}
add('upper_fork',frame);add('upper_head',chain(frame,T(0,16,0),A('x',-p,8,8,8)));add('central_energy_hose',frame);add('hydraulic_fixed_mounts',frame);add('hydraulic_cranks',chain(frame,pitch));
for(i=0;i<tx.length;i++){x=tx[i];add('hydraulic_base_pin',chain(frame,T(x,11,8),x===26?R('y',180):I()),'lower_pin_bank_'+x);}
var banks=[-13,-7,23,29],a=p*DCP_PI/180;for(i=0;i<banks.length;i++){x=banks[i];var B=[x,11,8],Q=[x,24+8*Math.sin(a),8+8*Math.cos(a)],d=[0,Q[1]-B[1],Q[2]-B[2]],L=Math.sqrt(d[1]*d[1]+d[2]*d[2]),u=[0,d[1]/L,d[2]/L],rot=R('x',Math.atan2(u[2],u[1])*180/DCP_PI);
add('hydraulic_barrel_skin',chain(frame,T(B[0]+u[0],B[1]+u[1],B[2]+u[2]),rot),'hydraulic_barrel_skin_'+x);add('hydraulic_rod_skin',chain(frame,T(Q[0]-u[0],Q[1]-u[1],Q[2]-u[2]),rot),'hydraulic_rod_skin_'+x);add('hydraulic_eye_base',chain(frame,T(B[0],B[1],B[2]),rot),'hydraulic_eye_base_'+x);add('hydraulic_eye_rod',chain(frame,T(Q[0],Q[1],Q[2]),rot),'hydraulic_eye_rod_'+x);}
return result;}
return {models:refs,nativePose:nativePose,scene:scene,fromNative:function(P,mode){var q=nativePose(P,mode);return scene(q.sourcePitch,0);}};
})();

// Loaded only on the client, together with the exact approved pose functions.
// Geometry, sprite pixels, joint locations and component roles are resources.
// This file supplies the independent draw transforms the original BER lacks.
var $DCPRL = Java.loadClass('net.minecraft.resources.ResourceLocation');
var $DCPMC = Java.loadClass('net.minecraft.client.Minecraft');
var $DCPM4 = Java.loadClass('org.joml.Matrix4f');
var $DCPM3 = Java.loadClass('org.joml.Matrix3f');
var $DCPAABB = Java.loadClass('net.minecraft.world.phys.AABB');
var $DCPRenderType = Java.loadClass('net.minecraft.client.renderer.RenderType');
var $DCPBuffers = Java.loadClass('net.minecraft.client.renderer.MultiBufferSource');
var $DCPBufferBuilder = Java.loadClass('com.mojang.blaze3d.vertex.BufferBuilder');
var $DCPWeakMap = Java.loadClass('java.util.WeakHashMap');
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
var dcpFallbackBuffers = null;
var dcpStats = {rail:0,receiver:0,fallback:0,errors:0};

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
  var lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(var i=0;i<parts.length;i++) {
    var part=parts[i],b=DCP_MODEL_BOUNDS[kind][part.name],m=part.m;
    if(!b) throw new Error('No approved model bounds for '+kind+'/'+part.name);
    if(m.length!==16) throw new Error('Invalid approved matrix size '+kind+'/'+part.name);
    for(var component=0;component<16;component++) dcpFinite(m[component],kind+'/'+part.instance+'['+component+']');
    for(var x=0;x<2;x++) for(var y=0;y<2;y++) for(var z=0;z<2;z++) {
      var v=[b[x][0],b[y][1],b[z][2]];
      for(var k=0;k<3;k++) {
        var q=m[k]*v[0]+m[4+k]*v[1]+m[8+k]*v[2]+m[12+k];
        lo[k]=Math.min(lo[k],q);hi[k]=Math.max(hi[k],q);
      }
    }
    part.matrix=dcpMatrix4(m);
    part.normal=dcpNormal3(m);
  }
  for(var axis=0;axis<3;axis++){dcpFinite(lo[axis],kind+'/bounds.min');dcpFinite(hi[axis],kind+'/bounds.max');}
  var value={key:key,kind:kind,parts:parts,lo:lo,hi:hi};
  dcpCache.put(be,value);
  return value;
}

function dcpRoot(kind) {
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
  debugModelState:function(be){var p=dcpPose(be);return {kind:p.kind,root:dcpRoot(p.kind),parts:p.parts,lo:p.lo,hi:p.hi};},
  getRenderBounds:function(be,partial) {
    if(dcpRoot(dcpKind(be))==null) return null;
    var p=dcpPose(be),b=be.getBlockPos();
    return new $DCPAABB(p.lo[0]+b.getX()-.01,p.lo[1]+b.getY()-.01,p.lo[2]+b.getZ()-.01,
      p.hi[0]+b.getX()+.01,p.hi[1]+b.getY()+.01,p.hi[2]+b.getZ()+.01);
  },
  drawFallback:function(be,partial,stack,light,overlay) {
    if(dcpFallbackBuffers==null) dcpFallbackBuffers=$DCPBuffers.immediate(new $DCPBufferBuilder(262144));
    try {dcpGuardDraw(be,partial,stack,dcpFallbackBuffers,light,overlay);dcpStats.fallback++;}
    finally {dcpFallbackBuffers.endBatch();}
  },
  drawMachine:dcpGuardDraw
};

var dcpProviders=['rail','receiver'].map(function(kind){
  // Build the interface proxy while this startup script owns a Rhino top-call.
  // A provider called later by a Java reload thread must return an already
  // adapted Java BER, rather than coerce a fresh plain JS object on that thread.
  var renderer=new $DCPBER({m_6922_:function(be,partial,stack,buffers,light,overlay){dcpGuardDraw(be,partial,stack,buffers,light,overlay);}});
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
  event.register(new $DCPRL('dcp_scripted_rail','block/rail_parts'));
  event.register(new $DCPRL('dcp_scripted_receiver','block/receiver_parts'));
  console.info('[DCP_APPROVED] approved-composite-models registered=2');
});
ForgeModEvents.onEvent('net.minecraftforge.client.event.ModelEvent$BakingCompleted',function(event){
  dcpEpoch++;dcpRoots={};dcpCache.clear();
  console.info('[DCP_APPROVED] model-baking-completed epoch='+dcpEpoch);
});
console.info('[DCP_APPROVED] startup-listeners-ready; original models and mechanical roles preserved');


})();
}


(function(){
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

})();
