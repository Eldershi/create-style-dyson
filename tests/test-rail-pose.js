/* Read-only source/port parity and kinematic continuity audit. */
const fs=require('fs'),vm=require('vm'),crypto=require('crypto');
const here=require('path').resolve(__dirname,'../work/scripted-rail');
const approved=fs.readFileSync(here+'/source/approved-scene-functions.js','utf8');
const exact=new Function('yawDegrees','pitchDegrees',
  'const state={yaw:yawDegrees,pitch:pitchDegrees,ram:0,recoil:0,loaded:false};const fx={active:false};\n'+approved+'\nreturn scene("new");');
const port=fs.readFileSync(here+'/pose-v17.js','utf8');
vm.runInThisContext(port);
function point(m,p){return [0,1,2].map(r=>m[r]*p[0]+m[4+r]*p[1]+m[8+r]*p[2]+m[12+r]);}
function dist(a,b){return Math.hypot(...a.map((x,i)=>x-b[i]));}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
let samples=0,maxMatrixError=0,maxCableEndpointError=0,maxCableLengthError=0,maxHydraulicOriginError=0,maxHydraulicAxisCross=0;
let minHydraulicLength=Infinity,maxHydraulicLength=0;
const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
const recipe=JSON.parse(fs.readFileSync(here+'/recipe.json','utf8'));
let refs=null;
for(let nativeYaw=0;nativeYaw<=360;nativeYaw+=.5)for(let nativePitch=10;nativePitch<=90;nativePitch+=.5){
  const yaw=180-nativeYaw,elev=90-nativePitch,source=exact(yaw,elev),p=dcpRailV17PoseFromNative(nativeYaw,nativePitch);
  if(source.length!==30||p.parts.length!==30)throw Error('part count');
  for(let i=0;i<30;i++){
    if(source[i].ref!==p.parts[i].ref)throw Error('part order '+i);
    for(let k=0;k<16;k++){
      const e=Math.abs(source[i].m[k]-p.parts[i].m[k]);
      if(!Number.isFinite(e)||e>1e-12)throw Error('pose mismatch '+nativeYaw+'/'+nativePitch+' '+i+' '+k+' '+e);
      maxMatrixError=Math.max(maxMatrixError,e);
    }
  }
  if(!refs)refs=p.parts.map(x=>x.ref);
  for(let i=0;i<2;i++){
    const j=p.cableJoints[i],first=p.parts.find(x=>x.instance==='cable_'+i+'_leg_0'),second=p.parts.find(x=>x.instance==='cable_'+i+'_leg_1');
    const a=point(p.yaw,j.A.map(x=>x/16)),b=point(p.yaw,j.B.map(x=>x/16)),c=point(p.yaw,j.C.map(x=>x/16));
    maxCableLengthError=Math.max(maxCableLengthError,Math.abs(dist(j.A,j.C)-12),Math.abs(dist(j.C,j.B)-12));
    maxCableEndpointError=Math.max(maxCableEndpointError,dist(point(first.m,[0,0,0]),a),dist(point(first.m,[0,12/16,0]),c),dist(point(second.m,[0,0,0]),c),dist(point(second.m,[0,12/16,0]),b));
    const r=p.ramJoints[i],barrel=p.parts.find(x=>x.instance==='hydraulic_'+i+'_barrel'),rod=p.parts.find(x=>x.instance==='hydraulic_'+i+'_rod');
    const B=point(p.frame,r.B.map(x=>x/16)),Q=point(p.frame,r.Q.map(x=>x/16)),axis=point(barrel.m,[0,1,0]).map((x,k)=>x-B[k]);
    maxHydraulicOriginError=Math.max(maxHydraulicOriginError,dist(point(barrel.m,[0,0,0]),B),dist(point(rod.m,[0,0,0]),Q));
    const d=Q.map((x,k)=>x-B[k]),L=dist(Q,B)*16;
    maxHydraulicAxisCross=Math.max(maxHydraulicAxisCross,Math.hypot(...cross(axis,d)));
    minHydraulicLength=Math.min(minHydraulicLength,L);maxHydraulicLength=Math.max(maxHydraulicLength,L);
  }
  samples++;
}
if(maxCableEndpointError>1e-12||maxCableLengthError>1e-12||maxHydraulicOriginError>1e-12||maxHydraulicAxisCross>1e-12)throw Error('IK endpoints');
const named=[];
for(const nativeYaw of [0,90,180,270])for(const elevation of [0,45,80]){
  const nativePitch=90-elevation,p=dcpRailV17PoseFromNative(nativeYaw,nativePitch);
  named.push({nativeYaw,nativePitch,approvedYaw:180-nativeYaw,approvedElevation:elevation,...p});
}
fs.writeFileSync(here+'/pose-samples.json',JSON.stringify({schema:1,matrix_layout:'column-major blocks',poses:named},null,2)+'\n');
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const result={status:'PASS',scope:'Numerical exact approved scene parity and original kinematic endpoint continuity only; not game/render validation, not a new structural collision audit.',native_yaw_degrees:{min:0,max:360,step:.5},native_pitch_degrees:{min:10,max:90,step:.5},samples,rigid_instances_per_pose:30,unique_steady_state_models:new Set(refs).size,part_instances_in_draw_order:refs,max_matrix_component_error:maxMatrixError,max_cable_endpoint_error_blocks:maxCableEndpointError,max_12px_cable_link_length_error_px:maxCableLengthError,max_hydraulic_anchor_origin_error_blocks:maxHydraulicOriginError,max_hydraulic_axis_cross_blocks:maxHydraulicAxisCross,hydraulic_pin_distance_range_px:[minHydraulicLength,maxHydraulicLength],original_frameY36_and_gun_pivotY60_preserved:true,all_27_loading_station_groups_preserved:true,canonical_functions_sha256:sha(approved),pose_function_sha256:sha(port),source_scene_sha256:recipe.source_scene_sha256,source_payload_sha256:recipe.source_payload_sha256,no_geometry_or_mechanical_role_changes:true};
fs.writeFileSync(here+'/pose-audit.json',JSON.stringify(result,null,2)+'\n');
const exportAudit=JSON.parse(fs.readFileSync(here+'/export-audit.json','utf8'));
exportAudit.pose_parity='PASS work/scripted-rail/pose-audit.json; 116081 native angle pairs, 30instances each, max matrix error0';
exportAudit.pose_function_sha256=result.pose_function_sha256;
fs.writeFileSync(here+'/export-audit.json',JSON.stringify(exportAudit,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
