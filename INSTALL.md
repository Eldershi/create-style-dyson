**English** · [简体中文](INSTALL.zh-CN.md)

# Installation

## Requirements

| Edition | Minecraft | Mod loader | Java |
| --- | --- | --- | --- |
| Forge | 1.20.1 (Java Edition) | [Forge 47.4.10](https://files.minecraftforge.net/net/minecraftforge/forge/index_1.20.1.html) | [17](https://adoptium.net/temurin/releases/?version=17) |
| NeoForge | 1.21.1 (Java Edition) | [NeoForge 21.1.251](https://projects.neoforged.net/neoforged/neoforge) | [21](https://adoptium.net/temurin/releases/?version=21) |

Download the edition that matches your instance. A Fabric version is not available.

Install these mods in your client's `mods/` folder. If your modpack already includes them, you can skip this step.

**Forge 1.20.1** — the links open the matching Forge downloads.

| Required mod | Download |
| --- | --- |
| Dyson Cube Project (Forge) | [1.0.5.1](https://www.curseforge.com/minecraft/mc-mods/dyson-cube-project-forge/files/9025750) |
| Titanium | [3.8.35](https://www.curseforge.com/minecraft/mc-mods/titanium/files/8426836) |
| KubeJS | [2001.6.5-build.26](https://www.curseforge.com/minecraft/mc-mods/kubejs/files/8020595) |
| Rhino | [2001.2.3-build.10](https://www.curseforge.com/minecraft/mc-mods/rhino/files/6186971) |
| Architectury API | [9.2.14](https://www.curseforge.com/minecraft/mc-mods/architectury-api/files/5137938) |

**NeoForge 1.21.1** — the links open each mod's NeoForge 1.21.1 file list. The listed versions are the ones tested.

| Required mod | Download |
| --- | --- |
| Dyson Cube Project | [1.0.5](https://www.curseforge.com/minecraft/mc-mods/dyson-cube-project/files/all?version=1.21.1&gameVersionTypeId=6) |
| Titanium | [4.0.50](https://www.curseforge.com/minecraft/mc-mods/titanium/files/all?version=1.21.1&gameVersionTypeId=6) |
| KubeJS | [2101.7.2-build.374](https://www.curseforge.com/minecraft/mc-mods/kubejs/files/all?version=1.21.1&gameVersionTypeId=6) |
| Rhino | [2101.2.8-build.91](https://www.curseforge.com/minecraft/mc-mods/rhino/files/all?version=1.21.1&gameVersionTypeId=6) |

## Installation

### Forge 1.20.1

**Install the resource pack, client script and included rendering compatibility mod together. The compatibility mod belongs on the client only.**

1. Open your Minecraft 1.20.1 Forge instance in your launcher and select Java 17. Close the game before copying files.
2. Use your launcher’s **Open game folder** button to find this instance. Put the required mod `.jar` files in its `mods/` folder.
3. [Download the Forge client pack](https://github.com/Eldershi/create-style-dyson/releases/download/v1.1.0-mc1.20.1/Create-Style-Dyson-1.1.0-MC1.20.1-Client.zip) and extract the downloaded archive.
4. Inside it, find `Dyson-Create-Approved-Models-Forge-1.20.1.zip` under `config/paxi/resourcepacks/`. Copy that ZIP into your game's `resourcepacks/` folder. **Keep this inner ZIP zipped.**
5. Copy `90_dcp_approved_visuals.js` from `kubejs/startup_scripts/` into your game directory’s `kubejs/startup_scripts/` folder. Create the folders if needed.
6. Copy `create-style-dyson-compat-1.1.0.jar` from the download’s `mods/` folder into your game’s `mods/` folder. Remove older versions of this compatibility mod when updating.
7. Start the game, open **Options → Resource Packs**, and enable the pack. Place it above other packs that change these machines.

Fully restart the client after installing or updating the script or compatibility mod; a resource-pack reload does not load these files.

<details>
<summary>Already using Paxi?</summary>

1. Copy the inner resource ZIP into `config/paxi/resourcepacks/` in your game folder.
2. Copy the included client script into `kubejs/startup_scripts/` and `create-style-dyson-compat-1.1.0.jar` into `mods/`.
3. Open `config/paxi/resourcepack_load_order.json`. Add `Dyson-Create-Approved-Models-Forge-1.20.1.zip` as the last item in the `loadOrder` list, keeping your existing entries.
4. Fully restart the client. Use this Paxi copy instead of placing a second copy in `resourcepacks/`.

</details>

To uninstall, remove the resource ZIP, `90_dcp_approved_visuals.js` and `create-style-dyson-compat-1.1.0.jar`.

### NeoForge 1.21.1

**Install the resource pack and client script together. This edition needs no extra compatibility mod.**

1. Open your Minecraft 1.21.1 NeoForge instance in your launcher and select Java 21. Close the game before copying files.
2. Use your launcher’s **Open game folder** button to find this instance. Put the required mod `.jar` files in its `mods/` folder.
3. [Download the NeoForge client pack](https://github.com/Eldershi/create-style-dyson/releases/download/v1.1.0-mc1.21.1-neoforge/Create-Style-Dyson-1.1.0-MC1.21.1-NeoForge-Client.zip) and extract the downloaded archive.
4. Copy `Dyson-Create-Approved-Models-NeoForge-1.21.1.zip` from its `resourcepacks/` folder into your game's `resourcepacks/` folder. **Keep this inner ZIP zipped.**
5. Copy `90_dcp_approved_visuals.js` from `kubejs/startup_scripts/` into your game directory’s `kubejs/startup_scripts/` folder. Create the folders if needed.
6. Start the game, open **Options → Resource Packs**, and enable the pack. Keep it above **Mod Resources** and any other packs that change these machines; otherwise parts of the original models show through.

Fully restart the client after installing or updating the script; a resource-pack reload does not load it.

To uninstall, remove the resource ZIP and `90_dcp_approved_visuals.js`.

[Back to the project page](README.md)
