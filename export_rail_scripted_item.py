#!/usr/bin/env python3
"""Add one inventory/hand model from the exact approved neutral 30 instances."""
from pathlib import Path
import hashlib
import json
import math
import sys

ROOT=Path(__file__).resolve().parent
WORK=ROOT/'work/scripted-rail'
ASSET=ROOT/'outputs/scripted-pack/assets/dcp_scripted_rail'
sys.path.insert(0,str(ROOT/'work'))
from export_obj import vertices


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def mul(a,b):return [sum(a[k*4+r]*b[c*4+k] for k in range(4)) for c in range(4) for r in range(4)]
def point(m,p):return [sum(m[c*4+r]*p[c] for c in range(3))+m[12+r] for r in range(3)]
def normal(m,n):
    v=[sum(m[c*4+r]*n[c] for c in range(3)) for r in range(3)]
    l=math.hypot(*v)
    return [x/l for x in v]


def display_rotation(rotation):
    x,y,z=[math.radians(d) for d in rotation]
    cx,sx,cy,sy,cz,sz=math.cos(x),math.sin(x),math.cos(y),math.sin(y),math.cos(z),math.sin(z)
    # ItemTransform uses Quaternionf.rotationXYZ, i.e. Rx*Ry*Rz.
    return [[cy*cz,-cy*sz,sy],[sx*sy*cz+cx*sz,-sx*sy*sz+cx*cz,-sx*cy],[-cx*sy*cz+sx*sz,cx*sy*sz+sx*cz,cx*cy]]


def main():
    before={str(p.relative_to(ASSET)):sha(p) for p in ASSET.rglob('*') if p.is_file() and p.stem!='item_assembled'}
    recipe=json.loads((WORK/'recipe.json').read_text())
    payload=json.loads((WORK/'source/material-payload-v17.json').read_text())
    poses=json.loads((WORK/'pose-samples.json').read_text())['poses']
    pose=next(p for p in poses if p['approvedYaw']==0 and p['approvedElevation']==0)
    parts=pose['parts'];assert len(parts)==30
    textures={t['source_index']:t for t in recipe['textures']}
    base=ASSET/'models/block/item_assembled'
    obj=['# Approved V17 neutral complete item; no original part geometry edited.','mtllib item_assembled.mtl']
    all_points=[];expected=[];source_quads=0;idx=1;used=[];placements=[]
    for instance,part in enumerate(parts):
        m=mul(pose['worldAdapter'],part['m']);ref=part['ref']
        placements.append({'index':instance,'source_ref':ref,'instance':part['instance'],'matrix_column_major':m})
        for gi,g in enumerate(payload['models'][ref]['groups']):
            tid=g['texture'];used.append(tid);scale=textures[tid]['uvscale']
            obj.extend(['g instance_'+str(instance)+'_'+ref+'_group_'+str(gi),'usemtl tex_'+str(tid)])
            for q in vertices(g):
                ids=[]
                for v in q:
                    p=point(m,v['p']);n=normal(m,v['n']);uv=[v['uv'][i]*scale[i] for i in range(2)]
                    all_points.append(p);expected.append((p,n,uv))
                    obj.append('v '+' '.join(format(x,'.17g') for x in p))
                    obj.append('vt '+' '.join(format(x,'.17g') for x in uv))
                    obj.append('vn '+' '.join(format(x,'.17g') for x in n))
                    ids.append(f'{idx}/{idx}/{idx}');idx+=1
                obj.append('f '+' '.join(ids));source_quads+=1
    base.with_suffix('.obj').write_text('\n'.join(obj)+'\n')
    mtl=[]
    for tid in dict.fromkeys(used):mtl.extend(['newmtl tex_'+str(tid),'Ka 0 0 0','Kd 1 1 1','Ks 0 0 0','d 1','illum 1','map_Kd '+textures[tid]['resource'],''])
    base.with_suffix('.mtl').write_text('\n'.join(mtl))
    lo=[min(p[i] for p in all_points) for i in range(3)];hi=[max(p[i] for p in all_points) for i in range(3)]
    center=[(a+b)/2 for a,b in zip(lo,hi)];span=[b-a for a,b in zip(lo,hi)];size=max(span)
    profiles={
        'gui':([30,225,0],[0,0,0],.625),
        'ground':([0,0,0],[0,3,0],.25),
        'fixed':([0,0,0],[0,0,0],.5),
        'head':([0,0,0],[0,0,0],1),
        'thirdperson_righthand':([75,45,0],[0,2.5,0],.375),
        'thirdperson_lefthand':([75,45,0],[0,2.5,0],.375),
        'firstperson_righthand':([0,45,0],[0,0,0],.4),
        'firstperson_lefthand':([0,225,0],[0,0,0],.4),
    }
    display={};display_audit={}
    for key,(rot,target,vanilla_scale) in profiles.items():
        # Vanilla mirrors translationX and rotationY/Z for left-hand contexts.
        left=key.endswith('lefthand')
        actual_rot=[rot[0],-rot[1],-rot[2]] if left else rot
        r=display_rotation(actual_rot)
        rotated=[[sum(r[i][j]*(p[j]-center[j]) for j in range(3)) for i in range(3)] for p in all_points]
        rotated_span=[max(p[i] for p in rotated)-min(p[i] for p in rotated) for i in range(3)]
        scale=vanilla_scale/size
        if key=='gui':scale=1.05/max(rotated_span[:2])
        # ItemRenderer translates the unmodified model by(-.5,-.5,-.5) after
        # display transforms. Compensate its actual full-machine center here.
        compensation=[sum(r[i][j]*(center[j]-.5) for j in range(3))*scale for i in range(3)]
        translation=[target[i]-16*compensation[i] for i in range(3)]
        if left:translation[0]=-translation[0]
        display[key]={'rotation':rot,'translation':translation,'scale':[scale]*3}
        display_audit[key]={'uniform_display_scale':scale,'projected_span_blocks':[x*scale for x in rotated_span],'center_after_display_blocks':[x/16 for x in target]}
    doc={'loader':'forge:obj','model':'dcp_scripted_rail:models/block/item_assembled.obj','automatic_culling':False,'shade_quads':True,'flip_v':False,'emissive_ambient':False,'textures':{'particle':textures[used[0]]['resource']},'ambientocclusion':True,'gui_light':'front','display':display}
    base.with_suffix('.json').write_text(json.dumps(doc,indent=2)+'\n')
    # Re-read the ordinary OBJ and compare every transformed approved point,
    # UV and rendered normal direction, not just min/max bounds.
    positions=[];uvs=[];normals=[];faces=[]
    for l in base.with_suffix('.obj').read_text().splitlines():
        if l.startswith('v '):positions.append(list(map(float,l.split()[1:])))
        elif l.startswith('vt '):uvs.append(list(map(float,l.split()[1:])))
        elif l.startswith('vn '):normals.append(list(map(float,l.split()[1:])))
        elif l.startswith('f '):faces.append(l.split()[1:])
    assert len(expected)==len(positions)==len(uvs)==len(normals)
    errp=max(abs(a-b) for v,(p,n,u) in enumerate(expected) for a,b in zip(positions[v],p))
    errn=max(abs(a-b) for v,(p,n,u) in enumerate(expected) for a,b in zip(normals[v],n))
    erru=max(abs(a-b) for v,(p,n,u) in enumerate(expected) for a,b in zip(uvs[v],u))
    assert errp==errn==erru==0 and source_quads==6627==len(faces)
    for qi,f in enumerate(faces):assert f==[f'{qi*4+j+1}/{qi*4+j+1}/{qi*4+j+1}' for j in range(4)]
    after={str(p.relative_to(ASSET)):sha(p) for p in ASSET.rglob('*') if p.is_file() and p.stem!='item_assembled'}
    assert before==after,'Original rigid assets unexpectedly changed'
    audit={'status':'PASS','resource':'dcp_scripted_rail:block/item_assembled','approved_pose':{'yaw':0,'elevation':0,'ram':0,'recoil':0,'loaded':False,'native_yaw':180,'native_pitch':90,'worldAdapter':'AroundY(+90deg,[.5,0,.5])'},'source_instances':30,'all_original_parts_included':True,'full_quads':source_quads,'vertices':len(expected),'bounds_blocks':[lo,hi],'display':display_audit,'placements':placements,'max_transformed_source_position_error_blocks':errp,'max_transformed_normal_direction_error':errn,'max_compensated_uv_error':erru,'all_faces_order_winding_and_alpha_quads_preserved':True,'geometry_scale_for_inventory_only':'NONE; ordinary display transforms uniformly fit full existing assembly. No source component is resized or moved.','existing_rigid_assets_unchanged':before,'new_obj_sha256':sha(base.with_suffix('.obj')),'not_game_validation':True}
    (WORK/'item-assembled-audit.json').write_text(json.dumps(audit,indent=2)+'\n')
    manifest=json.loads((WORK/'assets-manifest.json').read_text()) if (WORK/'assets-manifest.json').exists() else {'namespace':'dcp_scripted_rail','files':{},'models':25}
    manifest['files']={str(p.relative_to(ASSET)):sha(p) for p in sorted(ASSET.rglob('*')) if p.is_file()}
    manifest['models']=26
    manifest['assembled_item']={'resource':'dcp_scripted_rail:block/item_assembled','audit':'work/scripted-rail/item-assembled-audit.json','source_instances':30,'source_quads':source_quads}
    (WORK/'assets-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print(json.dumps({'resource':audit['resource'],'full_quads':source_quads,'vertices':len(expected),'bounds_blocks':[lo,hi],'gui_display':display_audit['gui'],'all_existing_rigid_assets_unchanged':True,'obj_sha256':audit['new_obj_sha256'],'asset_manifest_files':len(manifest['files'])},indent=2))


if __name__=='__main__':main()
