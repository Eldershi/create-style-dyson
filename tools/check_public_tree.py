"""Reject art binaries, embedded image payloads and compiled meshes in source publication."""
from pathlib import Path
import argparse,json,re,subprocess
FORBIDDEN={'.png','.jpg','.jpeg','.webp','.gif','.obj','.mtl','.zip','.jar','.class','.bbmodel','.blend','.glb','.gltf'}
def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1]);args=parser.parse_args();root=args.root.resolve()
    if(root/'.git').exists():
        result=subprocess.run(['git','--no-optional-locks','ls-files','--cached','--others','--exclude-standard','-z'],cwd=root,capture_output=True,check=True)
        paths=[root/Path(n)for n in result.stdout.decode().split('\0')if n]
    else:
        paths=[p for p in root.rglob('*')if p.is_file()and '.git'not in p.parts and 'outputs'not in p.relative_to(root).parts and '__pycache__'not in p.parts and 'private-inputs'not in p.relative_to(root).parts and ('work'not in p.relative_to(root).parts or p.relative_to(root).as_posix()in['work/export_obj.py','work/pose_math.py'])]
    errors=[]
    for p in paths:
        if not p.is_file():continue
        name=p.relative_to(root).as_posix()
        if p.suffix.lower()in FORBIDDEN:errors.append(name+': art/binary extension');continue
        if 'payload'in p.name.lower()and p.suffix=='.json':errors.append(name+': payload file');continue
        if p.suffix.lower()in{'.py','.js','.cjs','.json','.md','.txt'}:
            text=p.read_text()
            if re.search(r'data:image/[a-zA-Z+.-]+;base64,[A-Za-z0-9+/=]{100,}',text):errors.append(name+': embedded image')
            if p.suffix=='.json':
                data=json.loads(text)
                def inspect(v):
                    if isinstance(v,dict):
                        if isinstance(v.get('data'),str)and len(v['data'])>512:errors.append(name+': encoded asset data')
                        for x in v.values():inspect(x)
                    elif isinstance(v,list):
                        for x in v:inspect(x)
                inspect(data)
    if errors:raise SystemExit('\n'.join(errors))
    print(json.dumps({'status':'PASS','source_files_checked':len(paths),'art_payloads_in_publication':0}))
if __name__=='__main__':main()
