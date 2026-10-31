# Build inputs and resource snapshots

English | [简体中文](input-layout.zh-CN.md)

`source/` contains 49 locked canonical art inputs. Running `python3 build.py` rebuilds from the inputs in this repository by default; no external art directory is required. Use `--source-inputs` to select another directory containing the same locked inputs.

- `rail/payload.json`: compiled ejector geometry, UVs, and original pixel data.
- `rail/scene.js`: the canonical ejector pose functions.
- `receiver/payload.json` and `receiver/scene.js`: compiled receiver data and canonical pose functions.
- `receiver/assets/<namespace>/models/` and `textures/`: the corresponding model JSON, PNG images, and required metadata.
- `native/`: the original projectile JSON and particle PNG.

`source-input-lock.json` records the SHA of each canonical input. `resources/` contains the 246 final compiled resources, with their SHAs recorded in `resource-hashes.json`. The build checks the resource snapshot, final ZIP, and client script byte for byte. See [Third-party inputs](THIRD_PARTY_INPUTS.md) and `donor-references.json` for provenance and attribution.
