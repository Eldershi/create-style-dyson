# Create Style Dyson

Minecraft 1.20.1 / Forge 47.4.10 的戴森球客户端视觉实现。本仓库维护自有渲染、姿态、导出和构建代码，以及输入/产物哈希和当前需求清单。完整美术输入、PNG、模型网格、编译payload与ZIP不在仓库中。

**本机构建需要未上传的私有美术输入。** 已获授权的本机使用和安装，不等同于现成素材或派生美术已经获得对外发布许可。当前代码仓库不能独立生成或提供完整材质包下载；第三方来源与许可核查见 `THIRD_PARTY_INPUTS.md`。源码不改变这些素材的权利归属。

客户端通过现有 KubeJS / Rhino / Architectury 绘制独立部件，依赖原 Dyson Cube Project Forge 1.0.5.1 与 Titanium 3.8.35。发射器24种模型/30实例，保留回转平台、承托、双液压和折返线缆；接收器25种模型/47实例，保留0～70°机械行程并按原native角驱动，视觉yaw固定0，不声称是180°机械行程。

原DCP自身缺陷只记录，不修改其工作逻辑、能量规则或原蓝色全息效果；本项目修复范围是资源替换和客户端脚本自身引入的问题。原充能、发射及相关特效由原Java渲染器提供，炮身输入坐标的20像素对齐保持。炮尾门常闭，不增加装填、退座或开门动作。

使用Python3.12、Pillow12.3.0、numpy2.3.5、Node.js24.19.0构建：

```sh
python3 -m pip install -r requirements.txt
python3 tools/check_public_tree.py
python3 build.py --private-inputs /path/to/local/private-inputs
```

私有目录的文件名与SHA列在 `private-input-lock.json`；其内容不随仓库提供。构建读取本机输入，生成并验证 `outputs/` 中的246项资源、匹配ZIP与客户端脚本。`tools/extract_reference.py` 可从使用者本地已有的依赖JAR提取并核对单个参考文件；提取文件仍留在本机私有目录，不能据此推定发布许可。

`client/kubejs/startup_scripts/90_dcp_approved_visuals.js` 是生成的客户端代码，必须与本机对应的资源包配套。完整ZIP不上传。整合包仓库只保存本仓库的提交引用、包/脚本SHA及Paxi集成配置。实装使用单份Paxi资源包并保留其它包顺序。

`artifact-lock.json` 记录构建产物，`resource-hashes.json` 记录资源哈希而不包含资源内容。`validation-report.json` 独立说明实际验证范围；原始游戏PNG留在本地，仅在报告中绑定哈希与状态。构建与数值测试不等同于完整395模组、原生工作状态或外观验收。全部当前要求见 `requirements-checklist.md`。
