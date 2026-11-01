# 从源码构建

[English](DEVELOPING.md) · **简体中文**

安装与使用请看[安装说明](../INSTALL.zh-CN.md)。

## 构建

仓库的 `source/` 包含规范美术输入，`resources/` 保存编译资源快照。默认构建直接使用这些文件，不需要另行下载美术或从依赖模组 JAR 提取素材。

构建使用 Python **3.12**、Node.js **24**、JDK **17** 和 `requirements.txt` 固定的 Python 依赖。原生组件需要 Forge 打补丁后的 Minecraft 1.20.1 客户端（`forge-1.20.1-47.4.10-client.jar`），并以原版 Minecraft SRG JAR 为依赖，以及 Dyson Cube Project 1.20.1+1.0.5.1、Titanium 3.8.35、Forge 47.4.10 及其缓存依赖，包括 Mixin 0.8.5。将依赖 JAR 路径放入 JSON 数组；这些依赖不随项目再分发。在仓库根目录运行：

```sh
python3 -m pip install -r requirements.txt
python3 tools/check_public_tree.py
python3 build.py --game-jar /path/to/forge-1.20.1-47.4.10-client.jar --dyson-jar /path/to/dysoncubeproject-1.20.1+1.0.5.1.jar --classpath-file /path/to/dependencies.json --jdk /path/to/jdk17
```

完整构建检查规范姿态、连续渲染范围、Java 包装器契约及两个 DCP 类的真实 Mixin 变换，再验证资源、脚本与兼容组件哈希。原生组件锁定产物使用 JDK 17.0.5 构建。`python3 build.py --resources-only` 仅检查美术和脚本，不生成完整客户端安装内容。

可增加 `--embeddium-jar /path/to/embeddium-0.3.31.jar`，核验可选的分段绘制归属钩子；运行本包不要求安装 Embeddium。

生成文件：

- `outputs/Dyson-Create-Approved-Models-Forge-1.20.1.zip`
- `outputs/scripted-client/kubejs/startup_scripts/90_dcp_approved_visuals.js`
- `outputs/native-compat/create-style-dyson-compat-1.1.0.jar`
- `outputs/build-validation.json`

三个客户端文件须按照[安装说明](../INSTALL.zh-CN.md)配套安装。

## 源码布局

- `source/rail/`：电磁发射器的编译源几何、像素与参考姿态函数。
- `source/receiver/`：射线接收器的源几何、像素、模型 JSON 与参考姿态函数。
- `source/native/`：原生特效委托使用的弹丸模型与粒子贴图。
- `src/runtime/`：KubeJS 姿态渲染及原生特效委托。
- `src/compat/`：客户端范围适配、原生 BER 包装器及 Java/Mixin 契约。
- `export_rail_scripted.py`、`export_rail_scripted_item.py`、`export_receiver_scripted.py`：资源导出器。
- `build_scripted_bundle.py`：资源包与客户端脚本组装。
- `tests/`：规范姿态、生成范围、脚本注册及生命周期契约。
- `tools/build_compat.py`：使用指定依赖编译并打包原生组件。

渲染器使用现有 KubeJS / Rhino / Architectury 环境，将原生充能、发射和蓝色全息效果交由 Dyson Cube Project 绘制。本项目不修改原模组的玩法，也不修复原模组自身缺陷；修复范围是本项目资源与客户端脚本引入的问题。

## 原生可见性

两个仅在客户端生效的 Mixin，将控制器原版范围与覆盖全部认可姿态的有限包围盒合并；轨道炮同时保留原生特效范围向上平移 1.25 格后的部分。各控制器按资源 epoch、位置及原版范围缓存结果，不持有世界、区块或方块实体引用。

原生生命周期钩子将这两类控制器逐个登记到 Minecraft 全局方块实体列表，并在移除或区块卸载时逐个注销。弱引用索引只记录已经登记的控制器，在渲染器重建后恢复登记，在世界切换时清理旧条目，不搜索区块或其他方块实体。

Java BER 包装器保留离开所在分段后的绘制资格、修正范围的视锥剔除和委托的 64 格距离判断。可选 Embeddium 钩子排除它对这些控制器的网格列表登记，使未编译的视野外分段也能由原生全局通道单独负责绘制。现有渲染器使用游戏提供的缓冲区，不运行周期性发现扫描，也不进行独立补绘。

模型烘焙刷新资源可用状态。关闭认可资源包时使用原版范围与原生美术，重新启用后刷新模型和范围缓存。脚本的类型化 BER 委托在启动时预先创建，以便 Java 重载线程安全获取。

异步模型准备前，客户端钩子让 Forge OBJ 加载器使用本轮资源管理器并清空解析缓存；仅在认可资源已启用或本轮存在完整资源根时执行。

`tools/generate_compat_bounds.cjs` 按认可场景图，通过旋转轴解析半径与有界 IK 支点区间生成包围盒，并向外舍入、加入渲染浮点余量。姿态采样用于核对场景图实现，连续覆盖依据是解析包围运算。实际游戏验证范围见 `validation-report.json`。

## 输入与产物锁

[输入布局](../input-layout.zh-CN.md)说明源文件结构。`source-input-lock.json` 固定输入哈希，`resource-hashes.json` 固定编译资源快照，`artifact-lock.json` 固定资源 ZIP、客户端脚本和原生组件。`client/kubejs/startup_scripts/90_dcp_approved_visuals.js` 是仓库中的生成脚本。

`build.py` 可通过 `--source-inputs <目录>` 或 `DCP_SOURCE_INPUTS` 使用另一份内容相同的锁定输入；默认读取仓库内的 `source/`。

`tools/check_public_tree.py` 检查发布路径、哈希、PNG、OBJ 及模型和材质引用。`tools/extract_reference.py` 可核对并提取本地依赖 JAR 中的单项资源，正常构建无需运行它。

上游来源见[署名](../CREDITS.md)、[美术许可](../ASSET-LICENSES.md)、[来源说明](../THIRD_PARTY_INPUTS.md)和 `donor-references.json`。当前要求列在 `requirements-checklist.md`，`validation-report.json` 记录实际游戏验证范围。构建通过不代表对所有光影包或模组组合的保证。
