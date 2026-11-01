"""Rebuild the resource pack and client renderer from the included canonical inputs."""
from pathlib import Path
import argparse,hashlib,json,os,subprocess,sys
ROOT=Path(__file__).resolve().parent

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def run(*args):
    result=subprocess.run(args,cwd=ROOT,text=True,capture_output=True)
    if result.returncode:sys.stderr.write(result.stdout+result.stderr);raise SystemExit(result.returncode)

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-inputs',type=Path,default=os.environ.get('DCP_SOURCE_INPUTS',ROOT/'source'))
    parser.add_argument('--game-jar',type=Path,help='Forge-patched 1.20.1 client jar, not the unpatched Minecraft SRG jar')
    parser.add_argument('--dyson-jar',type=Path)
    parser.add_argument('--embeddium-jar',type=Path,help='Optional Embeddium jar for ownership-hook transformation checks')
    parser.add_argument('--classpath-file',type=Path)
    parser.add_argument('--jdk',type=Path)
    parser.add_argument('--resources-only',action='store_true',help='Verify resources/script without building the required native helper')
    args=parser.parse_args()
    if not args.resources_only and not all([args.game_jar,args.dyson_jar,args.classpath_file]):
        parser.error('full build requires --game-jar, --dyson-jar and --classpath-file; use --resources-only for art/script verification')
    source=Path(args.source_inputs).expanduser().resolve()
    if not source.is_dir():parser.error('canonical source input directory does not exist')
    os.environ['DCP_SOURCE_INPUTS']=str(source)
    pins=json.loads((ROOT/'source-input-lock.json').read_text())
    for name,digest in pins['files'].items():
        p=source/name
        if not p.is_file()or sha(p)!=digest:raise SystemExit('Missing or mismatched canonical input: '+name)
    run(sys.executable,'tools/check_public_tree.py')
    out=ROOT/'outputs';out.mkdir(exist_ok=True)
    run(sys.executable,'export_rail_scripted.py')
    run('node','tests/test-rail-pose.js')
    run(sys.executable,'export_rail_scripted_item.py')
    run(sys.executable,'export_receiver_scripted.py')
    run('node','tests/test-receiver-pose.cjs')
    run('node','tools/generate_compat_bounds.cjs')
    run('node','tests/test-compat-bounds.cjs')
    run('node','tests/test-native-renderer.cjs')
    run(sys.executable,'build_scripted_bundle.py')
    expected=json.loads((ROOT/'resource-hashes.json').read_text())
    actual={str(p.relative_to(out/'scripted-pack')):sha(p)for p in(out/'scripted-pack').rglob('*')if p.is_file()}
    if actual!=expected:raise SystemExit('Resource hash mismatch')
    manifest=json.loads((out/'scripted-bundle-manifest.json').read_text());target=json.loads((ROOT/'artifact-lock.json').read_text())
    if any(manifest[k]!=target[k]for k in ['zip_sha256','script_sha256']):raise SystemExit('Artifact hash mismatch')
    if not args.resources_only:
        command=[sys.executable,'tools/build_compat.py','--game-jar',str(args.game_jar),
            '--dyson-jar',str(args.dyson_jar),'--classpath-file',str(args.classpath_file),'--version',target['compat_version']]
        if args.jdk:command.extend(['--jdk',str(args.jdk)])
        if args.embeddium_jar:command.extend(['--embeddium-jar',str(args.embeddium_jar)])
        run(*command)
        if sha(out/'native-compat'/target['compat_jar'])!=target['compat_sha256']:raise SystemExit('Native helper hash mismatch')
    result={'status':'PASS_RESOURCES_AND_SCRIPT'if args.resources_only else'PASS','resource_files':len(actual),'zip_sha256':manifest['zip_sha256'],'script_sha256':manifest['script_sha256'],'native_helper_built':not args.resources_only,'inputs':'Repository source/; SHA-verified canonical art inputs','game_validation':'See validation-report.json'}
    (out/'build-validation.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))

if __name__=='__main__':main()
