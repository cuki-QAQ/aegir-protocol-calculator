# 开发说明：v13

当前行为规格见 [计算口径](CALCULATION.md)，缺口见 [已知问题](KNOWN-ISSUES.md)。本文件用于帮助接手源码，不将计划功能写成已实现效果。

## 文件职责

| 文件 | 职责 |
| --- | --- |
| `index.html` | 页面结构、静态操作说明与页脚 |
| `styles.css` | 页面、地图、方向菱形与结果样式 |
| `app.js` | 状态、鼠标拖拽、选向、参数输入、本地存储与结果展示 |
| `engine.js` | 不依赖DOM的开局模拟，使用数据快照 |
| `data.js` | `window.AEGIR_STATIC`：meta、operators、ranges、maps |
| `test_engine.cjs` | 在Node的vm中载入数据与引擎，运行当前24个断言 |
| `tools/` | 历史数据生成/分析脚本，尚未同步到当前发布结构 |

## 引擎接口

```javascript
const result = AegirEngine.simulate({
  mapId: 'wb', // 01,02,03,04,05,06,09,10,11,12,wb
  layers: 0,
  own: { phase: 2, level: 60 },
  strategy: 'gladiia', // gladiia | pith | other
  units: [
    { name: '幽灵鲨', elite: false, r: 0, c: 0, facing: 'R',
      extraHpPct: 0, extraDefPct: 0, extraAtkPct: 0,
      own: null, potential: 1, module: 1 }
  ],
  bench: [], // 从左到右；引擎从数组末尾向前挑选
  applyTalents: false
});
```

坐标从0起算，界面从1起算。`own` 省略时默认无持有加成，页面默认值则为精2Lv60。API不完整校验页面容量限制，不应直接信任外部任意输入。`extraDefPct` 目前未使用，`applyTalents` 不是完整天赋实现。

输出包括 `units`、`marks`、`deaths`、`field`、`deployOrder`、`distinctAegir`、`activation`、`harmonyBonus`、`highTier`、`layersAfter`、`layersFromDevour`、`layerPct`、`logs`、`warnings`。

- `layerPct` 是 `35 + layersAfter` 的显示参数；未激活时也会返回该参数，实际生命计算另有激活判断。
- `units` 主要是初始场上实例，`field` 是结算后场上，可能含替补；两者不是同一集合。
- 标记以内部实例区分，但导出关系只含名字；同名场景应结合位置与单位记录检查。
- `layersFromDevour` 按全部标记的唯一目标统计，包含取消标记，不是自动推进下一回合的状态。
- `strategyOn` 是保留的旧接口参数，表示是否使用猎人战法；新调用优先明确传入 `strategy`。

## 本地检查

```powershell
node --check app.js
node --check engine.js
node --check data.js
node test_engine.cjs
```

当前原有测试24个断言；不需要安装npm依赖。它们不覆盖全部同名、面板、存档、交换和时间轴问题。新增测试应说明验证的业务差异，不把现有结果直接当作游戏真值。

## 数据重建状态

不要直接运行历史 `tools/build_data.py` 覆盖当前发布数据。当前脚本：

- 默认从项目根目录找 `egircal/`、`tmp/`，而包内资料位于 `data-sources/`。
- 即使把 `AEGIR_ROOT` 指向 `data-sources`，输出仍写往该目录下的 `aegir/data.js`，且脚本未创建输出目录。
- 只按10名阿戈尔构造数据，未完整重建魔王、盟约·辅助干员、当前模组集合及后加修订。
- 会生成不同的面板组合，未完整保留地图03/04覆盖和预览字段。

`analyze_maps.py`、`analyze_rounds.py` 还含原作者机器上的本地路径，普通用户无需运行。若恢复管线，应先改为明确输入/输出，补齐字段与覆盖记录，再与发布数据逐项比较；完成前不宣传「一键可重建」。

当前若需要修订数据，可在独立分支精确修改 `data.js` 并附字段差异、来源和验证。原始快照保留不动，来源与已知缺口应同步更新。

## 调试入口

`?dev=1` 会在 `window.__A` 暴露部分内部状态与渲染方法，只用于本地调试；不能当作稳定公共接口。`?demo=...` 为原包演示场景，会替换当前展示状态；测试前记录需要保留的配置。

可用演示值：`select`、`pending`、`six`、`high`、`pith`、`move`、`bench`、`mapmenu`、`preview`、`ressel`、`other`、`grid`。演示与截图不证明完整交互或实战正确性。

本地状态使用 `localStorage` 的 `aegirCalc.v3` 键，键名沿用旧版以兼容存档，不代表产品仍是v3。重新载入字段保留不完整，见K01/K02。

## 发布工作流

`.github/workflows/pages.yml` 在main的push上检查并部署；PR和手动触发只检查。现有工作流检查 `app.js`、`engine.js` 语法并运行引擎测试，尚不包含全部浏览器交互检查。使用方法见 [上线指南](GITHUB-上线指南.md)。
