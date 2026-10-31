const I=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],T=(x,y,z)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1];
function mul(a,b){const o=Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
const chain=(...m)=>m.reduce(mul,I());
function R(axis,deg){const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return axis==='x'?[1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]:axis==='y'?[c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]:[c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1];}
const A=(axis,deg,p)=>chain(T(...p),R(axis,deg),T(...p.map(x=>-x)));
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};
const custom=n=>'dcp_preview:block/'+n;
function scene(variant){const parts=[],add=(ref,m)=>parts.push({ref,m});
 if(variant==='original'){
   const stand=chain(T(0,4,1),R('y',90));
   for(const [p,m]of Object.entries({ray_receiver_base:I(),ray_receiver_plate:T(0,2,0),ray_receiver_lens_stands:stand,ray_receiver_lens:chain(stand,A('x',-90,[0,.55,.5]),A('x',-90-state.pitch,[0,.55,.5]))}))add('dysoncubeproject:block/'+p,m);
   return parts;
 }
 const yaw=A('y',state.yaw,[.5,0,.5]),frame=chain(T(0,59/16,0),yaw),pitch=A('x',-state.pitch,[.5,1.5,.5]);
 add(custom('base_frame'),I());add(custom('deck'),T(0,2,0));
 add(custom('controller_output_socket'),I());
 for(const deg of [0,180]){
  const radial=A('y',deg,[.5,0,.5]);
  add(custom('deck_wire_north'),chain(T(0,2,0),radial,T(0,0,-.5)));
  for(const x of [4,8,12])add('createaddition:block/connector/small/passive',chain(radial,T(x/16,2.375,0),R('x',-90),T(-.5,0,-.5)));
 }
 add('aeronautics:block/gyroscopic_propeller_bearing/metal_bearing_plate',T(0,1.5,0));
 add(custom('bearing_spacer'),T(0,40/16,0));
 add(custom('bearing_fixed'),T(0,43/16,0));add(custom('bearing_rotor'),chain(T(0,43/16,0),yaw));
 add(custom('transformer_bridge_supports'),I());
 for(const x of [-10,26]){
  const unit=chain(T(x/16,28/16,.5),R('z',x<0?12:-12),T(-.5,0,-.5));
  add(custom(x<0?'transformer_left':'transformer_right'),unit);
  for(const part of ['transformer_coil1','transformer_coil2','transformer_saddles'])add(custom(part),unit);
 }
 add(custom('upper_fork'),frame);add(custom('upper_head'),chain(frame,T(0,1,0),A('x',-state.pitch,[.5,.5,.5])));
 add(custom('central_energy_hose'),frame);
 add(custom('hydraulic_fixed_mounts'),frame);add(custom('hydraulic_cranks'),mul(frame,pitch));
 for(const x of [-10,26])add(custom('hydraulic_base_pin'),chain(frame,T(x/16,11/16,.5),x===26?R('y',180):I()));
 const a=state.pitch*Math.PI/180;
 for(const x of [-13,-7,23,29]){
  const B=[x,11,8],Q=[x,24+8*Math.sin(a),8+8*Math.cos(a)],u=norm(sub(Q,B)),alpha=Math.atan2(u[2],u[1])*180/Math.PI,rot=R('x',alpha),at=(p)=>chain(frame,T(...p.map(v=>v/16)),rot);
  add(custom('hydraulic_barrel_skin'),at(B.map((v,i)=>v+u[i])));
  add(custom('hydraulic_rod_skin'),at(Q.map((v,i)=>v-u[i])));
  add(custom('hydraulic_eye_base'),at(B));add(custom('hydraulic_eye_rod'),at(Q));
 }
 return parts;
}
