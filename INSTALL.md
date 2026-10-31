# 安装与使用

适用于 Minecraft 1.20.1、Forge 47.4.10、Java 17。客户端需要现有的 Dyson Cube Project Forge 1.0.5.1、Titanium 3.8.35、KubeJS 2001.6.5-build.26、Rhino 2001.2.3-build.10 和 Architectury 9.2.14。下载包不附带模组 JAR。

下载的 `Create-Style-Dyson-1.0.0-MC1.20.1-Client.zip` 是安装文件集合，需要先解压。里面的资源包与客户端脚本必须配套安装。

## 使用 Paxi 的客户端

1. 完整退出游戏，备份同名文件。
2. 将解压得到的 `config/` 和 `kubejs/` 合并到客户端游戏目录。这只会放入本项目的资源 ZIP 和客户端脚本，不会覆盖整套配置。
3. 在 `config/paxi/resourcepack_load_order.json` 的 `loadOrder` 数组末尾追加 `Dyson-Create-Approved-Models-Forge-1.20.1.zip`，保留原有条目和顺序，同名项目只保留一次。
4. 完整重启客户端。

## 不使用 Paxi 的客户端

1. 将内层 `Dyson-Create-Approved-Models-Forge-1.20.1.zip` 放入游戏目录的 `resourcepacks/`，在资源包界面启用并置于需要覆盖的包之上。
2. 将 `90_dcp_approved_visuals.js` 放入 `kubejs/startup_scripts/`。
3. 完整重启客户端。只重载资源包不能代替首次加载启动脚本。

同名资源 ZIP 选择一种安装位置即可。脚本只在客户端运行，不需要把这套视觉脚本装到专用服务端。原模组的多人游戏依赖按其自身要求配置。

## 模型与验证范围

包括电磁发射器和射线接收器的完整模型、贴图、平台、承托、液压与线缆。发射器使用原生回转、俯仰、充能和发射状态；接收头保持确认的 0～70°机械行程，由原生角度映射驱动。炮尾门常闭，原模组蓝色全息效果保留。

当前匹配文件已在 395 模组客户端副本中验证：21组姿态、两次原生发射、接收器白天／夜间／稳定雨天／遮挡及物品栏显示。未将这些结果扩展为所有光影包或任意模组组合的保证。文件 SHA 和实际验证范围见 `file-manifest.json`、`validation-report.json`。

安装后启动脚本与资源包应同时启用；卸载时也应成对移除。此前已安装相同 SHA 的客户端无需重复安装。
