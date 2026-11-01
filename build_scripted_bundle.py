"""Package approved resources and the KubeJS native-dispatch renderer."""
from pathlib import Path
import hashlib, json, zipfile

ROOT=Path(__file__).resolve().parent
from source_inputs import input_root
INPUT=input_root()
PACK=ROOT/'outputs/scripted-pack'
CLIENT=ROOT/'outputs/scripted-client'
WORK=ROOT/'src/runtime'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()

def write_json(path,obj):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')

def main():
    write_json(PACK/'pack.mcmeta',{'pack':{'pack_format':15,'description':'戴森球 × 机械动力 · 已确认完整结构（需配套现有KubeJS客户端渲染脚本）'}})
    models=PACK/'assets/dysoncubeproject/models'
    for name in ['em_railejector_base','em_railejector_gun','ray_receiver_base','ray_receiver_plate','ray_receiver_lens','ray_receiver_lens_stands']:
        write_json(models/'block'/(name+'.json'),{'credit':'Body rendered by the approved-part KubeJS client renderer; original Java renderer keeps native FX only.','parent':'minecraft:block/block','textures':{'particle':'dysoncubeproject:block/particle'},'elements':[]})
    for name,ns in [('em_railejector_controller','dcp_scripted_rail'),('ray_receiver_controller','dcp_scripted_receiver')]:
        write_json(models/'item'/(name+'.json'),{'parent':ns+':block/item_assembled'})
    projectile=json.loads((INPUT/'native/em_railejector_projectile.json').read_text())
    write_json(models/'block/em_railejector_projectile.json',projectile)
    png=PACK/'assets/dysoncubeproject/textures/block/particle.png'
    png.parent.mkdir(parents=True,exist_ok=True)
    png.write_bytes((INPUT/'native/particle.png').read_bytes())
    bounds={}
    for machine,ns in [('rail','dcp_scripted_rail'),('receiver','dcp_scripted_receiver')]:
        bounds[machine]={}
        for obj in (PACK/'assets'/ns/'models/block').glob('*.obj'):
            if obj.stem=='item_assembled':continue
            vertices=[list(map(float,line.split()[1:4])) for line in obj.read_text().splitlines() if line.startswith('v ')]
            bounds[machine][obj.stem]=[[min(p[k] for p in vertices) for k in range(3)],[max(p[k] for p in vertices) for k in range(3)]]
    parts=['// Requires KubeJS and Create Style Dyson Render Compat. Client only.\nif (Platform.isClientEnvironment()) {\n(function(){\n',
        'if (!Math.hypot) Math.hypot=function(){var s=0;for(var i=0;i<arguments.length;i++)s+=arguments[i]*arguments[i];return Math.sqrt(s);};\n',
        'var DCP_PI=3.141592653589793;\n',
        (ROOT/'work/scripted-rail/pose-v17.js').read_text().replace('Math.PI','DCP_PI'),
        (ROOT/'work/scripted-receiver/receiver_pose.js').read_text().replace('Math.PI','DCP_PI'),
        (WORK/'renderer-main.js').read_text(),'\n})();\n}\n']
    script=CLIENT/'kubejs/startup_scripts/90_dcp_approved_visuals.js'
    script.parent.mkdir(parents=True,exist_ok=True)
    script.write_text('\n'.join(parts))
    target=ROOT/'outputs/Dyson-Create-Approved-Models-Forge-1.20.1.zip'
    files=sorted(p for p in PACK.rglob('*') if p.is_file())
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for p in files:
            info=zipfile.ZipInfo(p.relative_to(PACK).as_posix(),(1980,1,1,0,0,0))
            info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
            z.writestr(info,p.read_bytes())
    report={'status':'BUILT_NOT_INSTALLED_OR_GAME_VERIFIED','zip':str(target),'zip_sha256':sha(target),'zip_bytes':target.stat().st_size,
        'files':len(files),'script':str(script),'script_sha256':sha(script),'script_bytes':script.stat().st_size,
        'client_compat_required':True,'geometry_source':'Rail24body models/30instances; receiver25models/47instances',
        'fixed_and_independent_parts':'Original pose graphs, hydraulic IK and cable links retained',
        'native_FX':'Original Java renderers/shaders delegated; rail frame only translates +20px worldY as proven',
        'receiver_angle_mapping':{'approved_mechanical_range':[0,70],'strategy':'linear70; source yaw fixed0','native_BE_fields_changed':False,'limitation':'Does not reproduce the original 180degree solar optical arc; do not claim it does.'},
        'model_bounds':bounds,'asset_SHA':{str(p.relative_to(PACK)):sha(p) for p in files}}
    write_json(ROOT/'outputs/scripted-bundle-manifest.json',report)
    print(json.dumps({k:report[k] for k in ['status','zip_sha256','zip_bytes','files','script_sha256','script_bytes']},ensure_ascii=False))

if __name__=='__main__':main()
