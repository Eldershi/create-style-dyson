# 美术来源、引用与发布依据

当前仓库保存代码、资源ID和哈希，完整美术输入尚未提交。这个仓库状态不能推导成“所有现成素材或整个材质包都不能发布”。许可文件、作者补充说明、社区使用方式与具体打包内容需要一起核对。

Create 官方仓库的[讨论 #9857](https://github.com/Creators-of-Create/Create/issues/9857)有贡献者转述美术作者的说明：保留美术权利与允许社区附属复用并存，ARR 是权利保留的澄清。该讨论不是把美术改为 MIT；也不能仅凭 ARR 标签宣布所有社区复用均被禁止。[资源包案例 #9594](https://github.com/Creators-of-Create/Create/issues/9594)还记录了针对具体智能侦测器贴图的作者许可。[ReCreate 的来源说明](https://github.com/Gordon-Frohman/ReCreate#%EF%B8%8F-legal-matters)明确记录其已获 Create 团队许可。具体案例的授权范围与一般社区说明分别记录，不互相替代。

| 输入 | 已确认依据 | 使用与发布处理 |
| --- | --- | --- |
| Create 基础资源 | 实际 donor 许可保留美术权利；上述官方仓库讨论支持社区附属复用。 | 可采用自研结构配合 Create 资源引用的方式。直接打包副本与运行时引用分别登记，保留上游来源和署名；不以 ARR 标签一律排除。 |
| Aeronautics/Simulated 资源 | 实际外层及内嵌JAR许可保留其美术权利。 | 单独记录实际来源、引用或打包方式及对应补充许可。Create 的说明不自动代替其他作者的说明；当前记录不作统一禁止结论。 |
| Dyson Cube Project Forge | [官方文件页](https://www.curseforge.com/minecraft/mc-mods/dyson-cube-project-forge/files/9025750)登记许可；本项目依赖原模组并委托其原渲染器和特效。 | 区分依赖调用、资源引用与直接带入的原始素材，不把自研替换模型等同于重新分发整个原模组。 |
| Create Crafts & Additions | 实际JAR及[官方许可](https://github.com/mrh0/createaddition/blob/main/LICENSE)声明 MIT。 | 保留适用的版权与许可通知；已有附属直接使用 Create 资源ID的做法可作为技术参考。 |
| Create Big Cannons | 实际JAR及[官方许可](https://github.com/Cannoneers-of-Create/CreateBigCannons/blob/create-v6-1.21.1/LICENSE.md)将手工模型、贴图列为 CC BY-NC-SA 4.0，代码另为 MIT。 | 对应美术按署名、非商业和相同方式共享等条件处理，不误标为代码的 MIT。 |
| 本地调色与连续纹理 | 源SHA与资源ID记录在 `donor-references.json`。 | 按实际来源逐项判断；不把“经过调色”当成自动取得新权利，也不笼统认定所有派生输入均不能发布。 |

原生资源ID可在模型或材质中引用，由已安装的前置模组提供像素；这与在ZIP中携带PNG副本不同。引用也会受到玩家启用的资源包覆盖。保持已确认外观时，需要核对最终解析到的图像，不能只删除副本就宣布同像素等价。

`tools/check_public_tree.py` 检查当前源码上传范围，避免把构建输入意外带入；它不是对全部美术发布权的判决。模型、材质与客户端实装保持已确认产物，本说明不触发替换或重画。
