# 本机私有输入目录

构建以`--private-inputs`或`DCP_PRIVATE_INPUTS`指定目录。目录中的文件只在本机使用，不进入本仓库。精确校验值见`private-input-lock.json`。

- `rail/payload.json`：完整本机发射器编译输入。
- `rail/scene.js`：本机参考姿态函数。
- `receiver/payload.json`与`receiver/scene.js`：本机接收器输入和参考姿态。
- `receiver/assets/<namespace>/models/`与`textures/`：本机对应原模型、PNG及必要元数据。
- `native/`：本机原弹丸JSON和粒子PNG。

远端不携带这些数据。哈希和提取工具用于匹配使用者自己已有的合法来源，不提供素材下载或对外发布许可。
