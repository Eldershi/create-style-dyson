# Building from source

**English** · [简体中文](DEVELOPING.zh-CN.md)

For installation, see [Installation](../INSTALL.md).

## Build

The repository includes the canonical art inputs in `source/` and the compiled resource snapshot in `resources/`. The default build uses these inputs; no separate art download or dependency JAR extraction is needed.

Use Python **3.12**, Node.js **24.19.0**, and the Python packages pinned in `requirements.txt` (Pillow **12.3.0**, NumPy **2.3.5**). From the repository root:

```sh
python3 -m pip install -r requirements.txt
python3 tools/check_public_tree.py
python3 build.py
```

The build exports the models, checks the original pose functions and client visibility fallback, then verifies the resource snapshot and final artifacts against their locks.

Generated files:

- `outputs/Dyson-Create-Approved-Models-Forge-1.20.1.zip`
- `outputs/scripted-client/kubejs/startup_scripts/90_dcp_approved_visuals.js`
- `outputs/build-validation.json`

Install the generated pack and script together using the [installation instructions](../INSTALL.md).

## Source layout

- `source/rail/`: compiled source geometry, pixels and the reference pose functions for the electromagnetic ejector.
- `source/receiver/`: source geometry, pixels, model JSONs and reference pose functions for the ray receiver.
- `source/native/`: the projectile model and particle texture used by the native effects delegate.
- `src/runtime/`: the client renderer and visibility fallback.
- `export_rail_scripted.py`, `export_rail_scripted_item.py`, `export_receiver_scripted.py`: resource exporters.
- `build_scripted_bundle.py`: resource-pack and client-script assembly.
- `tests/`: numerical pose and visibility-fallback checks.

The renderer uses the existing KubeJS / Rhino / Architectury environment. It delegates native charging, firing and blue hologram effects to Dyson Cube Project. The project does not change the original mod's gameplay or repair its own defects; fixes cover problems introduced by this project's resources and client script.

## Input and artifact locks

[Input layout](../input-layout.md) describes the source files. `source-input-lock.json` pins their hashes, `resource-hashes.json` pins the compiled resource snapshot, and `artifact-lock.json` pins the resource ZIP and generated client script. `client/kubejs/startup_scripts/90_dcp_approved_visuals.js` is the checked-in generated script and must match the paired pack.

`build.py` also accepts `--source-inputs <directory>` or `DCP_SOURCE_INPUTS` for an alternative directory containing the same locked inputs. It defaults to the repository's `source/` directory.

`tools/check_public_tree.py` validates publication paths, hashes, PNGs, OBJ data and model/material references. `tools/extract_reference.py` can verify and extract an individual dependency entry from a local JAR; it is optional for the normal build.

See [credits](../CREDITS.md), [asset terms](../ASSET-LICENSES.md), [source records](../THIRD_PARTY_INPUTS.md) and `donor-references.json` for upstream provenance. Current requirements are in `requirements-checklist.md`; `validation-report.json` records the actual game-validation scope. A successful build is not a guarantee for every shader pack or mod combination.
