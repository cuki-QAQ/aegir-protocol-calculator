// Node 单元测试：验证引擎吞鱼/继承/倒地/复活/替换逻辑
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function load() {
  const ctx = { window: {}, console };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8'), ctx);
  const ctx2 = { window: ctx.window, console, module: { exports: {} } };
  vm.createContext(ctx2);
  ctx2.window.AEGIR_STATIC = ctx.window.AEGIR_STATIC;
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'engine.js'), 'utf8'), ctx2);
  return ctx2.module.exports.AegirEngine || ctx2.window.AegirEngine;
}

const E = load();
let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  OK', name); }
  else { fail++; console.log('  FAIL', name, extra === undefined ? '' : JSON.stringify(extra)); }
}
const U = (name, r, c, facing, elite) => ({ name, r, c, facing, elite: !!elite });
const only = (res, name) => res.units.find(u => u.name === name);

console.log('== 场景1：长蛇 A->B->C，终端继承、链尾多次被咬 ==');
{
  const res = E.simulate({
    mapId: 'wb', layers: 0, strategyOn: false,
    units: [U('幽灵鲨', 0, 0, 'R'), U('斯卡蒂', 0, 1, 'R'), U('深巡', 0, 2, 'R')],
  });
  console.log('  layersAfter=', res.layersAfter, 'marks=', res.marks);
  check('标记数 = 3', res.marks.length === 3, res.marks);
  check('幽灵鲨继承 842+364=1206 攻', Math.abs(only(res, '幽灵鲨').atk - (519.7 + 842 + 364)) < 1.5, only(res, '幽灵鲨').atk);
  check('幽灵鲨阻挡 2+1+3=6', only(res, '幽灵鲨').block === 6, only(res, '幽灵鲨').block);
  check('倒地顺序 斯卡蒂->深巡', res.deaths.map(d => d.name).join(',') === '斯卡蒂,深巡', res.deaths);
  check('深巡被咬 2 次（A 与 B）', only(res, '深巡').bittenBy.length === 2, only(res, '深巡').bittenBy);
}

console.log('== 场景2：6 名不同阿戈尔，策略开 → 前3倒地按整备区从右到左替换 ==');
{
  const res = E.simulate({
    mapId: 'wb', layers: 0, strategyOn: true,
    units: [
      U('幽灵鲨', 0, 0, 'R'), U('斯卡蒂', 0, 1, 'R'), U('深巡', 0, 2, 'R'), U('安哲拉', 0, 3, 'R'),
      U('水月', 0, 4, 'R'), U('歌蕾蒂娅', 0, 5, 'R'),
    ],
    bench: [{ name: '归溟幽灵鲨', elite: true }, { name: '乌尔比安' }, { name: '浊心斯卡蒂' }],
  });
  console.log('  deaths=', res.deaths.map(d => d.name + ':' + d.action + '(' + (d.benchName || '') + ')'), 'field=', res.field.map(f => f.name + '@' + f.r + ',' + f.c));
  check('高档触发', res.highTier === true);
  check('前3次倒地全部替换（有可部署池）', res.deaths.slice(0, 3).every(d => d.action === 'replace'), res.deaths);
  check('替换顺序取整备区最右（浊心斯卡蒂 最先）', res.deaths[0].benchName === '浊心斯卡蒂', res.deaths[0]);
  check('场上出现被召唤的干员', res.field.some(f => f.from), res.field);
}

console.log('== 场景3：6 名不同阿戈尔，策略关（其他）→ 原地复活 ==');
{
  const res = E.simulate({
    mapId: 'wb', layers: 0, strategyOn: false,
    units: [
      U('幽灵鲨', 0, 0, 'R'), U('斯卡蒂', 0, 1, 'R'), U('深巡', 0, 2, 'R'), U('安哲拉', 0, 3, 'R'),
      U('水月', 0, 4, 'R'), U('歌蕾蒂娅', 0, 5, 'R'),
    ],
  });
  check('「其他」：前3次倒地原地复活（无替换）', res.deaths.slice(0, 3).every(d => d.action === 'revive'), res.deaths);
  check('第4名以后不再复活', res.deaths.slice(3).every(d => d.action === 'none'), res.deaths);
}

console.log('== 场景3b：6 名不同阿戈尔，策略 Pith → 原地复活 ==');
{
  const res = E.simulate({
    mapId: 'wb', layers: 0, strategy: 'pith',
    units: [
      U('幽灵鲨', 0, 0, 'R'), U('斯卡蒂', 0, 1, 'R'), U('深巡', 0, 2, 'R'), U('安哲拉', 0, 3, 'R'),
      U('水月', 0, 4, 'R'), U('歌蕾蒂娅', 0, 5, 'R'),
    ],
  });
  check('Pith：前3次倒地原地复活', res.deaths.slice(0, 3).every(d => d.action === 'revive'), res.deaths);
  check('Pith：第4名以后不再复活', res.deaths.slice(3).every(d => d.action === 'none'), res.deaths);
}

console.log('== 场景4：高台被击倒 + 整备区只有近战 → 留空 ==');
{
  const res = E.simulate({
    mapId: '05', layers: 0, strategyOn: true,
    units: [
      U('安哲拉', 2, 2, 'R', true),
      U('幽灵鲨', 3, 2, 'U'),
      U('斯卡蒂', 3, 1, 'U'), U('深巡', 3, 3, 'U'),
      U('水月', 1, 3, 'D'), U('乌尔比安', 1, 5, 'D'),
    ],
    bench: [{ name: '归溟幽灵鲨' }, { name: '乌尔比安' }, { name: '克莱门莎' }],
  });
  console.log('  deaths=', res.deaths.map(d => d.name + '@' + d.r + ',' + d.c + ':' + d.action + '(' + (d.benchName || '') + ')'));
  const highDeath = res.deaths.find(d => d.r === 2 && d.c === 2);
  check('无非法放置警告', res.warnings.filter(w => w.includes('不能部署')).length === 0, res.warnings);
  check('高台位置无远程后备 → 留空', highDeath && highDeath.action === 'none', highDeath);
}

console.log('== 场景5：部署顺序列优先（先上到下、再左到右）==');
{
  const res = E.simulate({
    mapId: 'wb', layers: 0, strategyOn: false,
    units: [U('幽灵鲨', 0, 0, 'R'), U('斯卡蒂', 0, 1, 'R'), U('深巡', 1, 0, 'R'), U('水月', 1, 1, 'R')],
  });
  const order = res.deployOrder.map(d => d.name).join(',');
  check('顺序 = 幽灵鲨,深巡,斯卡蒂,水月', order === '幽灵鲨,深巡,斯卡蒂,水月', order);
}

console.log('== 场景6：精锐归溟幽灵鲨替身 / 精锐斯卡蒂模组复起（实验性）==');
{
  const res = E.simulate({
    mapId: 'wb', layers: 0, strategyOn: false,
    units: [
      U('幽灵鲨', 1, 0, 'R'),
      U('深巡', 0, 1, 'D'),
      U('斯卡蒂', 1, 1, 'R', true),
      U('水月', 2, 3, 'R'),
      U('归溟幽灵鲨', 2, 4, 'R', true),
    ],
  });
  const sk = res.units.find(u => u.name === '斯卡蒂');
  const gui = res.units.find(u => u.name === '归溟幽灵鲨');
  console.log('  deaths=', res.deaths, '\n  units=', res.units.map(u => [u.name, u.dead, u.substituteUsed, u.moduleReviveUsed, u.hpLeft, u.hpMax]));
  check('斯卡蒂精锐先复起（未倒地）', sk.dead === false && sk.moduleReviveUsed === true, sk);
  check('斯卡蒂复起后生命上限 -40%', Math.abs(sk.hpMax - Math.round(sk.baseHp * (1 + res.layerPct / 100) * 0.6)) < 2, sk.hpMax);
  check('归鲨精锐触发替身（未倒地）', gui.substituteUsed === true && !gui.dead, gui);
}

console.log('== 场景6b：归溟幽灵鲨傀儡形态无敌帧 → 后续吞噬标记取消 ==');
{
  const res = E.simulate({
    mapId: 'wb', layers: 0, strategyOn: false,
    units: [
      U('水月', 1, 0, 'R'),
      U('深巡', 2, 1, 'U'),
      U('归溟幽灵鲨', 1, 1, 'R'),
    ],
  });
  const gui = res.units.find(u => u.name === '归溟幽灵鲨');
  const guiMarks = res.marks.filter(m => m.tgt === '归溟幽灵鲨');
  console.log('  marks=', res.marks.map(m => m.src + '→' + m.tgt + (m.cancelled ? '(取消)' : '')), '\n  gui=', [gui.substituteUsed, gui.subForm, gui.dead, gui.hpLeft]);
  check('第一次致命伤切换傀儡且未阵亡', gui.substituteUsed === true && gui.subForm === true && gui.dead === false, gui);
  check('傀儡状态下的后续吞噬标记被取消', guiMarks.length === 2 && guiMarks.some(m => m.cancelled), guiMarks);
  check('没有任何阿戈尔因此阵亡', res.deaths.length === 0, res.deaths);
}

console.log('== 场景7：歌蕾蒂娅可部署于高台（玩家实测特例）==');
{
  const res = E.simulate({
    mapId: '05', layers: 0, strategyOn: false,
    units: [U('歌蕾蒂娅', 0, 2, 'D')],
  });
  check('歌蕾蒂娅放在高台无警告', res.warnings.filter(w => w.includes('高台')).length === 0, res.warnings);
  check('歌蕾蒂娅保留在场', res.units.length === 1 && res.units[0].name === '歌蕾蒂娅', res.units);
}

console.log('\n结果:', pass, 'passed,', fail, 'failed');
process.exit(fail ? 1 : 0);
