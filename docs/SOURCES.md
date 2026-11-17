# 资料来源与追溯范围

整理日期：2026-11-17。这里区分「包内可检查的数据」「原包声称的来源」「本次查阅的网页」。来源可定位不等于数据或机制已全部验证。

## 包内资料

| 路径 | 内容与证据边界 |
| --- | --- |
| `data.js` | 页面实际使用的12单位、范围和11张棋盘；`meta.checked` 沿用原包的2026-11-15标注，不能解释为本次全面实测日期 |
| `data-sources/egircal/operators.js` | PRTS衍生数据快照；头部标记由 `scripts/prepare_data.py` 生成，但该脚本与对应上游仓库地址未随包附带 |
| `data-sources/tmp/range_table.json` | 范围表快照，当前包未记录独立下载时间或来源提交 |
| `data-sources/tmp/levels/` | 10份关卡JSON；原包称其源自游戏关卡数据，未附独立下载记录或上游提交 |
| `avatars/`、`maps/`、`banners/` | 原包称来自PRTS托管的游戏图像；未附逐图片来源页、下载日期与授权凭证 |
| `preview*.png` | 原包收录的历史界面截图，不作为当前机制正确性的证据 |

本次未替换原始快照、关卡或图片，未重下游戏数值。`data.js` 只整理来源说明及混入特质资料的解释文字，数值与棋盘不变。

## 原始快照记录的上游入口

以下5个入口直接来自 `operators.js` 的 `sources` 字段：

- [PRTS：卫戍协议·规程](https://prts.wiki/w/卫戍协议·规程)
- [PRTS：规程盟约记录](https://prts.wiki/w/卫戍协议·规程/PRTS盟约记录)
- [PRTS：盟约·特质查询](https://static.prts.wiki/app/spdatabase/index.html)
- [PRTS托管的 activity_table.json](https://torappu.prts.wiki/gamedata/latest/excel/activity_table.json)
- [PRTS托管的 character_table.json](https://torappu.prts.wiki/gamedata/latest/excel/character_table.json)

`latest` 地址会变化，不能用今天返回的文件替代历史版本。快照还记录了下列来源摘要，但本包没有对应完整原文件，**本次未重新计算或独立核验这些摘要**：

| 快照字段 | 原包记录值 |
| --- | --- |
| `activity_table` | `37c1cb97db59de74e92d0f114839e7f0280784d557732da5200976198c6d0f36` |
| `character_table` | `a0b363728f9ac6535c6f4f0a5c2d19f53fb03ee603a09749607cc37c5e3437b2` |
| `battle_equip_table` | `69095a46ea0cc2ef2a52826388e7ae1c3aa82891e1c0f643120f83dd41217844` |
| `uniequip_table` | `ef0be847579bd497911cd590bc33e7ee1da82ed686c73189417568e2568123d8` |

## 本次查阅与表述修正

2026-11-17 查阅了 [PRTS帮助](https://prts.wiki/w/卫戍协议/帮助) 与 [当前规程盟约记录](https://prts.wiki/w/卫戍协议·规程/PRTS盟约记录)，用于检查出处与发现文字差异；未据此改动算法。

- 当前规程记录的伤害用语与旧赛季注释不同，不能把旧版解释直接写成当前已验证机制。本工具保留直接扣血模型，并明确标为待实测。
- 帮助页给出部署顺序的文字优先级；本工具明确公布具体坐标排序，待实测时用实际顺序逐项比对。
- 对同名上限、原天赋/技能和模组作用，没有完整证据链的内容均改为「当前实现」或「待确认」，不再断言官方文本有误、全部天赋无效或面板已经全部对齐。

PRTS是社区维基，不是游戏官方机构。本项目引用其内容不表示双方存在隶属、合作或授权关系。

原包还笼统提及B站作者、文章编号与玩家反馈，但没有附对应片段、时间点或完整证据；这些线索不作为已验证结论的依据。后续贡献请补齐可定位资料。

## 地图03/04手动修订

当前发布数据保留原包覆盖，不在此次文案整理中更改：

- 地图03：第2行第4列不可部署，第2行第6、7列高台。
- 地图04：第1行第2、3、7列不可部署。

坐标均为页面从1起算的「行-列」。原包称依据玩家实战描述，未附独立截图或视频；应按 [M09](KNOWN-ISSUES.md) 补证，不能称为已核实的官方数据修正。

## 许可与发布参考

- [MIT许可说明](https://choosealicense.com/licenses/mit/)：允许商业使用等；第三方内容不自动落入本项目代码许可。
- [GitHub：仓库许可](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)
- [GitHub：上传文件](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)
- [GitHub：Pages发布来源](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

后续更新请记录来源URL、访问日期、具体游戏版本、引用范围，以及可取得时的提交或文件摘要；资料变化应与算法调整分开记录。
