"""Build locally from explicitly supplied private art inputs."""
from pathlib import Path
import argparse,hashlib,json,os,subprocess,sys
ROOT=Path(__file__).resolve().parent

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def run(*args):
    result=subprocess.run(args,cwd=ROOT,text=True,capture_output=True)
    if result.returncode:sys.stderr.write(result.stdout+result.stderr);raise SystemExit(result.returncode)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--private-inputs',type=Path,default=os.environ.get('DCP_PRIVATE_INPUTS'))
    args=parser.parse_args()
    if not args.private_inputs:parser.error('--private-inputs or DCP_PRIVATE_INPUTS is required; art inputs are not in this repository')
    private=Path(args.private_inputs).expanduser().resolve()
    if not private.is_dir():parser.error('private input directory does not exist')
    os.environ['DCP_PRIVATE_INPUTS']=str(private)
    pins=json.loads((ROOT/'private-input-lock.json').read_text())
    for name,digest in pins['files'].items():
        p=private/name
        if not p.is_file()or sha(p)!=digest:raise SystemExit('Missing or mismatched private input: '+name)
    out=ROOT/'outputs';out.mkdir(exist_ok=True)
    run(sys.executable,'export_rail_scripted.py')
    run('node','tests/test-rail-pose.js')
    run(sys.executable,'export_rail_scripted_item.py')
    run(sys.executable,'export_receiver_scripted.py')
    run('node','tests/test-receiver-pose.cjs')
    run('node','tests/test-frustum-fallback.cjs')
    run(sys.executable,'build_scripted_bundle.py')
    expected=json.loads((ROOT/'resource-hashes.json').read_text())
    actual={str(p.relative_to(out/'scripted-pack')):sha(p)for p in(out/'scripted-pack').rglob('*')if p.is_file()}
    if actual!=expected:raise SystemExit('Resource hash mismatch')
    manifest=json.loads((out/'scripted-bundle-manifest.json').read_text());target=json.loads((ROOT/'artifact-lock.json').read_text())
    if any(manifest[k]!=target[k]for k in ['zip_sha256','script_sha256']):raise SystemExit('Artifact hash mismatch')
    result={'status':'PASS','resource_files':len(actual),'zip_sha256':manifest['zip_sha256'],'script_sha256':manifest['script_sha256'],'inputs':'Local private files; not redistributed','game_validation':'See validation-report.json'}
    (out/'build-validation.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))

if __name__=='__main__':main()
