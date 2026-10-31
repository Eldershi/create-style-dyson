"""Package the verified client pair with installation and attribution documents."""
from pathlib import Path
import argparse, hashlib, json, re, zipfile

ROOT = Path(__file__).resolve().parents[1]
PACK_NAME = 'Dyson-Create-Approved-Models-Forge-1.20.1.zip'
SCRIPT_NAME = '90_dcp_approved_visuals.js'


def digest(blob):
    return hashlib.sha256(blob).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--version', required=True)
    parser.add_argument('--source-commit', required=True)
    args = parser.parse_args()
    if not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+', args.version):
        parser.error('version must be semantic major.minor.patch')
    if not re.fullmatch(r'[0-9a-f]{40}', args.source_commit):
        parser.error('source-commit must be an exact Git commit')
    lock = json.loads((ROOT / 'artifact-lock.json').read_text())
    pack = (ROOT / 'outputs' / PACK_NAME).read_bytes()
    script = (ROOT / 'client/kubejs/startup_scripts' / SCRIPT_NAME).read_bytes()
    if digest(pack) != lock['zip_sha256'] or digest(script) != lock['script_sha256']:
        raise SystemExit('Client files differ from verified artifact lock')
    blobs = {
        'config/paxi/resourcepacks/' + PACK_NAME: pack,
        'kubejs/startup_scripts/' + SCRIPT_NAME: script,
    }
    for name in ['README.md', 'README.zh-CN.md', 'INSTALL.md', 'INSTALL.zh-CN.md',
                 'CREDITS.md', 'CREDITS.zh-CN.md', 'ASSET-LICENSES.md', 'ASSET-LICENSES.zh-CN.md',
                 'previews/electromagnetic-ejector.png', 'previews/ray-receiver.png']:
        blobs[name] = (ROOT / name).read_bytes()
    for path in sorted((ROOT / 'licenses').rglob('*')):
        if path.is_file():
            blobs[path.relative_to(ROOT).as_posix()] = path.read_bytes()
    manifest = {'version': args.version, 'minecraft': '1.20.1', 'forge': '47.4.10',
                'source_commit': args.source_commit,
                'source_repository': 'https://github.com/Eldershi/create-style-dyson',
                'no_new_companion_JAR': True,
                'files': {name: {'sha256': digest(data), 'bytes': len(data)}
                          for name, data in sorted(blobs.items())}}
    blobs['file-manifest.json'] = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode()
    filename = 'Create-Style-Dyson-' + args.version + '-MC1.20.1-Client.zip'
    output = ROOT / 'outputs/release'
    output.mkdir(parents=True, exist_ok=True)
    target = output / filename
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in sorted(blobs.items()):
            entry = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, data)
    with zipfile.ZipFile(target) as archive:
        if archive.testzip() is not None:
            raise SystemExit('Release ZIP CRC failed')
        for name, data in blobs.items():
            if archive.read(name) != data:
                raise SystemExit('Release file differs: ' + name)
    (output / 'SHA256SUMS.txt').write_text(digest(target.read_bytes()) + '  ' + filename + '\n')
    report = {'zip': str(target), 'sha256': digest(target.read_bytes()),
              'bytes': target.stat().st_size, 'files': len(blobs),
              'source_commit': args.source_commit,
              'verified_game_pair': {'resource_zip': digest(pack), 'renderer': digest(script)}}
    (output / 'release-manifest.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
