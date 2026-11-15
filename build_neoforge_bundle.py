"""Package the approved resources and KubeJS renderer for NeoForge 1.21.1.

The art, geometry and pose functions are the same as the Forge 1.20.1 bundle;
only the loader names, pack format and client script differ.
"""
from pathlib import Path
import hashlib, json, shutil, zipfile

ROOT = Path(__file__).resolve().parent
SOURCE_PACK = ROOT / 'outputs/scripted-pack'
OUT = ROOT / 'outputs/neoforge-1.21.1'
PACK = OUT / 'pack'
CLIENT = OUT / 'client'
ZIP = ROOT / 'outputs/Dyson-Create-Approved-Models-NeoForge-1.21.1.zip'
SCRIPT = CLIENT / 'kubejs/startup_scripts/90_dcp_approved_visuals.js'
PACK_FORMAT = 34
LOADERS = {'forge:obj': 'neoforge:obj', 'forge:composite': 'neoforge:composite'}
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()


def write_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n')


def port_loaders(node):
    """Rename Forge model loaders; any other forge: loader is an error."""
    count = 0
    if isinstance(node, dict):
        loader = node.get('loader')
        if isinstance(loader, str) and loader.startswith('forge:'):
            if loader not in LOADERS:
                raise SystemExit('No NeoForge equivalent for model loader ' + loader)
            node['loader'] = LOADERS[loader]
            count += 1
        for value in node.values():
            count += port_loaders(value)
    elif isinstance(node, list):
        for value in node:
            count += port_loaders(value)
    return count


def build_pack():
    if not (SOURCE_PACK / 'pack.mcmeta').is_file():
        raise SystemExit('Build the Forge 1.20.1 scripted pack first')
    if PACK.exists():
        shutil.rmtree(PACK)
    ported = 0
    for source in sorted(p for p in SOURCE_PACK.rglob('*') if p.is_file()):
        relative = source.relative_to(SOURCE_PACK)
        target = PACK / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        if relative.as_posix() == 'pack.mcmeta':
            continue
        if source.suffix == '.json' and '/models/' in '/' + relative.as_posix():
            doc = json.loads(source.read_text())
            ported += port_loaders(doc)
            write_json(target, doc)
        else:
            target.write_bytes(source.read_bytes())
    write_json(PACK / 'pack.mcmeta', {'pack': {
        'pack_format': PACK_FORMAT,
        'description': '戴森球 × 机械动力 · 已确认完整结构（NeoForge 1.21.1，需配套KubeJS客户端渲染脚本）'}})
    leftovers = [p for p in PACK.rglob('*.json') if '"forge:' in p.read_text()]
    if leftovers:
        raise SystemExit('Forge-only references remain: ' + ', '.join(str(p) for p in leftovers))
    return ported


def build_script():
    bounds = json.loads((ROOT / 'src/compat/resources/approved-bounds.json').read_text())
    if sorted(bounds) != ['rail', 'receiver'] or any(len(v) != 6 for v in bounds.values()):
        raise SystemExit('Invalid approved bounds')
    parts = ['// Requires KubeJS for NeoForge 1.21.1 and Dyson Cube Project 1.0.5. Client only.\n'
             'if (Platform.isClientEnvironment()) {\n(function(){\n',
             'if (!Math.hypot) Math.hypot=function(){var s=0;for(var i=0;i<arguments.length;i++)s+=arguments[i]*arguments[i];return Math.sqrt(s);};\n',
             'var DCP_PI=3.141592653589793;\n',
             'var DCP_APPROVED_BOUNDS=' + json.dumps(bounds, separators=(',', ':')) + ';\n',
             (ROOT / 'work/scripted-rail/pose-v17.js').read_text().replace('Math.PI', 'DCP_PI'),
             (ROOT / 'work/scripted-receiver/receiver_pose.js').read_text().replace('Math.PI', 'DCP_PI'),
             (ROOT / 'src/runtime/renderer-main-neoforge-1.21.1.js').read_text(), '\n})();\n}\n']
    SCRIPT.parent.mkdir(parents=True, exist_ok=True)
    SCRIPT.write_text('\n'.join(parts))


def build_zip():
    files = sorted(p for p in PACK.rglob('*') if p.is_file())
    with zipfile.ZipFile(ZIP, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for p in files:
            info = zipfile.ZipInfo(p.relative_to(PACK).as_posix(), (1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            z.writestr(info, p.read_bytes())
    return files


def main():
    ported = build_pack()
    build_script()
    files = build_zip()
    report = {'minecraft': '1.21.1', 'loader': 'neoforge', 'pack_format': PACK_FORMAT,
              'zip': ZIP.name, 'zip_sha256': sha(ZIP), 'zip_bytes': ZIP.stat().st_size, 'files': len(files),
              'ported_model_loaders': ported, 'script_sha256': sha(SCRIPT), 'script_bytes': SCRIPT.stat().st_size,
              'native_helper_required': False}
    write_json(ROOT / 'outputs/neoforge-bundle-manifest.json', report)
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
