# 从源码构建

[English](DEVELOPING.md) · **简体中文**

安装与使用请看[安装说明](../INSTALL.zh-CN.md)。

## 构建

仓库的 `source/` 包含规范美术输入，`resources/` 保存编译资源快照。默认构建直接使用这些文件，不需要另行下载美术或从依赖模组 JAR 提取素材。

构建环境为 Python **3.12**、Node.js **24.19.0**，以及 `requirements.txt` 固定的 Python 依赖（Pillow **12.3.0**、NumPy **2.3.5**）。在仓库根目录运行：

```sh
python3 -m pip install -r requirements.txt
python3 tools/check_public_tree.py
python3 build.py
```

构建会导出模型、核对原姿态函数与客户端可见性补绘逻辑，再依据锁文件验证资源快照和最终产物。

生成文件：

- `outputs/Dyson-Create-Approved-Models-Forge-1.20.1.zip`
- `outputs/scripted-client/kubejs/startup_scripts/90_dcp_approved_visuals.js`
- `outputs/build-validation.json`

生成的资源包和脚本需按照[安装说明](../INSTALL.zh-CN.md)配套安装。

## 源码布局

- `source/rail/`：电磁发射器的编译源几何、像素与参考姿态函数。
- `source/receiver/`：射线接收器的源几何、像素、模型 JSON 与参考姿态函数。
- `source/native/`：原生特效委托使用的弹丸模型与粒子贴图。
- `src/runtime/`：客户端渲染器与可见性补绘逻辑。
- `export_rail_scripted.py`、`export_rail_scripted_item.py`、`export_receiver_scripted.py`：资源导出器。
- `build_scripted_bundle.py`：资源包与客户端脚本组装。
- `tests/`：姿态数值与可见性补绘检查。

渲染器使用现有 KubeJS / Rhino / Architectury 环境，将原生充能、发射和蓝色全息效果交由 Dyson Cube Project 绘制。本项目不修改原模组的玩法，也不修复原模组自身缺陷；修复范围是本项目资源与客户端脚本引入的问题。

## 可见性发现

补绘只跟踪相机周围 9 × 9 区块窗口内已经缓存的区块。每个客户端 END tick 最多进行 8 次不加载区块的查询、访问 128 个方块实体：FIFO 队列最多续扫 3 段，每段 32 个实体；另外查询 5 个网格位置，共享 32 个实体的发现额度。无关方块实体先通过类型检查排除，不查询其状态。区块事件不会触发全世界扫描。

实体映射迭代器分 tick 推进。发生并发修改时，只重新扫描对应区块；定期发现也能补查区块加载事件之后才加入的方块实体。区块替换、卸载、相机移动、世界切换与退出会丢弃失效引用。补绘出现意外错误后会清空跟踪并停止发现。

补绘仍遵循原生 64 格距离，以及原生包围盒不可见、完整模型包围盒可见的判断。发现过程分步完成，异常密集或持续变化的区块可能延迟补绘。Node 契约测试验证两套映射下的工作量上限与生命周期，不测量游戏 FPS；实际 Forge 验证范围见 `validation-report.json`。

## 输入与产物锁

[输入布局](../input-layout.md)说明源文件结构。`source-input-lock.json` 固定输入哈希，`resource-hashes.json` 固定编译资源快照，`artifact-lock.json` 固定资源 ZIP 与生成的客户端脚本。仓库中的 `client/kubejs/startup_scripts/90_dcp_approved_visuals.js` 是生成脚本，需与对应资源包保持一致。

`build.py` 可通过 `--source-inputs <目录>` 或 `DCP_SOURCE_INPUTS` 使用另一份内容相同的锁定输入；默认读取仓库内的 `source/`。

`tools/check_public_tree.py` 检查发布路径、哈希、PNG、OBJ 及模型和材质引用。`tools/extract_reference.py` 可核对并提取本地依赖 JAR 中的单项资源，正常构建无需运行它。

上游来源见[署名](../CREDITS.md)、[美术许可](../ASSET-LICENSES.md)、[来源说明](../THIRD_PARTY_INPUTS.md)和 `donor-references.json`。当前要求列在 `requirements-checklist.md`，`validation-report.json` 记录实际游戏验证范围。构建通过不代表对所有光影包或模组组合的保证。
