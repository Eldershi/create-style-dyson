"""Build and verify the client helper against a Forge-patched Minecraft 1.20.1 SRG client."""
from pathlib import Path
import argparse
import hashlib
import io
import json
import os
import re
import shutil
import subprocess
import struct
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'src/compat'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def entry(archive, name, data):
    info = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
    info.create_system = 3
    info.external_attr = 0o100644 << 16
    info.compress_type = zipfile.ZIP_DEFLATED
    archive.writestr(info, data.encode() if isinstance(data, str) else data)


def class_methods(data):
    """Read method definitions, distinguishing Forge methods from constant-pool references."""
    stream = io.BytesIO(data)
    def read(count):
        value = stream.read(count)
        if len(value) != count:
            raise ValueError('truncated class file')
        return value
    def u1(): return read(1)[0]
    def u2(): return struct.unpack('>H', read(2))[0]
    def u4(): return struct.unpack('>I', read(4))[0]
    if u4() != 0xCAFEBABE:
        raise ValueError('invalid class file magic')
    read(4)
    constants = [None] * u2()
    index = 1
    while index < len(constants):
        tag = u1()
        if tag == 1:
            constants[index] = read(u2()).decode('utf-8', errors='replace')
        elif tag in (3, 4): read(4)
        elif tag in (5, 6):
            read(8)
            index += 1
        elif tag in (7, 8, 16, 19, 20): read(2)
        elif tag in (9, 10, 11, 12, 17, 18): read(4)
        elif tag == 15: read(3)
        else: raise ValueError('unsupported class constant tag')
        index += 1
    read(6)
    read(2 * u2())
    def member():
        access, name, descriptor, count = u2(), constants[u2()], constants[u2()], u2()
        code = False
        for _ in range(count):
            attribute, length = constants[u2()], u4()
            code = code or attribute == 'Code'
            read(length)
        return name, descriptor, access, code
    for _ in range(u2()): member()
    result = {}
    for _ in range(u2()):
        name, descriptor, access, code = member()
        result[(name, descriptor)] = {'access': access, 'code': code}
    return result


def validate_patched_game(path):
    with zipfile.ZipFile(path) as archive:
        methods = class_methods(archive.read('net/minecraft/world/level/block/entity/BlockEntity.class'))
    for name in ('onChunkUnloaded', 'm_6339_', 'm_7651_'):
        method = methods.get((name, '()V'))
        if method is None or not method['code'] or method['access'] & 0x0400:
            raise ValueError('missing concrete BlockEntity.' + name + '()V')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--game-jar', type=Path, required=True,
                        help='Forge-patched 1.20.1 SRG client (forge-1.20.1-47.4.10-client.jar); '
                             'put the unpatched Minecraft client-...-srg.jar only in the dependency classpath')
    parser.add_argument('--dyson-jar', type=Path, required=True, help='Unmodified Dyson Cube Project 1.20.1+1.0.5.1 jar')
    parser.add_argument('--embeddium-jar', type=Path, help='Optional Embeddium 0.3.31 jar for native ownership transformation proof')
    parser.add_argument('--dependency', type=Path, action='append', default=[])
    parser.add_argument('--classpath-file', type=Path, help='JSON array of dependency jar paths')
    parser.add_argument('--jdk', type=Path, help='JDK 17 home; defaults to JAVA_HOME or commands on PATH')
    parser.add_argument('--version', default='1.1.0')
    parser.add_argument('--output-dir', type=Path, default=ROOT / 'outputs/native-compat')
    args = parser.parse_args()
    if not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+', args.version):
        parser.error('version must be semantic major.minor.patch')
    try:
        validate_patched_game(args.game_jar.expanduser().resolve())
    except (OSError, KeyError, ValueError, zipfile.BadZipFile) as error:
        parser.error('--game-jar must be the Forge-patched 1.20.1 SRG client '
                     '(forge-1.20.1-47.4.10-client.jar), not the unpatched Minecraft '
                     'client-...-srg.jar; add the latter with --dependency or --classpath-file. '
                     'Validation: ' + str(error))
    dependencies = [args.game_jar, args.dyson_jar] + args.dependency
    if args.embeddium_jar:
        dependencies.append(args.embeddium_jar)
    if args.classpath_file:
        values = json.loads(args.classpath_file.read_text())
        if not isinstance(values, list) or not all(isinstance(value, str) for value in values):
            parser.error('classpath-file must contain a JSON array of jar paths')
        dependencies += [Path(value) for value in values]
    dependencies = list(dict.fromkeys(path.expanduser().resolve() for path in dependencies))
    for path in dependencies:
        if not path.is_file() or not zipfile.is_zipfile(path):
            parser.error('missing or invalid dependency jar: ' + str(path))
    bounds_path = SOURCE / 'resources/approved-bounds.json'
    bounds = json.loads(bounds_path.read_text())
    import math
    for kind in ['rail', 'receiver']:
        box = bounds.get(kind)
        if not isinstance(box, list) or len(box) != 6 or not all(isinstance(n, (int, float)) and math.isfinite(n) for n in box):
            parser.error('invalid generated bounds: ' + kind)
        if any(box[i] >= box[i + 3] for i in range(3)):
            parser.error('empty generated bounds: ' + kind)
    java_home = args.jdk or (Path(os.environ['JAVA_HOME']) if os.environ.get('JAVA_HOME') else None)
    javac = str(java_home / 'bin/javac') if java_home else shutil.which('javac')
    java = str(java_home / 'bin/java') if java_home else shutil.which('java')
    if not javac or not java:
        parser.error('JDK 17 javac and java are required')
    output = args.output_dir.resolve()
    build = output / 'build'
    classes = build / 'classes'
    test_classes = build / 'test-classes'
    if build.exists():
        shutil.rmtree(build)
    classes.mkdir(parents=True)
    test_classes.mkdir()
    cp = os.pathsep.join(map(str, dependencies))

    def run(command, log_name, timeout=60):
        result = subprocess.run(list(map(str, command)), cwd=build, capture_output=True, text=True, timeout=timeout)
        (build / log_name).write_text(result.stdout + result.stderr)
        if result.returncode:
            raise SystemExit(result.stdout + result.stderr)
        return result.stdout + result.stderr

    sources = sorted((SOURCE / 'java').rglob('*.java'))
    run([javac, '-J-XX:ActiveProcessorCount=2', '--release', '17', '-proc:none', '-encoding', 'UTF-8',
         '-cp', cp, '-d', classes, *sources], 'compile.log')
    target = output / ('create-style-dyson-compat-' + args.version + '.jar')
    config = {'required': True, 'minVersion': '0.8', 'package': 'dev.eldershi.dysoncompat.mixin',
              'compatibilityLevel': 'JAVA_17', 'client': ['RailRenderBoundsMixin', 'ReceiverRenderBoundsMixin', 'ModelManagerReloadMixin',
                  'BlockEntityLifecycleMixin', 'GlobalRendererLifecycleMixin', 'EmbeddiumGlobalOwnershipMixin'],
              'injectors': {'defaultRequire': 1}}
    metadata = '''modLoader="lowcodefml"
loaderVersion="[47,)"
license="MIT"
[[mods]]
modId="create_style_dyson_compat"
version="%s"
displayName="Create Style Dyson Rendering Compatibility"
displayTest="IGNORE_ALL_VERSION"
description="Client render bounds and native renderer classification for the paired Create Style Dyson resources."
[[dependencies.create_style_dyson_compat]]
modId="minecraft"
mandatory=true
versionRange="[1.20.1,1.20.2)"
side="CLIENT"
[[dependencies.create_style_dyson_compat]]
modId="forge"
mandatory=true
versionRange="[47.4.10,48)"
side="CLIENT"
[[dependencies.create_style_dyson_compat]]
modId="dysoncubeproject"
mandatory=true
versionRange="[1.20.1+1.0.5.1]"
side="CLIENT"
''' % args.version
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        entry(archive, 'META-INF/MANIFEST.MF', 'Manifest-Version: 1.0\r\nMixinConfigs: create-style-dyson-compat.mixins.json\r\n\r\n')
        entry(archive, 'META-INF/mods.toml', metadata)
        entry(archive, 'META-INF/LICENSE-create-style-dyson-compat.txt', (SOURCE / 'LICENSE').read_bytes())
        entry(archive, 'create-style-dyson-compat.mixins.json', json.dumps(config, separators=(',', ':')))
        entry(archive, 'create_style_dyson_compat/approved-bounds.json', bounds_path.read_bytes())
        entry(archive, 'pack.mcmeta', json.dumps({'pack': {'pack_format': 15, 'description': 'Create Style Dyson client rendering compatibility'}}))
        for path in sorted(classes.rglob('*.class')):
            entry(archive, path.relative_to(classes).as_posix(), path.read_bytes())
    runtime = os.pathsep.join([str(test_classes), str(target), cp])
    tests = sorted((SOURCE / 'tests').rglob('*.java'))
    run([javac, '-J-XX:ActiveProcessorCount=2', '--release', '17', '-proc:none', '-encoding', 'UTF-8',
         '-cp', runtime, '-d', test_classes, *tests], 'test-compile.log')
    services = test_classes / 'META-INF/services'
    services.mkdir(parents=True)
    (services / 'org.spongepowered.asm.service.IMixinService').write_text('StandaloneMixinService\n')
    (services / 'org.spongepowered.asm.service.IGlobalPropertyService').write_text('StandaloneProperties\n')
    java_args = [java, '-XX:ActiveProcessorCount=2', '-Xverify:all', '-Xmx256m', '-cp', runtime]
    regression = run(java_args + ['dev.eldershi.dysoncompat.client.NativeBoundsRegression'], 'regression.log')
    transformed = build / 'transformed'
    transformed.mkdir()
    mixins = run(java_args + ['ApplyBoundsMixins', args.dyson_jar, transformed, args.game_jar,
                             args.embeddium_jar or '-'], 'mixin-proof.log')
    with zipfile.ZipFile(target) as archive:
        if archive.testzip() is not None:
            raise SystemExit('Native helper CRC check failed')
        if archive.read('create_style_dyson_compat/approved-bounds.json') != bounds_path.read_bytes():
            raise SystemExit('Embedded envelopes differ from source')
    report = {'status': 'PASS', 'artifact': target.name, 'sha256': digest(target), 'bytes': target.stat().st_size,
              'version': args.version, 'minecraft': '1.20.1', 'forge': '47.4.10', 'dyson': '1.20.1+1.0.5.1',
              'bounds_sha256': digest(bounds_path), 'source_sha256': {str(p.relative_to(ROOT)): digest(p) for p in sources},
              'license_sha256': digest(SOURCE / 'LICENSE'),
              'native_regression': regression.strip(), 'mixin_transform': mixins.strip(),
              'client_mixins_only': True, 'minecraft_launched': False}
    (output / 'verification.json').write_text(json.dumps(report, indent=2) + '\n')
    (output / 'SHA256SUMS.txt').write_text(digest(target) + '  ' + target.name + '\n')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
