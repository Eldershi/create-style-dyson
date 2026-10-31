const I=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],T=(x,y,z)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,z,1],S=(x,y,z)=>[x,0,0,0,0,y,0,0,0,0,z,0,0,0,0,1];
function mul(a,b){const o=Array(16).fill(0);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
const chain=(...m)=>m.reduce(mul,I());
function R(axis,deg){const a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return axis==='x'?[1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]:axis==='y'?[c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]:[c,s,0,0,-s,c,0,0,0,0,1,0,0,0,0,1];}
const A=(axis,deg,p)=>chain(T(...p),R(axis,deg),T(...p.map(x=>-x)));
const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l);};
const custom=n=>n;
function addPowerCablesV10(add,yaw,gun,pitchDegrees){
  add('power_fixed_v10',I());
  add('power_yaw_v10',yaw);
  add('power_breech_boots_v10',gun);
  const a=pitchDegrees*Math.PI/180;
  for(const x of [-2,18]){
    const A0=[x,46,-8],B0=[x,60-8*Math.sin(a),8-8*Math.cos(a)];
    const dy=B0[1]-A0[1],dz=B0[2]-A0[2],d=Math.hypot(dy,dz);
    const h=Math.sqrt(Math.max(0,144-d*d/4));
    const C0=[x,(A0[1]+B0[1])/2+h*dz/d,(A0[2]+B0[2])/2-h*dy/d];
    for(const [s,e] of [[A0,C0],[C0,B0]]){
      const alpha=Math.atan2(e[2]-s[2],e[1]-s[1])*180/Math.PI;
      add('power_pitch_leg12_v10',chain(yaw,T(...s.map(v=>v/16)),R('x',alpha)));
    }
    add('power_pitch_elbow_v10',chain(yaw,T(...C0.map(v=>v/16))));
  }
}
function modernGunMatrix(){return chain(A('y',state.yaw,[.5,0,.5]),T(0,52/16,.5),A('x',-state.pitch,[.5,.5,0]));}
function scene(variant){const parts=[],add=(ref,m)=>parts.push({ref,m});
 if(fx.active&&fx.ageTicks>0&&fx.ageTicks<28){const r=fx.ageTicks/28;add('dysoncubeproject:block/em_railejector_projectile',chain(effectsFrame(variant),T(0,-.1,1.25+1000*r)));}
 if(variant==='original'){
   const align=A('y',-90,[.5,0,.5]);
   const originalGun=originalGunMatrix();
   add('dysoncubeproject:block/em_railejector_base',align);
   add('dysoncubeproject:block/em_railejector_gun',mul(align,originalGun));
   return parts;
 }
 const yaw=A('y',state.yaw,[.5,0,.5]),frame=chain(T(0,36/16,0),yaw);
 const gun=modernGunMatrix();
 add(custom('fixed_base'),I());
 add(custom('modern_base_transformers'),I());
 add(custom('modern_slew_fixed_windowed'),I());add(custom('modern_slew_rotor_plain'),yaw);
 add(custom('modern_mount'),frame);
 add(custom('modern_cradle'),gun);
 add(custom('modern_rear_hood'),gun);add(custom('modern_rear_radiators'),gun);add(custom('modern_tail_hatch'),gun);
 add(custom('modern_pitch_lugs'),chain(frame,A('x',-state.pitch,[.5,1.5,.5])));
 add(custom('modern_launcher'),chain(gun,T(0,0,-state.recoil/16)));
 add(custom('electromagnetic_modules'),gun);
 add(custom('inner_winding_rims'),gun);
 addPowerCablesV10(add,yaw,gun,state.pitch);
 add(custom('modern_loading_station'),yaw);
 add(custom('modern_loading_carriage'),chain(yaw,T(0,0,38*state.ram/16)));
 const chainLength=2+38*state.ram;
 for(let z=0;z<chainLength;z+=2){const length=Math.min(2,chainLength-z);add(custom('modern_rammer_rod'),chain(yaw,T(.5,60/16,(-35+z)/16),S(1,1,length)));}
 add(custom('modern_staged_package'),state.loaded?chain(gun,T(0,-52/16,30/16-state.recoil/16)):chain(yaw,T(0,0,38*state.ram/16)));
 const a=state.pitch*Math.PI/180;
 for(const x of [-9,25]){
  const B=[x,4,0],Q=[x,24-6*Math.cos(a)+12*Math.sin(a),8+6*Math.sin(a)+12*Math.cos(a)],u=norm(sub(Q,B)),alpha=Math.atan2(u[2],u[1])*180/Math.PI,rot=R('x',alpha),at=(p)=>chain(frame,T(...p.map(v=>v/16)),rot);
  add(custom('modern_ram_barrel'),at(B));
  add(custom('modern_ram_rod'),at(Q));
 }
 return parts;
}
