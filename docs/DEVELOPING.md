# Building from source

**English** · [简体中文](DEVELOPING.zh-CN.md)

For installation, see [Installation](../INSTALL.md).

## Build

The repository includes the canonical art inputs in `source/` and the compiled resource snapshot in `resources/`. The default build uses these inputs; no separate art download or dependency JAR extraction is needed.

Use Python **3.12**, Node.js **24**, JDK **17**, and the Python packages pinned in `requirements.txt`. The native helper needs the Forge-patched Minecraft 1.20.1 client (`forge-1.20.1-47.4.10-client.jar`), the base Minecraft SRG jar as a dependency, Dyson Cube Project 1.20.1+1.0.5.1, Titanium 3.8.35, Forge 47.4.10 and their cached dependencies, including Mixin 0.8.5. Supply those dependency JAR paths in a JSON array; dependency JARs are not redistributed. From the repository root:

```sh
python3 -m pip install -r requirements.txt
python3 tools/check_public_tree.py
python3 build.py --game-jar /path/to/forge-1.20.1-47.4.10-client.jar --dyson-jar /path/to/dysoncubeproject-1.20.1+1.0.5.1.jar --classpath-file /path/to/dependencies.json --jdk /path/to/jdk17
```

The complete build checks canonical poses, continuous render envelopes, Java wrapper contracts and real Mixin transformation of the supplied DCP classes, then verifies resource, script and helper hashes. The helper artifact lock uses JDK 17.0.5. `python3 build.py --resources-only` checks artwork and script without native compilation; that mode does not produce a complete client installation.

Add `--embeddium-jar /path/to/embeddium-0.3.31.jar` to verify the optional section-ownership hook against that jar. Embeddium is not required to run the pack.

Generated files:

- `outputs/Dyson-Create-Approved-Models-Forge-1.20.1.zip`
- `outputs/scripted-client/kubejs/startup_scripts/90_dcp_approved_visuals.js`
- `outputs/native-compat/create-style-dyson-compat-1.1.0.jar`
- `outputs/build-validation.json`

Install all three client files together using the [installation instructions](../INSTALL.md).

## Source layout

- `source/rail/`: compiled source geometry, pixels and the reference pose functions for the electromagnetic ejector.
- `source/receiver/`: source geometry, pixels, model JSONs and reference pose functions for the ray receiver.
- `source/native/`: the projectile model and particle texture used by the native effects delegate.
- `src/runtime/`: KubeJS pose rendering and native-effects delegation.
- `src/compat/`: client bounds adaptation, native BER wrapper and Java/Mixin contracts.
- `export_rail_scripted.py`, `export_rail_scripted_item.py`, `export_receiver_scripted.py`: resource exporters.
- `build_scripted_bundle.py`: resource-pack and client-script assembly.
- `tests/`: canonical poses, generated envelopes and script registration/lifecycle contracts.
- `tools/build_compat.py`: deterministic native helper compilation using supplied dependencies.

The renderer uses the existing KubeJS / Rhino / Architectury environment. It delegates native charging, firing and blue hologram effects to Dyson Cube Project. The project does not change the original mod's gameplay or repair its own defects; fixes cover problems introduced by this project's resources and client script.

## Native visibility

Two client-only Mixins extend the original controller bounds with finite build-generated envelopes for every approved pose. The rail also retains the original effects bounds translated by the renderer's 1.25-block lift. Each controller caches its bounds by resource epoch, position and original extents, with no world, chunk or block-entity references.

Native lifecycle hooks register these two controller types individually in Minecraft's global block-entity list and remove them on disposal or chunk unload. A weak index of controllers already registered is rebound after renderer resets and pruned on world changes. No chunks or unrelated block entities are searched.

The Java BER wrapper preserves offscreen eligibility, corrected frustum bounds and the delegated 64-block distance. An optional Embeddium hook excludes these owned controllers from its section-mesh lists, so the original global pass remains the single drawing owner even before an offscreen section is compiled. The existing renderer uses Minecraft's supplied buffers, with no discovery ticks or separate fallback draws.

Model baking refreshes the resource availability gate. With the approved resource pack disabled, original bounds and native artwork are used. Re-enabling it refreshes model and bounds caches. Typed script BER delegates are preconstructed during startup so Java reload threads can safely obtain them.

Before asynchronous model preparation, a client hook binds Forge's OBJ loader to this reload's resource manager and clears its parsed-model caches. It runs only when the approved resources are active or present in the new reload.

`tools/generate_compat_bounds.cjs` follows the approved scene graph using analytic rotation radii and bounded IK origin intervals. Outward rounding adds a render-float margin. Pose samples audit the scene-graph implementation; continuous coverage comes from the analytic hull construction. Actual game scope is recorded in `validation-report.json`.

## Input and artifact locks

[Input layout](../input-layout.md) describes the source files. `source-input-lock.json` pins their hashes, `resource-hashes.json` pins compiled resources, and `artifact-lock.json` pins the resource ZIP, client script and native helper. `client/kubejs/startup_scripts/90_dcp_approved_visuals.js` is the checked-in generated script.

`build.py` also accepts `--source-inputs <directory>` or `DCP_SOURCE_INPUTS` for an alternative directory containing the same locked inputs. It defaults to the repository's `source/` directory.

`tools/check_public_tree.py` validates publication paths, hashes, PNGs, OBJ data and model/material references. `tools/extract_reference.py` can verify and extract an individual dependency entry from a local JAR; it is optional for the normal build.

See [credits](../CREDITS.md), [asset terms](../ASSET-LICENSES.md), [source records](../THIRD_PARTY_INPUTS.md) and `donor-references.json` for upstream provenance. Current requirements are in `requirements-checklist.md`; `validation-report.json` records the actual game-validation scope. A successful build is not a guarantee for every shader pack or mod combination.
