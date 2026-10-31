# 构建输入与资源快照

[English](input-layout.md) | 简体中文

`source/` 包含49项已锁定的规范美术输入。默认运行 `python3 build.py` 即从仓库内输入重建，不需要外部美术目录。可用 `--source-inputs` 指定同一锁定内容的另一目录。

- `rail/payload.json`：发射器编译几何、UV和原像素数据。
- `rail/scene.js`：发射器规范姿态函数。
- `receiver/payload.json`、`receiver/scene.js`：接收器编译数据与规范姿态函数。
- `receiver/assets/<namespace>/models/`、`textures/`：对应模型JSON、PNG及必要元数据。
- `native/`：原弹丸JSON与粒子PNG。

`source-input-lock.json` 逐项记录规范输入SHA；`resources/` 保存246项最终编译资源，`resource-hashes.json` 记录其SHA。构建逐字节核对资源快照、最终ZIP和客户端脚本。来源与署名见 [THIRD_PARTY_INPUTS.zh-CN.md](THIRD_PARTY_INPUTS.zh-CN.md)、`donor-references.json`。
