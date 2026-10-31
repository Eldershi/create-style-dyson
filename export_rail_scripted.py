#!/usr/bin/env python3
"""Export the approved V17 rail as independent rigid models for a scripted BER.

Each source model is exported independently for the client pose renderer.
The canonical source data is retained byte-for-byte. Runtime sprites may receive
edge padding for Minecraft's atlas mipmaps; only the matching UV scale changes.
No alpha holes, intersections, supports, platforms, or mechanical parts are cut.
"""
from __future__ import annotations

import base64
import copy
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys

from PIL import Image

ROOT = Path(__file__).resolve().parent
from source_inputs import input_root
INPUT=input_root()
SCENE_SOURCE = INPUT / 'rail/scene.js'
SOURCE = INPUT / 'rail/payload.json'
OUT = ROOT / 'outputs/scripted-pack'
WORK = ROOT / 'work/scripted-rail'
NS = 'dcp_scripted_rail'
sys.path.insert(0, str(ROOT / 'work'))
from export_obj import mip_safe_image, vertices


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def put_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def model_name(ref: str) -> str:
    return ref.rsplit('/', 1)[-1].split(':')[-1]


POSE_JS = r'''/* Approved rail V17, exact rigid/IK scene port. Column-major 4x4, blocks.
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
    var a=deg*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
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
  var a=elevationDegrees*Math.PI/180;
  var cableXs=[-2,18], cableJoints=[];
  for(var xi=0;xi<cableXs.length;xi++) {
    var x=cableXs[xi], A0=[x,46,-8], B0=[x,60-8*Math.sin(a),8-8*Math.cos(a)];
    var dy=B0[1]-A0[1],dz=B0[2]-A0[2],d=Math.hypot(dy,dz);
    var h=Math.sqrt(Math.max(0,144-d*d/4));
    var C0=[x,(A0[1]+B0[1])/2+h*dz/d,(A0[2]+B0[2])/2-h*dy/d];
    var pairs=[[A0,C0],[C0,B0]];
    for(var j=0;j<pairs.length;j++) {
      var s=pairs[j][0], e=pairs[j][1];
      var alpha=Math.atan2(e[2]-s[2],e[1]-s[1])*180/Math.PI, sp=px(s);
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
    var u=norm(sub(Q,B)),ra=Math.atan2(u[2],u[1])*180/Math.PI,rot=R('x',ra),bp=px(B),qp=px(Q);
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
'''


def export_model(payload, ref, textures):
    name=model_name(ref)
    base=OUT/'assets'/NS/'models/block'/name
    base.parent.mkdir(parents=True,exist_ok=True)
    obj=['# Exact approved V17 source model; scripted rigid transforms are external.', 'mtllib '+name+'.mtl']
    material_ids=[];idx=1;quads=0;group_records=[]
    for gi,group in enumerate(payload['models'][ref]['groups']):
        tid=group['texture'];tex=payload['textures'][tid];uvscale=textures[tid]['uvscale']
        material_ids.append(tid)
        obj.extend(['g group_'+str(gi)+'_'+group.get('role','part'),'usemtl tex_'+str(tid)])
        group_records.append({'index':gi,'role':group.get('role'),'cover':group.get('cover'), 'source_texture_index':tid,'quads':group['quads'],'compiled_sha256':sha(base64.b64decode(group['data']))})
        for quad in vertices(group):
            ids=[]
            for v in quad:
                obj.append('v '+' '.join(format(x,'.17g') for x in v['p']))
                obj.append('vt '+' '.join(format(v['uv'][axis]*uvscale[axis],'.17g') for axis in range(2)))
                obj.append('vn '+' '.join(format(x,'.17g') for x in v['n']))
                ids.append(str(idx)+'/'+str(idx)+'/'+str(idx));idx+=1
            obj.append('f '+' '.join(ids));quads+=1
    mtl=[]
    for tid in dict.fromkeys(material_ids):
        mtl.extend(['newmtl tex_'+str(tid),'Ka 0 0 0','Kd 1 1 1','Ks 0 0 0','d 1','illum 1','map_Kd '+textures[tid]['resource'],''])
    base.with_suffix('.obj').write_text('\n'.join(obj)+'\n')
    base.with_suffix('.mtl').write_text('\n'.join(mtl))
    model={'loader':'forge:obj','model':NS+':models/block/'+name+'.obj','automatic_culling':False,'shade_quads':True,'flip_v':False,'emissive_ambient':False,'textures':{'particle':textures[material_ids[0]]['resource']},'ambientocclusion':True}
    put_json(base.with_suffix('.json'),model)
    assert quads==sum(g['quads'] for g in payload['models'][ref]['groups'])
    return {'source_ref':ref,'resource':NS+':block/'+name,'source_quads':quads,'obj_faces':quads,'obj_vertices':idx-1,'obj_sha256':sha(base.with_suffix('.obj').read_bytes()),'groups':group_records}


def audit_export(payload,refs,textures):
    vertex_count=0;face_count=0;max_position=0;max_uv=0;max_normal=0
    for ref in refs:
        lines=(OUT/'assets'/NS/'models/block'/(model_name(ref)+'.obj')).read_text().splitlines()
        p=[];uv=[];n=[];faces=[]
        for l in lines:
            if l.startswith('v '):p.append(list(map(float,l.split()[1:])))
            elif l.startswith('vt '):uv.append(list(map(float,l.split()[1:])))
            elif l.startswith('vn '):n.append(list(map(float,l.split()[1:])))
            elif l.startswith('f '):faces.append(l.split()[1:])
        i=0;qi=0
        for g in payload['models'][ref]['groups']:
            scale=textures[g['texture']]['uvscale']
            for q in vertices(g):
                assert len(faces[qi])==4
                for v in q:
                    assert faces[qi][i%4]==f'{i+1}/{i+1}/{i+1}'
                    max_position=max(max_position,max(abs(a-b) for a,b in zip(p[i],v['p'])))
                    max_normal=max(max_normal,max(abs(a-b) for a,b in zip(n[i],v['n'])))
                    max_uv=max(max_uv,max(abs(uv[i][j]/scale[j]-v['uv'][j]) for j in range(2)))
                    i+=1
                qi+=1
        assert i==len(p)==len(uv)==len(n)
        assert qi==len(faces)
        vertex_count+=i;face_count+=qi
    assert max_position==0 and max_normal==0 and max_uv<3e-16
    return {'status':'PASS','tested_models':len(refs),'tested_vertices':vertex_count,'tested_quads':face_count,'all_source_quads_and_winding_retained':True,'max_decoded_position_error_blocks':max_position,'max_decoded_normal_error':max_normal,'max_source_uv_error_after_inverse_runtime_padding_scale':max_uv,'source_pngs_byte_exact':True,'runtime_padding_changes_only_extruded_edges':True,'alpha_geometric_clipping':False,'structural_scaling_or_clipping':False}


def main():
    source_bytes=SOURCE.read_bytes();payload=json.loads(source_bytes);scene_text=SCENE_SOURCE.read_text()
    WORK.mkdir(parents=True,exist_ok=True)
    canonical=WORK/'source';canonical.mkdir(exist_ok=True)
    (canonical/'material-payload-v17.json').write_bytes(source_bytes)
    (canonical/'approved-scene-functions.js').write_text(scene_text)
    (WORK/'pose-v17.js').write_text(POSE_JS)
    refs=[r for r in payload['models'] if not r.endswith('/em_railejector_base') and not r.endswith('/em_railejector_gun')]
    # Preserve every exact source PNG, including two comparison-model sprites in
    # the source archive; runtime emits only sprites used by approved new parts.
    used={g['texture'] for r in refs for g in payload['models'][r]['groups']}
    textures={}
    for tid,t in enumerate(payload['textures']):
        data=base64.b64decode(t['png'].split(',',1)[1]);assert sha(data)==t['sha256']
        (canonical/(str(tid)+'-'+sha(data)+'.png')).write_bytes(data)
        if tid not in used:continue
        assert t['frame']==[1,1],'Sprite animation requires explicit metadata preservation'
        im=Image.open(io.BytesIO(data)).convert('RGBA')
        padded,_,scale,changed=mip_safe_image(im,t['frameSize'],None)
        if changed:
            buf=io.BytesIO();padded.save(buf,format='PNG');runtime=buf.getvalue()
        else:runtime=data
        path=OUT/'assets'/NS/'textures/block'/('tex_'+sha(data)[:24]+'.png')
        path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(runtime)
        # Pixel-exact content check, plus every padding texel is edge extrusion.
        assert padded.crop((0,0,im.width,im.height)).tobytes()==im.tobytes()
        for y in range(padded.height):
            for x in range(padded.width):assert padded.getpixel((x,y))==im.getpixel((min(x,im.width-1),min(y,im.height-1)))
        textures[tid]={'source_index':tid,'source_ref':t['id'],'source_sha256':sha(data),'runtime_sha256':sha(runtime),'resource':NS+':block/'+path.stem,'source_size':list(im.size),'runtime_size':list(padded.size),'uvscale':list(scale),'edge_padding':changed,'source_pixels_exact':True}
    models=[export_model(payload,r,textures) for r in refs]
    # Root may parent an already-registered DCP model to this composite. Access
    # parts by these keys; do NOT render the combined identity root as a machine.
    children={model_name(r):{'parent':NS+':block/'+model_name(r)} for r in refs}
    put_json(OUT/'assets'/NS/'models/block/rail_parts.json',{'loader':'forge:composite','children':children})
    recipe={'schema':1,'namespace':NS,'source_payload_sha256':sha(source_bytes),'source_scene_sha256':sha(scene_text.encode()),'matrix_layout':'column-major16; block units','models':models,'textures':list(textures.values()),'composite':{'resource':NS+':block/rail_parts','children':children},'steady_state':{'ram':0,'recoil':0,'loaded':False,'tail_hatch':'closed','models':24,'instances':30},'native_input_mapping':{'yaw':'180-currentYaw','elevation':'90-currentPitch'},'fx':{'native_delegate_controller_Y_offset_blocks':1.25},'render_type':'cutout'}
    put_json(WORK/'recipe.json',recipe)
    audit=audit_export(payload,refs,textures)
    audit.update({'source_scene_sha256':recipe['source_scene_sha256'],'source_payload_sha256':recipe['source_payload_sha256'],'runtime_textures':len(textures),'padded_runtime_textures':sum(t['edge_padding'] for t in textures.values()),'all_loading_station_groups':27,'loading_station_quads':261,'pose_parity':'Run tests/test-rail-pose.js','not_game_validation':True})
    put_json(WORK/'export-audit.json',audit)
    assert SOURCE.read_bytes()==source_bytes and SCENE_SOURCE.read_text()==scene_text
    print(json.dumps({'pack_assets':str(OUT/'assets'/NS),'recipe':str(WORK/'recipe.json'),'pose':str(WORK/'pose-v17.js'),'export_audit':audit},ensure_ascii=False,indent=2))


if __name__=='__main__':main()
