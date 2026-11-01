**English** · [简体中文](README.zh-CN.md)

# Create Style Dyson

A Create-style makeover for Dyson Cube Project’s electromagnetic ejector and ray receiver. New metal frames, coils, cables and moving brass hydraulics give both machines a mechanical look while keeping their original firing and power-generation behavior.

| Electromagnetic ejector | Ray receiver |
| :---: | :---: |
| ![Electromagnetic ejector in game](previews/electromagnetic-ejector.png) | ![Ray receiver in game](previews/ray-receiver.png) |

## Requirements

| Minecraft | Mod loader | Java |
| --- | --- | --- |
| 1.20.1 (Java Edition) | [Forge 47.4.10](https://files.minecraftforge.net/net/minecraftforge/forge/index_1.20.1.html) | [17](https://adoptium.net/temurin/releases/?version=17) |

This release is for **Forge**. Fabric and NeoForge versions are not available.

Install these mods in your client's `mods/` folder. The links below open the matching Forge downloads. If your modpack already includes them, you can skip this step.

| Required mod | Download |
| --- | --- |
| Dyson Cube Project (Forge) | [1.0.5.1](https://www.curseforge.com/minecraft/mc-mods/dyson-cube-project-forge/files/9025750) |
| Titanium | [3.8.35](https://www.curseforge.com/minecraft/mc-mods/titanium/files/8426836) |
| KubeJS | [2001.6.5-build.26](https://www.curseforge.com/minecraft/mc-mods/kubejs/files/8020595) |
| Rhino | [2001.2.3-build.10](https://www.curseforge.com/minecraft/mc-mods/rhino/files/6186971) |
| Architectury API | [9.2.14](https://www.curseforge.com/minecraft/mc-mods/architectury-api/files/5137938) |

## Installation

**Install both the resource pack and the included client script. They work together.**

1. Open your Minecraft 1.20.1 Forge instance in your launcher and select Java 17. Close the game before copying files.
2. Use your launcher’s **Open game folder** button to find this instance. Put the required mod `.jar` files in its `mods/` folder.
3. [Download the client pack](https://github.com/Eldershi/create-style-dyson/releases/download/v1.0.1-mc1.20.1/Create-Style-Dyson-1.0.1-MC1.20.1-Client.zip) and extract the downloaded archive.
4. Inside it, find `Dyson-Create-Approved-Models-Forge-1.20.1.zip` under `config/paxi/resourcepacks/`. Copy that ZIP into your game's `resourcepacks/` folder. **Keep this inner ZIP zipped.**
5. Copy `90_dcp_approved_visuals.js` from `kubejs/startup_scripts/` into your game directory’s `kubejs/startup_scripts/` folder. Create the folders if needed.
6. Start the game, open **Options → Resource Packs**, and enable the pack. Place it above other packs that change these machines.

Fully restart the client after installing or updating the script; reloading resource packs alone does not load it.

<details>
<summary>Already using Paxi?</summary>

1. Copy the inner resource ZIP into `config/paxi/resourcepacks/` in your game folder.
2. Copy the included client script into `kubejs/startup_scripts/`.
3. Open `config/paxi/resourcepack_load_order.json`. Add `Dyson-Create-Approved-Models-Forge-1.20.1.zip` as the last item in the `loadOrder` list, keeping your existing entries.
4. Fully restart the client. Use this Paxi copy instead of placing a second copy in `resourcepacks/`.

</details>

To uninstall, remove both the resource ZIP and `90_dcp_approved_visuals.js`.

[Credits](CREDITS.md) · [Asset licenses](ASSET-LICENSES.md)
