"""Export compiled model quads through the builtin OBJ loader.

Placements use 4x4 row-major matrices in block units. Runtime poses are external.
Alpha-aware clients retain complete source quads with cutout=False.
Sprite edge padding keeps source pixels and compensates their UV domain.
"""
from pathlib import Path
import base64,hashlib,io,json,math,struct
from PIL import Image

IDENTITY=[[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]
def sha(b):return hashlib.sha256(b).hexdigest()
def point(m,p):return[sum(m[i][j]*p[j]for j in range(3))+m[i][3]for i in range(3)]
def vector(m,p):
 q=[sum(m[i][j]*p[j]for j in range(3))for i in range(3)];l=math.sqrt(sum(v*v for v in q));return[v/l for v in q]
def vertices(group,frame_size=None):
 raw=base64.b64decode(group['data']);assert len(raw)==group['quads']*64
 for start in range(0,len(raw),64):
  quad=[]
  for v in struct.iter_unpack('<6h2H',raw[start:start+64]):
   uv=[x/65535 for x in v[6:]]
   if frame_size:
    for axis,size in enumerate(frame_size):
     exact=round(uv[axis]*size)/size
     if abs(exact-uv[axis])<=.5/65535+1e-10:uv[axis]=exact
   quad.append({'p':[x/4096 for x in v[:3]],'n':[x/32767 for x in v[3:6]],'uv':uv})
  yield quad
def clip(poly,axis,bound,positive):
 out=[]
 for a,b in zip(poly,poly[1:]+poly[:1]):
  aa=a['uv'][axis]-bound;bb=b['uv'][axis]-bound;inside_a=aa>=-1e-12 if positive else aa<=1e-12;inside_b=bb>=-1e-12 if positive else bb<=1e-12
  if inside_a:out.append(a)
  if inside_a!=inside_b:
   t=aa/(aa-bb);out.append({k:[x+t*(y-x)for x,y in zip(a[k],b[k])]for k in('p','n','uv')})
 return out
def area(poly):
 total=0
 for a,b in zip(poly[1:-1],poly[2:]):
  u=[a['p'][i]-poly[0]['p'][i]for i in range(3)];v=[b['p'][i]-poly[0]['p'][i]for i in range(3)]
  c=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];total+=math.sqrt(sum(x*x for x in c))/2
 return total
def alpha_pieces(poly,tex,cutout):
 if not cutout:return[poly]
 fw,fh=tex['frameSize'];a=tex['_alpha'];us=[v['uv'][0]for v in poly];vs=[v['uv'][1]for v in poly]
 xr=range(max(0,math.floor(min(us)*fw+1e-8)),min(fw,math.ceil(max(us)*fw-1e-8)))
 yr=range(max(0,math.floor(min(vs)*fh+1e-8)),min(fh,math.ceil(max(vs)*fh-1e-8)))
 if all(a.getpixel((x,y))>=26 for x in xr for y in yr):return[poly]
 # Merge identical horizontal opaque runs across rows. This preserves every
 # alpha hole and UV while avoiding one mesh face for each opaque pixel.
 rectangles=[];active={}
 for y in yr:
  runs=[];begin=None
  for x in xr:
   opaque=a.getpixel((x,y))>=26
   if opaque and begin is None:begin=x
   if begin is not None and(not opaque or x==xr.stop-1):
    end=x if not opaque else x+1;runs.append((begin,end));begin=None
  for run,rect in list(active.items()):
   if run not in runs:rectangles.append(rect);del active[run]
  for run in runs:
   if run in active:active[run][3]=y+1
   else:active[run]=[run[0],y,run[1],y+1]
 rectangles.extend(active.values());result=[]
 for x,y,X,Y in rectangles:
  part=poly
  for axis,bound,positive in((0,x/fw,True),(0,X/fw,False),(1,y/fh,True),(1,Y/fh,False)):
   if not part:break
   part=clip(part,axis,bound,positive)
  if len(part)>=3 and area(part)>1e-12:result.append(part)
 return result
def mip_safe_image(im,frame_size,metadata):
 """Pad sprite edges to multiples of16; never resample approved pixels.

 The UV domain is shortened to the old content region. Edge extrusion keeps
 all4 mip levels valid without changing the user's global graphics settings.
 """
 fw,fh=frame_size;nw=math.ceil(fw/16)*16;nh=math.ceil(fh/16)*16
 if(nw,nh)==(fw,fh):return im,metadata,(1,1),False
 assert im.width%fw==0 and im.height%fh==0,(im.size,frame_size)
 cols,rows=im.width//fw,im.height//fh
 out=Image.new('RGBA',(cols*nw,rows*nh))
 for y in range(rows):
  for x in range(cols):
   src=im.crop((x*fw,y*fh,(x+1)*fw,(y+1)*fh));xx=x*nw;yy=y*nh;out.paste(src,(xx,yy))
   if nw>fw:out.paste(src.crop((fw-1,0,fw,fh)).resize((nw-fw,fh),Image.Resampling.NEAREST),(xx+fw,yy))
   if nh>fh:out.paste(src.crop((0,fh-1,fw,fh)).resize((fw,nh-fh),Image.Resampling.NEAREST),(xx,yy+fh))
   if nw>fw and nh>fh:out.paste(Image.new('RGBA',(nw-fw,nh-fh),src.getpixel((fw-1,fh-1))),(xx+fw,yy+fh))
   assert out.crop((xx,yy,xx+fw,yy+fh)).tobytes()==src.tobytes()
 if metadata is not None:
  metadata=json.loads(json.dumps(metadata));metadata.setdefault('animation',{}).update(width=nw,height=nh)
 return out,metadata,(fw/nw,fh/nh),True
def export_slot(payload,placements,pack,resource,*,cutout=True):
 """placements=[{'model':key,'matrix':rowmajor4x4,'role':optional}]."""
 pack=Path(pack);ns,name=resource.split(':',1);base=pack/'assets'/ns/'models'/name;base.parent.mkdir(parents=True,exist_ok=True)
 textures=payload['textures'];used={};obj=['# Compiled model for independent client rendering','mtllib '+base.with_suffix('.mtl').name];idx=1;source_quads=0;faces=0;removed_area=0
 for n,placement in enumerate(placements):
  matrix=placement.get('matrix',IDENTITY);assert len(matrix)==4 and all(len(a)==4 for a in matrix)
  model=payload['models'][placement['model']];obj.append('g part_'+str(n)+'_'+placement['model'].replace(':','_').replace('/','_'))
  for group in model['groups']:
   if placement.get('role')and group.get('role')!=placement['role']:continue
   tid=group['texture'];tex=textures[tid]
   if tid not in used:
    data=base64.b64decode(tex['png'].split(',',1)[1]);assert sha(data)==tex['sha256'];im=Image.open(io.BytesIO(data)).convert('RGBA');tex['_alpha']=im.getchannel('A').crop((0,0,*tex['frameSize']))
    metadata=None
    # Preserve native sprite animation metadata if present at any exact source.
    for asset_root in placement.get('asset_roots',[]):
     for ref in tex.get('aliases',[tex['id']]):
      tns,tn=ref.split(':',1);p=Path(asset_root)/tns/'textures'/(tn+'.png.mcmeta')
      if p.is_file():metadata=json.loads(p.read_text());break
     if metadata is not None:break
    padded,metadata,uvscale,changed=mip_safe_image(im,tex['frameSize'],metadata)
    if changed:
     result=io.BytesIO();padded.save(result,format='PNG');result=result.getvalue()
    else:result=data
    alias='dcp_native_pack:block/tex_'+sha(result)[:24];out=pack/'assets/dcp_native_pack/textures/block'/('tex_'+sha(result)[:24]+'.png');out.parent.mkdir(exist_ok=True,parents=True);out.write_bytes(result)
    if metadata is not None:out.with_suffix('.png.mcmeta').write_text(json.dumps(metadata,separators=(',',':'))+'\n')
    used[tid]={'ref':alias,'sha256':sha(result),'source_sha256':sha(data),'source_ref':tex['id'],'uvscale':uvscale,'native_pixels_exact':True,'mip_edge_padding':changed}
   obj.append('usemtl tex_'+str(tid))
   for poly in vertices(group,tex['frameSize']):
    source_quads+=1;pieces=alpha_pieces(poly,tex,cutout);removed_area+=area(poly)-sum(area(q)for q in pieces)
    for q in pieces:
     # The OBJ loader can bake triangles; split any clipped larger polygon.
     polygons=[q]if len(q)<=4 else[[q[0],q[j],q[j+1]]for j in range(1,len(q)-1)]
     for part in polygons:
      if area(part)<1e-12:continue
      ids=[]
      for v in part:
       p=point(matrix,v['p']);normal=vector(matrix,v['n']);uv=[a*b for a,b in zip(v['uv'],used[tid]['uvscale'])];obj.append('v '+' '.join(format(x,'.10g')for x in p));obj.append('vt '+' '.join(format(x,'.10g')for x in uv));obj.append('vn '+' '.join(format(x,'.10g')for x in normal));ids.append(str(idx)+'/'+str(idx)+'/'+str(idx));idx+=1
      obj.append('f '+' '.join(ids));faces+=1
 mtl=[]
 for tid,tex in used.items():mtl.extend(['newmtl tex_'+str(tid),'Ka 0 0 0','Kd 1 1 1','Ks 0 0 0','d 1','illum 1','map_Kd '+tex['ref'],''])
 base.with_suffix('.obj').write_text('\n'.join(obj)+'\n');base.with_suffix('.mtl').write_text('\n'.join(mtl))
 doc={'loader':'neoforge:obj','model':ns+':models/'+name+'.obj','automatic_culling':False,'shade_quads':True,'flip_v':False,'emissive_ambient':False,'textures':{'particle':next(iter(used.values()))['ref']},'ambientocclusion':True}
 base.with_suffix('.json').write_text(json.dumps(doc,indent=2)+'\n')
 return{'resource':resource,'source_quads':source_quads,'obj_faces':faces,'alpha_hole_area_blocks2':removed_area,'textures':list(used.values()),'obj_sha256':sha(base.with_suffix('.obj').read_bytes())}
