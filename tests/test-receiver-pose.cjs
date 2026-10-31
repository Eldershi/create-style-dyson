const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(process.env.DCP_SOURCE_INPUTS||path.join(root,'source'),'receiver/scene.js'),'utf8');
const reference=new Function('pitch','const state={pitch:pitch,yaw:0};\n'+source+'\nreturn scene("new");');
vm.runInThisContext(fs.readFileSync(path.join(root,'work/scripted-receiver/receiver_pose.js'),'utf8'));
const names={};for(const [name,resource]of Object.entries(DCP_RECEIVER_V6_POSE.models))names[resource.split('/').pop()]=name;
const sourceRefs=JSON.parse(fs.readFileSync(path.join(root,'work/scripted-receiver/pose_contract.json'),'utf8')).source_refs;
let maxError=0,samples=0;
for(let pitch=0;pitch<=70;pitch+=.25){const a=reference(pitch),b=DCP_RECEIVER_V6_POSE.scene(pitch,0);if(a.length!==47||b.length!==47)throw Error('receiver count');for(let i=0;i<47;i++){if(a[i].ref!==sourceRefs[b[i].part])throw Error('receiver ref '+i);for(let k=0;k<16;k++){const e=Math.abs(a[i].m[k]-b[i].matrix[k]);if(!Number.isFinite(e)||e>2e-12)throw Error('receiver matrix '+pitch+'/'+i+'/'+k);maxError=Math.max(maxError,e);}}samples++;}
for(let native=-720;native<=720;native+=.25){const p=DCP_RECEIVER_V6_POSE.nativePose(native,'linear_70');if(p.sourceYaw!==0||p.sourcePitch<0||p.sourcePitch>70)throw Error('receiver native range');}
const result={status:'PASS',scope:'Canonical source matrices and implemented mechanical range only',poseSamples:samples,instances:47,maxMatrixError:maxError,mechanicalPitchRange:[0,70],visualYaw:0};fs.writeFileSync(path.join(root,'outputs/receiver-pose-test.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
