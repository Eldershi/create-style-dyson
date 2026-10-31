"""Exact approved V6 receiver parts for the existing KubeJS client renderer.

Source-local meshes and original PNGs are exported for the client pose renderer.
This module writes model assets and pose data; it does not install client files.
"""
from pathlib import Path
import copy
import hashlib
import json
import math
import shutil
import sys
import numpy as np

ROOT=Path(__file__).resolve().parent
from private_inputs import input_root
PRIVATE=input_root()
REC=PRIVATE/'receiver'
WORK=ROOT/'work/scripted-receiver'
TEMP=WORK/'export-tmp'
OUT=ROOT/'outputs/scripted-pack'
sys.path.insert(0,str(ROOT/'work'))
from export_obj import export_slot,vertices,point,vector
from pose_math import T,R,A,matrix_blocks,clean,sha

CUSTOM=['base_frame','deck','bearing_fixed','bearing_rotor','bearing_spacer','upper_fork','upper_head','hydraulic_fixed_mounts','hydraulic_cranks','hydraulic_eye_base','hydraulic_eye_rod','hydraulic_base_pin','hydraulic_barrel_skin','hydraulic_rod_skin','deck_wire_north','controller_output_socket','transformer_left','transformer_right','transformer_coil1','transformer_coil2','transformer_saddles','transformer_bridge_supports','central_energy_hose']
SOURCE={n:'dcp_preview:block/'+n for n in CUSTOM}
SOURCE['metal_bearing_plate']='aeronautics:block/gyroscopic_propeller_bearing/metal_bearing_plate'
SOURCE['connector_small_passive']='createaddition:block/connector/small/passive'
MODEL={n:'dcp_scripted_receiver:block/'+n for n in SOURCE}
ITEM_MODEL='dcp_scripted_receiver:block/item_assembled'
XS=[-13,-7,23,29]


def native_pose(current_pitch,mode='linear_70'):
    wrapped=(float(current_pitch)+180)%360-180
    elevation=max(0.,90-abs(wrapped))
    pitch=elevation*70/90 if mode=='linear_70' else min(70.,elevation) if mode=='clamp_70' else elevation
    return {'native_currentPitch':float(current_pitch),'physical_solar_elevation_deg':elevation,'source_pitch_deg':pitch,'source_preview_yaw_deg':0.,'mapping':mode}


def scene(pitch_deg,yaw_deg=0.):
    out=[]
    def add(name,M,role,ident=None):
        b=np.array(matrix_blocks(M))
        out.append({'id':ident or name,'part':name,'model':MODEL[name],'source_ref':SOURCE[name],'role':role,'matrix_pixels_row_major':clean(M),'matrix_blocks_row_major':b.tolist(),'matrix_blocks_column_major':b.T.flatten().tolist()})
    yaw=A('y',yaw_deg,[8,0,8]);frame=T(0,59,0)@yaw;pitch=A('x',-pitch_deg,[8,24,8])
    add('base_frame',np.eye(4),'fixed')
    add('deck',T(0,32,0),'fixed')
    add('controller_output_socket',np.eye(4),'fixed_output')
    for deg in [0,180]:
        radial=A('y',deg,[8,0,8])
        add('deck_wire_north',T(0,32,0)@radial@T(0,0,-8),'fixed_hoses',f'deck_hoses_{deg}')
        for x in [4,8,12]:add('connector_small_passive',radial@T(x,38,0)@R('x',-90)@T(-8,0,-8),'fixed_terminal',f'deck_connector_{deg}_{x}')
    add('metal_bearing_plate',T(0,24,0),'fixed')
    add('bearing_spacer',T(0,40,0),'fixed')
    add('bearing_fixed',T(0,43,0),'fixed')
    add('bearing_rotor',T(0,43,0)@yaw,'source_yaw_only')
    add('transformer_bridge_supports',np.eye(4),'fixed')
    for x in [-10,26]:
        unit=T(x,28,8)@R('z',12 if x<0 else -12)@T(-8,0,-8)
        for n in ['transformer_left' if x<0 else 'transformer_right','transformer_coil1','transformer_coil2','transformer_saddles']:
            add(n,unit,'fixed_transformer',f'{n}_{x}')
    add('upper_fork',frame,'source_yaw_only')
    add('upper_head',frame@T(0,16,0)@A('x',-pitch_deg,[8,8,8]),'source_head_pitch')
    add('central_energy_hose',frame,'source_yaw_only_static_energy_lead')
    add('hydraulic_fixed_mounts',frame,'source_yaw_only')
    add('hydraulic_cranks',frame@pitch,'source_head_pitch')
    for x in [-10,26]:add('hydraulic_base_pin',frame@T(x,11,8)@(R('y',180) if x==26 else np.eye(4)),'source_yaw_only',f'lower_pin_bank_{x}')
    a=math.radians(pitch_deg)
    for x in XS:
        B=np.array([x,11,8.]);Q=np.array([x,24+8*math.sin(a),8+8*math.cos(a)])
        u=(Q-B)/np.linalg.norm(Q-B);alpha=math.degrees(math.atan2(u[2],u[1]));rot=R('x',alpha)
        for name,origin in [('hydraulic_barrel_skin',B+u),('hydraulic_rod_skin',Q-u),('hydraulic_eye_base',B),('hydraulic_eye_rod',Q)]:
            add(name,frame@T(*origin)@rot,'two_endpoint_IK',f'{name}_{x}')
    assert len(out)==47
    return out


def pose_js():
    # Plain ES5 arithmetic only; root owns KubeJS event/API registration.
    return '''// Exact approved receiver V6 pose graph. Pure arithmetic; no game API or mod.
// Coordinates are source pixels internally; .matrix is column-major BLOCK units,
// matching JOML Matrix4f.set(float[]) and the scripted rail pose interface.
var DCP_RECEIVER_V6_POSE=(function(){
var refs=__MODELS__;
function I(){return [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];}
function T(x,y,z){var m=I();m[3]=x;m[7]=y;m[11]=z;return m;}
function mul(a,b){var m=[],i,j,k;for(i=0;i<4;i++)for(j=0;j<4;j++){var s=0;for(k=0;k<4;k++)s+=a[4*i+k]*b[4*k+j];m[4*i+j]=s;}return m;}
function chain(){var m=I();for(var i=0;i<arguments.length;i++)m=mul(m,arguments[i]);return m;}
function R(axis,deg){var c=Math.cos(deg*Math.PI/180),s=Math.sin(deg*Math.PI/180);return axis==='x'?[1,0,0,0,0,c,-s,0,0,s,c,0,0,0,0,1]:axis==='y'?[c,0,s,0,0,1,0,0,-s,0,c,0,0,0,0,1]:[c,-s,0,0,s,c,0,0,0,0,1,0,0,0,0,1];}
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
var banks=[-13,-7,23,29],a=p*Math.PI/180;for(i=0;i<banks.length;i++){x=banks[i];var B=[x,11,8],Q=[x,24+8*Math.sin(a),8+8*Math.cos(a)],d=[0,Q[1]-B[1],Q[2]-B[2]],L=Math.sqrt(d[1]*d[1]+d[2]*d[2]),u=[0,d[1]/L,d[2]/L],rot=R('x',Math.atan2(u[2],u[1])*180/Math.PI);
add('hydraulic_barrel_skin',chain(frame,T(B[0]+u[0],B[1]+u[1],B[2]+u[2]),rot),'hydraulic_barrel_skin_'+x);add('hydraulic_rod_skin',chain(frame,T(Q[0]-u[0],Q[1]-u[1],Q[2]-u[2]),rot),'hydraulic_rod_skin_'+x);add('hydraulic_eye_base',chain(frame,T(B[0],B[1],B[2]),rot),'hydraulic_eye_base_'+x);add('hydraulic_eye_rod',chain(frame,T(Q[0],Q[1],Q[2]),rot),'hydraulic_eye_rod_'+x);}
return result;}
return {models:refs,nativePose:nativePose,scene:scene,fromNative:function(P,mode){var q=nativePose(P,mode);return scene(q.sourcePitch,0);}};
})();
'''.replace('__MODELS__',json.dumps(MODEL,separators=(',',':')))


def main():
    WORK.mkdir(parents=True,exist_ok=True)
    if TEMP.exists():shutil.rmtree(TEMP)
    data=json.loads((REC/'payload.json').read_text())
    assert all(ref in data['models'] for ref in SOURCE.values())
    source_archive=WORK/'source';source_archive.mkdir(exist_ok=True)
    shutil.copy2(REC/'payload.json',source_archive/'native-payload.json')
    for ref in SOURCE.values():
        ns,path=ref.split(':');p=REC/'assets'/ns/'models'/(path+'.json');q=source_archive/'models'/ns/(path+'.json');q.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,q)
    exported={}
    for name,ref in SOURCE.items():
        exported[name]=export_slot(data,[{'model':ref,'matrix':np.eye(4).tolist(),'asset_roots':[str(REC/'assets')]}],TEMP,MODEL[name],cutout=False)
        p=TEMP/'assets/dcp_scripted_receiver/models/block'/(name+'.json');doc=json.loads(p.read_text());doc['loader']='forge:obj';doc['render_type']='minecraft:cutout';doc['textures']={k:v.replace('dcp_native_pack:','dcp_scripted_receiver:') for k,v in doc['textures'].items()};p.write_text(json.dumps(doc,indent=2)+'\n')
        mtl=p.with_suffix('.mtl');mtl.write_text(mtl.read_text().replace('dcp_native_pack:','dcp_scripted_receiver:'))
        for t in exported[name]['textures']:t['ref']=t['ref'].replace('dcp_native_pack:','dcp_scripted_receiver:')
    neutral=scene(0,0);world_vertices=[]
    for instance in neutral:
        M=np.array(instance['matrix_pixels_row_major'])
        for group in data['models'][instance['source_ref']]['groups']:
            for quad in vertices(group):
                for v in quad:world_vertices.append((M@np.array([*[x*16 for x in v['p']],1.]))[:3])
    world_vertices=np.array(world_vertices);lo=world_vertices.min(axis=0);hi=world_vertices.max(axis=0);centre=(lo+hi)/2
    rebase=T(*(np.array([8.,8.,8.])-centre))
    item_placements=[{'model':i['source_ref'],'matrix':matrix_blocks(rebase@np.array(i['matrix_pixels_row_major'])),'asset_roots':[str(REC/'assets')]} for i in neutral]
    exported['item_assembled']=export_slot(data,item_placements,TEMP,ITEM_MODEL,cutout=False)
    item_json=TEMP/'assets/dcp_scripted_receiver/models/block/item_assembled.json'
    item_doc=json.loads(item_json.read_text());item_doc['loader']='forge:obj';item_doc['render_type']='minecraft:cutout';item_doc['textures']={k:v.replace('dcp_native_pack:','dcp_scripted_receiver:') for k,v in item_doc['textures'].items()}
    item_doc['display']={
        'gui':{'rotation':[25,225,0],'translation':[0,0,0],'scale':[.14,.14,.14]},
        'ground':{'rotation':[0,0,0],'translation':[0,6,0],'scale':[.10,.10,.10]},
        'fixed':{'rotation':[0,180,0],'translation':[0,0,0],'scale':[.14,.14,.14]},
        'thirdperson_righthand':{'rotation':[75,45,0],'translation':[0,2.5,0],'scale':[.10,.10,.10]},
        'thirdperson_lefthand':{'rotation':[75,225,0],'translation':[0,2.5,0],'scale':[.10,.10,.10]},
        'firstperson_righthand':{'rotation':[0,45,0],'translation':[0,0,0],'scale':[.12,.12,.12]},
        'firstperson_lefthand':{'rotation':[0,225,0],'translation':[0,0,0],'scale':[.12,.12,.12]},
    }
    item_json.write_text(json.dumps(item_doc,indent=2)+'\n')
    item_mtl=item_json.with_suffix('.mtl');item_mtl.write_text(item_mtl.read_text().replace('dcp_native_pack:','dcp_scripted_receiver:'))
    for t in exported['item_assembled']['textures']:t['ref']=t['ref'].replace('dcp_native_pack:','dcp_scripted_receiver:')
    src_tex=TEMP/'assets/dcp_native_pack/textures';dst_tex=TEMP/'assets/dcp_scripted_receiver/textures'
    shutil.move(str(src_tex),str(dst_tex))
    composite={'loader':'forge:composite','children':{name:{'parent':ref} for name,ref in MODEL.items()}}
    (TEMP/'assets/dcp_scripted_receiver/models/block/receiver_parts.json').write_text(json.dumps(composite,indent=2)+'\n')
    used={t['source_sha256'] for slot in exported.values() for t in slot['textures']}
    texture_archive=[]
    for t in data['textures']:
        if t['sha256'] not in used:continue
        ns,path=t['id'].split(':');png=REC/'assets'/ns/'textures'/(path+'.png');assert sha(png)==t['sha256']
        canonical=source_archive/'textures'/ns/(path+'.png');canonical.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(png,canonical)
        meta=Path(str(png)+'.mcmeta');metadata=None
        if meta.exists():shutil.copy2(meta,Path(str(canonical)+'.mcmeta'));metadata=json.loads(meta.read_text())
        texture_archive.append({'source_ref':t['id'],'aliases':t.get('aliases',[]),'canonical_png':str(canonical),'PNG_sha256':t['sha256'],'sheet_size':t['size'],'frame_size':t['frameSize'],'frame_ratio':t['frame'],'frame_count':(t['size'][0]//t['frameSize'][0])*(t['size'][1]//t['frameSize'][1]),'source_mcmeta':metadata,'source_mcmeta_sha256':sha(meta) if meta.exists() else None})
    merged=[];existing_equal=[]
    for src in (TEMP/'assets').rglob('*'):
        if not src.is_file():continue
        rel=src.relative_to(TEMP);dst=OUT/rel
        if dst.exists() and dst.read_bytes()==src.read_bytes():existing_equal.append(str(rel));continue
        own=rel.parts[:2]==('assets','dcp_scripted_receiver')
        if dst.exists() and not own:raise ValueError('Refusing to overwrite another exporter shared asset: '+str(dst))
        dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst);merged.append(str(rel))
    samples={str(P):{mode:native_pose(P,mode) for mode in ['linear_70','clamp_70','unsafe_raw_90']} for P in [270,315,350,0,45,80,90,180,360]}
    contract={'status':'EXPORTED','source_payload_sha256':sha(REC/'payload.json'),'models':MODEL,'source_refs':SOURCE,'composite_root':'dcp_scripted_receiver:block/receiver_parts','unique_model_count':25,'draw_instances_per_frame':47,'render_buffer_required':'cutout','native_mapping':'linear70; sourceYaw0','canonical_textures_and_frames':texture_archive,'slots':exported,'item_assembled':{'model':ITEM_MODEL,'instances':47,'source_pitch_deg':0,'source_yaw_deg':0,'source_world_bounds_px':[lo.tolist(),hi.tolist()],'item_common_rebase_pixels_row_major':clean(rebase),'item_centre_blocks':[.5,.5,.5],'display':item_doc['display'],'placements':item_placements}}
    (WORK/'pose_contract.json').write_text(json.dumps(contract,ensure_ascii=False,indent=2)+'\n')
    (WORK/'item_manifest.json').write_text(json.dumps({'status':'EXPORTED_EXACT_NEUTRAL47_ITEM_AUDIT_PENDING','item':contract['item_assembled'],'slot':exported['item_assembled'],'root_item_parent':'dysoncubeproject:models/item/ray_receiver_controller.json'},ensure_ascii=False,indent=2)+'\n')
    (WORK/'receiver_pose.js').write_text(pose_js())
    print(json.dumps({'status':contract['status'],'models':25,'instances':47,'contract':str(WORK/'pose_contract.json'),'pose_js':str(WORK/'receiver_pose.js'),'assets':str(OUT/'assets')},ensure_ascii=False))


if __name__=='__main__':main()
