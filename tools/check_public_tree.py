"""Validate the complete source/resource publication and its declared safe scope."""
from pathlib import Path, PurePosixPath
import argparse, base64, hashlib, io, json, math, re
from PIL import Image

GENERATED={'.git','outputs','releases','__pycache__','.venv'}
CODE_ROOTS={'src','client','tests','tools','licenses','previews','docs'}
ROOT_SUFFIXES={'.py','.md','.json','.txt'}
ROOT_NAMES={'.gitignore','LICENSE','NOTICE'}
TEXT_SUFFIXES={'.py','.js','.cjs','.java','.json','.md','.txt','.obj','.mtl','.mcmeta'}
ABSOLUTE_LOCAL=re.compile(r'/(?:Users|home)/[^/\s]+/|/private/(?:tmp|var)/|file:\x2f\x2f')

def sha(data):return hashlib.sha256(data).hexdigest()
def insist(ok,message):
    if not ok:raise ValueError(message)
def files(root):return {p.relative_to(root).as_posix():p for p in root.rglob('*')if p.is_file()}
def png(data,label):
    insist(len(data)<=32*1024*1024,label+': image exceeds32MiB')
    with Image.open(io.BytesIO(data))as im:
        insist(im.format=='PNG',label+': PNG signature/format mismatch')
        insist(0<im.width<=16384 and 0<im.height<=16384 and im.width*im.height<=64000000,label+': unsafe image dimensions')
        im.verify()
    with Image.open(io.BytesIO(data))as im:im.load();return list(im.size)
def locked_tree(root,pins,label):
    actual=files(root)
    insist(set(actual)==set(pins),label+': undeclared or missing paths '+str(sorted(set(actual)^set(pins))))
    for name,p in actual.items():
        pure=PurePosixPath(name)
        insist(not pure.is_absolute()and '..'not in pure.parts,label+': unsafe path '+name)
        insist(not p.is_symlink(),label+': symbolic links are not allowed '+name)
        insist(sha(p.read_bytes())==pins[name],label+': SHA mismatch '+name)
    return actual

def resource_path(root,ref,kind):
    insist(re.fullmatch(r'[a-z0-9_.-]+:[a-z0-9_./-]+',ref)is not None,'Invalid resource identifier '+ref)
    ns,part=ref.split(':',1)
    insist('..'not in PurePosixPath(part).parts,'Unsafe resource identifier '+ref)
    return root/'assets'/ns/(('textures/'+part+'.png')if kind=='texture'else('models/'+part+'.json')if kind=='json'else part)

def check_parents(value,resource_root,label):
    if isinstance(value,dict):
        parent=value.get('parent')
        if isinstance(parent,str)and parent not in ['block/block','minecraft:block/block']:
            insist(resource_path(resource_root,parent,'json').is_file(),label+': missing parent model '+parent)
        for child in value.values():check_parents(child,resource_root,label)
    elif isinstance(value,list):
        for child in value:check_parents(child,resource_root,label)

def check_obj(path,resource_root):
    counts={'v':0,'vt':0,'vn':0,'f':0};materials=set();used=set();libraries=[]
    for line in path.read_text().splitlines():
        fields=line.split()
        if not fields or fields[0].startswith('#'):continue
        cmd,*values=fields
        if cmd in ['v','vn','vt']:
            insist(len(values)==(2 if cmd=='vt' else 3),str(path.name)+': malformed '+cmd)
            insist(all(math.isfinite(float(x))for x in values),str(path.name)+': nonfinite vertex')
            counts[cmd]+=1
        elif cmd=='mtllib':
            insist(len(values)==1 and PurePosixPath(values[0]).name==values[0],path.name+': unsafe material library')
            libraries.append(path.parent/values[0])
        elif cmd=='usemtl':used.add(' '.join(values))
        elif cmd=='f':
            insist(len(values)in [3,4],path.name+': face is not triangle/quad')
            for token in values:
                indices=token.split('/');insist(len(indices)==3,path.name+': incomplete face indices')
                for kind,index in zip(['v','vt','vn'],indices):
                    insist(1<=int(index)<=counts[kind],path.name+': index outside '+kind)
            counts['f']+=1
        elif cmd not in ['o','g','s']:raise ValueError(path.name+': unknown OBJ command '+cmd)
    insist(counts['f']>0 and libraries,path.name+': empty/untextured mesh')
    for library in libraries:
        insist(library.is_file(),path.name+': missing MTL')
        for line in library.read_text().splitlines():
            fields=line.split()
            if not fields:continue
            if fields[0]=='newmtl':materials.add(' '.join(fields[1:]))
            elif fields[0]=='map_Kd':
                insist(len(fields)==2,library.name+': malformed texture reference')
                insist(resource_path(resource_root,fields[1],'texture').is_file(),library.name+': missing texture '+fields[1])
    insist(used<=materials,path.name+': missing material names')
    return counts

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);args=parser.parse_args();root=args.root.resolve()
    source_lock=json.loads((root/'source-input-lock.json').read_text())
    source=locked_tree(root/'source',source_lock['files'],'source')
    resources=locked_tree(root/'resources',json.loads((root/'resource-hashes.json').read_text()),'resources')
    insist(len(source)==49 and len(resources)==246,'Incorrect canonical source/resource count')
    checked=[];previews={};png_count=0;obj_count=0;faces=0;embedded_images=0
    for p in root.rglob('*'):
        rel=p.relative_to(root);parts=rel.parts
        if any(x in GENERATED for x in parts):continue
        if p.name=='AGENTS.md':continue
        if not p.is_file():continue
        name=rel.as_posix()
        if parts[0]=='work'and name not in ['work/export_obj.py','work/pose_math.py']:continue
        insist(not p.is_symlink(),name+': symbolic link outside publication scope')
        insist(name in ['work/export_obj.py','work/pose_math.py']or parts[0]in {'source','resources'}or(parts[0]in CODE_ROOTS and len(parts)>1)or(len(parts)==1 and(p.suffix in ROOT_SUFFIXES or name in ROOT_NAMES)),name+': undeclared publication path')
        insist(not any(x.lower()in {'gui','mcgui','saves','world','worlds','logs','screenshots'}for x in parts),name+': unrelated interface/world/log content')
        insist(p.suffix.lower()not in {'.jar','.class','.zip','.log','.mca','.dat','.toml'},name+': out-of-scope binary/config')
        checked.append(name)
        if p.suffix.lower()=='.png':
            size=png(p.read_bytes(),name);png_count+=1
            if parts[0]=='previews':previews[name]={'sha256':sha(p.read_bytes()),'bytes':p.stat().st_size,'dimensions':size}
            else:insist(parts[0]in ['source','resources'],name+': image outside source/resource/preview scope')
        elif p.suffix.lower()in ['.jpg','.jpeg','.webp','.gif']:raise ValueError(name+': preview/source image must be PNG')
        if p.suffix in TEXT_SUFFIXES:
            text=p.read_text();insist(not ABSOLUTE_LOCAL.search(text),name+': absolute local path')
            if p.suffix in ['.json','.mcmeta']:
                data=json.loads(text)
                if parts[0]=='source'and p.name=='payload.json':
                    for t in data['textures']:
                        prefix='data:image/png;base64,';insist(t['png'].startswith(prefix),name+': unsupported embedded texture')
                        blob=base64.b64decode(t['png'][len(prefix):],validate=True);png(blob,name+'/'+t['id']);embedded_images+=1
                        insist(sha(blob)==t['sha256'],name+': embedded texture SHA mismatch')
                if parts[0]=='resources'and 'models'in parts:
                    check_parents(data,root/'resources',name)
                    loader=data.get('loader');insist(loader in [None,'forge:obj','forge:composite'],name+': unsupported model loader')
                    if loader=='forge:obj':insist(resource_path(root/'resources',data['model'],'obj').is_file(),name+': missing OBJ')
                    for ref in data.get('textures',{}).values():
                        if isinstance(ref,str)and not ref.startswith('#'):insist(resource_path(root/'resources',ref,'texture').is_file(),name+': missing model texture '+ref)
            if p.suffix=='.obj':
                insist(parts[0]=='resources',name+': OBJ outside resource snapshot')
                count=check_obj(p,root/'resources');obj_count+=1;faces+=count['f']
    lock=json.loads((root/'artifact-lock.json').read_text())
    script=root/'client/kubejs/startup_scripts/90_dcp_approved_visuals.js'
    insist(sha(script.read_bytes())==lock['script_sha256'],'Generated client renderer SHA mismatch')
    preview_lock=root/'previews/manifest.json'
    if preview_lock.exists():
        pins=json.loads(preview_lock.read_text())
        for name,digest in pins.get('files',{}).items():insist(name in previews and previews[name]['sha256']==digest,'Preview SHA mismatch '+name)
    print(json.dumps({'status':'PASS','publication_files_checked':len(checked),'source_files':len(source),'resource_files':len(resources),'PNG_files':png_count,'embedded_source_PNGs':embedded_images,'OBJ_files':obj_count,'OBJ_faces':faces,'client_script_sha256':lock['script_sha256'],'previews':previews},ensure_ascii=False))

if __name__=='__main__':
    try:main()
    except (ValueError,KeyError,TypeError,OSError)as e:raise SystemExit(str(e))
