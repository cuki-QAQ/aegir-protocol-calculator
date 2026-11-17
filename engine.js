/* 阿戈尔盟约 · 开局吞噬结算引擎 (卫戍协议·规程 序列Ⅰ)
 * 纯函数，无 DOM 依赖；Node 下 module.exports = AegirEngine
 *
 * 依据与边界详见 docs/CALCULATION.md、docs/SOURCES.md、docs/KNOWN-ISSUES.md。
 * 本文件实现的是开局简化模型，不代表游戏规则已获完整验证。
 * 当前按列优先生成标记，先继承再结算伤害；取消标记不回滚继承与参考叠层。
 * 页面调用时 applyTalents=false；只单独处理少数职业/模组机制，不模拟全部技能或特质。
 * 调和使激活人数合计+1，可参与吞噬，不占阿戈尔倒地名额。
 * 归溟幽灵鲨的本次结算内傀儡保护、斯卡蒂复起与叠层时序均属待实战确认的模型假设。
 */
(function (global) {
  'use strict';

  var DATA = global.AEGIR_STATIC;
  if (!DATA && typeof require === 'function') {
    try { DATA = require('./data.js').AEGIR_STATIC; } catch (e) { /* loaded via vm in tests */ }
  }

  var DIRS = { R: [0, 1], D: [1, 0], L: [0, -1], U: [-1, 0] };
  var DIR_ORDER = ['R', 'D', 'L', 'U'];
  var GROUND_CODES = { G: 1, F: 1, I: 1, M: 1, D: 1, P: 1 };
  var HIGH_CODES = { H: 1 };

  function rangeCells(rangeId, facing, r, c) {
    var rng = DATA.ranges[rangeId];
    if (!rng) return [];
    var cells = [];
    for (var i = 0; i < rng.grids.length; i++) {
      var g = rng.grids[i], dr = g.row, dc = g.col, rr, cc;
      switch (facing) {
        case 'R': rr = r + dr; cc = c + dc; break;
        case 'D': rr = r + dc; cc = c - dr; break;
        case 'L': rr = r - dr; cc = c - dc; break;
        case 'U': rr = r - dc; cc = c + dr; break;
      }
      cells.push([rr, cc]);
    }
    return cells;
  }

  function getOp(name) {
    for (var i = 0; i < DATA.operators.length; i++) if (DATA.operators[i].name === name) return DATA.operators[i];
    return null;
  }

  // 本工具允许远程干员与歌蕾蒂娅部署在高台；参见计算口径。
  function canHigh(op) {
    if (!op) return false;
    return op.position === 'RANGED' || op.name === '歌蕾蒂娅';
  }

  // 当前实现：快照基准值 + 潜能平加 + 选中模组平加，再乘持有练度系数。
  function panelOf(op, elite, own, potential, moduleIdx) {
    var st = op.states[elite ? 1 : 0];
    own = own || { phase: 0, level: 0 };
    var maxPot = Math.max(1, Math.min(6, potential || 1));
    var potAtk = 0, potHp = 0, potDef = 0;
    var pots = op.potentials || [];
    for (var pi = 2; pi <= maxPot; pi++) {
      var pr = pots[pi - 2]; if (!pr || !pr.modifiers) continue;
      for (var pm = 0; pm < pr.modifiers.length; pm++) {
        var md = pr.modifiers[pm]; var v = Number(md.value) || 0;
        if (md.attributeType === 'ATK') potAtk += v;
        else if (md.attributeType === 'MAX_HP') potHp += v;
        else if (md.attributeType === 'DEF') potDef += v;
      }
    }
    var ownAtk = 0, ownHp = 0, ownDef = 0;
    if (own.phase >= 2) {
      if (own.level >= 60) { ownAtk = 0.10; ownHp = 0.10; ownDef = 0.10; }
      else { ownAtk = 0.10; ownHp = 0.05; ownDef = 0.05; } // 本模型精二 Lv1–59 档：攻+10%、防血+5%
    } else if (own.phase >= 1) {
      ownAtk = 0.05; ownDef = 0.05;
    }
    var mi = Math.max(1, moduleIdx || 1);
    var mod = null, modStage = null, modName = '', modTrait = '';
    var mods = op.modules || [];
    var modStats = {};
    if (mods.length) {
      mod = mods[Math.min(mi - 1, mods.length - 1)];
      var stages = mod.stages || [];
      if (stages.length && st.moduleLevel > 0) {
        var si = Math.min(Math.max(0, (st.moduleLevel || 1) - 1), stages.length - 1);
        modStage = stages[si] || null;
        if (modStage) {
          modStats = modStage.stats || {};
          modName = mod.name || '';
          modTrait = (modStage.traits && modStage.traits[0] && modStage.traits[0].description) || '';
        }
      }
    }
    return {
      hp: Math.round((st.hp + potHp + (modStats.max_hp || 0)) * (1 + ownHp) * 10) / 10,
      atk: Math.round((st.atk + potAtk + (modStats.atk || 0)) * (1 + ownAtk) * 10) / 10,
      def: Math.round((st.def + potDef + (modStats.def || 0)) * (1 + ownDef) * 10) / 10,
      block: st.block + (modStats.block_cnt || 0),
      res: st.res + (modStats.magic_resistance || 0),
      rangeId: st.rangeId,
      phase: st.phase, level: st.level, moduleLevel: st.moduleLevel, skillLevel: st.skillLevel,
      trait: st.trait,
      talentHp: st.talentHp || 0,
      potential: maxPot, potAtk: potAtk, potHp: potHp, potDef: potDef,
      moduleIndex: mi, moduleName: modName, moduleTrait: modTrait,
    };
  }

  function cellAt(map, r, c) {
    if (!map || r < 0 || r >= map.rows.length || c < 0 || c >= map.cols) return null;
    return map.rows[r][c];
  }

  function isGround(code) { return !!GROUND_CODES[code]; }
  function isHigh(code) { return !!HIGH_CODES[code]; }
  function hasBond(op, bond) { return !!(op && op.bonds && op.bonds.indexOf(bond) >= 0); }
  function isAegirOp(op) { return hasBond(op, '阿戈尔'); }
  function isHarmonyOp(op) { return hasBond(op, '调和'); }
  // 阿戈尔与【调和】干员都可发起吞噬（调和「享受已激活核心盟约效果」，含吞噬）
  function isDevourOp(op) { return isAegirOp(op) || isHarmonyOp(op); }
  // 调和干员 Pith（盟约·辅助干员）特质：攻击力和生命上限 +20%/+40%
  function pithMul(op, elite) { return (op && op.id === 'char_616_pithst') ? (elite ? 1.4 : 1.2) : 1; }

  function simulate(cfg) {
    cfg = cfg || {};
    var map = null;
    for (var mi = 0; mi < DATA.maps.length; mi++) if (DATA.maps[mi].id === cfg.mapId) { map = DATA.maps[mi]; break; }
    if (!map) map = DATA.maps[DATA.maps.length - 1];
    var layersInput = Math.max(0, Math.floor(cfg.layers || 0));
    var own = cfg.own || { phase: 0, level: 0 };
    var applyTalents = !!cfg.applyTalents;
    // 策略：gladiia = 歌蕾蒂娅「猎人战法」；pith = Pith「优等生」；other = 其他（无策略）
    var strategy = cfg.strategy;
    if (!strategy) strategy = (cfg.strategyOn === false ? 'other' : 'gladiia');
    if (strategy !== 'gladiia' && strategy !== 'pith') strategy = 'other';
    var strategyName = strategy === 'gladiia' ? '猎人战法（歌蕾蒂娅）' : (strategy === 'pith' ? '优等生（Pith）' : '其他（无策略）');
    var mojiaLayers = true; // 魔王叠层固定计入（开关已移除）

    var logs = [], warnings = [];
    var units = [];
    var field = {}; // "r,c" -> unit

    function log(text, kind) { logs.push({ kind: kind || 'info', text: text }); }

    // ---- 1. 放置与合法性
    (cfg.units || []).forEach(function (u, idx) {
      var op = getOp(u.name);
      if (!op) { warnings.push('未知干员: ' + u.name); return; }
      var code = cellAt(map, u.r, u.c);
      if (!code) { warnings.push(u.name + ' 位置 (' + u.r + ',' + u.c + ') 超出棋盘，已忽略'); return; }
      if (!isGround(code) && !isHigh(code)) { warnings.push(u.name + ' 放在了不可部署格 (' + (u.r + 1) + ',' + (u.c + 1) + ')，已忽略'); return; }
      var isRanged = canHigh(op);
      if (isHigh(code) && !isRanged) { warnings.push(u.name + ' 是近战干员，不能部署在高台 (' + (u.r + 1) + ',' + (u.c + 1) + ')，已忽略'); return; }
      if (field[u.r + ',' + u.c]) { warnings.push('格子 (' + (u.r + 1) + ',' + (u.c + 1) + ') 重复放置，已忽略 ' + u.name); return; }
      var panel = panelOf(op, !!u.elite, u.own || own, u.potential, u.module);
      var unit = {
        id: 'u' + idx, name: u.name, op: op, elite: !!u.elite,
        r: u.r, c: u.c, facing: u.facing || 'R',
        panel: panel,
        extraHpPct: Number(u.extraHpPct) || 0,
        extraAtkPct: Number(u.extraAtkPct) || 0,
        extraDefPct: Number(u.extraDefPct) || 0,
        hpMax: 0, hp: 0, atk: 0, block: 0,
        dead: false, deathOrder: 0,
        marksFrom: [], bittenBy: [],
        substituteUsed: false, moduleReviveUsed: false,
        revived: false, replacedBy: null, replacedElite: null,
        pithMul: pithMul(op, !!u.elite),
        alive: true,
      };
      units.push(unit);
      field[u.r + ',' + u.c] = unit;
    });

    // ---- 2. 部署顺序：列优先（同一列从上到下），再从左到右
    var deployOrder = units.slice().sort(function (a, b) { return a.c - b.c || a.r - b.r; });
    log('部署顺序（列优先）：' + deployOrder.map(function (u) { return u.name + '(' + (u.r + 1) + ',' + (u.c + 1) + ')'; }).join(' → '));

    // ---- 2.5 提前计算盟约激活（<3 名不同阿戈尔且无调和时，不触发吞噬/生命加成/加层）
    var _earlyNames = {}, _earlyHarmony = false;
    units.forEach(function (u) { if (isAegirOp(u.op)) _earlyNames[u.name] = 1; if (isHarmonyOp(u.op)) _earlyHarmony = true; });
    var activationEarly = Object.keys(_earlyNames).length + (_earlyHarmony ? 1 : 0);
    var bondOn = activationEarly >= 3;
    if (!bondOn) log('  当前在场不同阿戈尔 ' + Object.keys(_earlyNames).length + ' 名（调和 ' + (_earlyHarmony ? '+1' : '0') + '）：阿戈尔盟约未激活，本回合不触发吞噬、不加生命、不加层', 'warn');

    // ---- 3. 开局层数累计（休整期：魔王；部署类特质：幽灵鲨/斯卡蒂/浊心斯卡蒂）
    var L = layersInput;
    if (bondOn) {
    log('休整期层数 L=' + layersInput + '，策略：' + strategyName + '，开始结算层数：');
    {
      deployOrder.forEach(function (u) {
        if (u.name !== '魔王') return;
        var mAdd = u.elite ? 20 : 10;
        L += mAdd;
        log('  魔王（' + (u.elite ? '精锐' : '普通') + '）休整期结束：使已激活的核心盟约层数 +' + mAdd + ' → L=' + L, 'layer');
      });
    }
    deployOrder.forEach(function (u) {
      if (u.name === '幽灵鲨') {
        var add = u.elite ? 2 : 1; // 一回合内至多 1/2，每名幽灵鲨各自独立，同名可叠加
        L += add;
        log('  ' + u.name + ' 部署：阿戈尔层数 +' + add + ' → L=' + L, 'layer');
      } else if (u.name === '斯卡蒂') {
        var sAdd = u.elite ? 8 : 4; // 本模型每个实例开局加4/8层；累计上限与周期仍需核对。
        L += sAdd;
        log('  ' + u.name + ' 部署：阿戈尔层数 +' + sAdd + ' → L=' + L, 'layer');
      }
      // 浊心斯卡蒂：攻击范围内每有一名我方干员部署
      deployOrder.forEach(function (sk) {
        if (sk.name !== '浊心斯卡蒂' || sk === u) return;
        if (deployOrder.indexOf(sk) > deployOrder.indexOf(u)) return; // 只对其部署之后部署的单位生效
        var inRange = rangeCells(sk.panel.rangeId, sk.facing, sk.r, sk.c).some(function (p) { return p[0] === u.r && p[1] === u.c; });
        if (inRange) {
          var rStep = sk.elite ? 4 : 2, rCap = sk.elite ? 40 : 20;
          var rUsed = sk._redUsed || 0;
          var rAdd = Math.min(rStep, rCap - rUsed);
          if (rAdd > 0) { sk._redUsed = rUsed + rAdd; L += rAdd; log('  ' + u.name + ' 部署在浊心斯卡蒂(' + (sk.r + 1) + ',' + (sk.c + 1) + ') 攻击范围内：阿戈尔层数 +' + rAdd + '（累计 ' + sk._redUsed + '/' + rCap + '）→ L=' + L, 'layer'); }
        }
      });
    });

        }

    // ---- 4. 生命上限（阿戈尔盟约：+(35+层数)%；调和干员同样享受；Pith 单位攻击/生命×1.2/1.4）
    var layerPct = bondOn ? (DATA.meta.layerHpBase + L) / 100 : 0;
    units.forEach(function (u) {
      var talentHp = applyTalents ? (u.panel.talentHp || 0) : 0;
      var talentFlat = 0;
      if (talentHp > 1) { talentFlat = talentHp; talentHp = 0; }
      u.hpMax = Math.round(u.panel.hp * (1 + layerPct + talentHp + u.extraHpPct / 100) * u.pithMul + talentFlat);
      u.hp = u.hpMax;
      u.atk = u.panel.atk * u.pithMul * (1 + u.extraAtkPct / 100);
      u.block = u.panel.block;
    });
    log('阿戈尔生命加成参数（仅激活时生效）：+' + (DATA.meta.layerHpBase + L) + '%（基础35% + 层数' + L + '）');

    // ---- 5. 标记（吞噬链）
    var marks = [];
    var markSet = {};
    function hasMark(src, tgt) { return markSet[src.id + '>' + tgt.id] === true; }

    deployOrder.forEach(function (src) {
      if (!bondOn) return;
      if (!isDevourOp(src.op)) return; // 阿戈尔与调和干员都可发起吞噬
      var visited = {}; visited[src.id] = true;
      var cur = src;
      while (true) {
        var d = DIRS[cur.facing] || DIRS.R;
        var tr = cur.r + d[0], tc = cur.c + d[1];
        var tgt = field[tr + ',' + tc];
        if (!tgt) break;
        if (visited[tgt.id]) break;
        if (hasMark(tgt, src)) break; // 被吃者不能反吃捕食者
        visited[tgt.id] = true;
        markSet[src.id + '>' + tgt.id] = true;
        marks.push({ src: src, tgt: tgt, done: false, cancelled: false });
        src.marksFrom.push(tgt.name);
        tgt.bittenBy.push(src.name);
        // 只有连锁到阿戈尔干员时，才继续沿该阿戈尔的方向递归
        if (tgt.op && isDevourOp(tgt.op)) cur = tgt; else break;
      }
    });

    // ---- 6. 继承：基础攻击力 + 阻挡数（每标记一次）
    units.forEach(function (u) {
      var atk = 0, blk = 0;
      marks.forEach(function (m) { if (m.src === u) { atk += m.tgt.panel.atk; blk += m.tgt.panel.block; } });
      u.inheritAtk = atk; u.inheritBlock = blk;
      u.atk += atk; u.block += blk;
    });
    log('吞噬标记共 ' + marks.length + ' 条（未取消的标记按顺序直接扣除 5000 生命；伤害类型仍待实测）');

    // ---- 7. 伤害结算
    var deathOrder = 0;
    var deaths = [];
    function tryDeath(u, cause) {
      // 归溟幽灵鲨（傀儡师·职业特性）：受致命伤时不撤退，切换成傀儡/替身形态（阻挡0）；
      // 仅形态交换、不判定阵亡，因此不占「前3名倒地的阿戈尔」名额，也不会被整备区替换。
      if (u.name === '归溟幽灵鲨' && !u.substituteUsed) {
        u.substituteUsed = true;
        u.subForm = true;
        u.hp = u.hpMax;
        u.block = 0;
        log('  ' + u.name + ' 受到致命伤 → 切换为傀儡形态（替身阻挡 0；仅形态交换，不判定阵亡、不占前3名额；本模型在此次开局结算中取消针对傀儡的后续标记）', 'warn');
        return false;
      }
      // 斯卡蒂：精锐模组特性「被击倒时不撤退且回复所有生命，但生命上限-40%」
      if (u.name === '斯卡蒂' && u.elite && !u.moduleReviveUsed && /剑袋/.test(u.panel.moduleName || '')) {
        u.moduleReviveUsed = true;
        u.hpMax = Math.round(u.hpMax * 0.6);
        u.hp = u.hpMax;
        log('  ' + u.name + ' 受到致命伤 → 模组特性复起一次（实验性假设：生命上限-40%）', 'warn');
        return false;
      }
      u.dead = true; u.alive = false;
      u.deathOrder = ++deathOrder;
      delete field[u.r + ',' + u.c];
      deaths.push({ order: u.deathOrder, unit: u, name: u.name, r: u.r, c: u.c });
      log('  ☠ ' + u.name + '（' + (u.r + 1) + ',' + (u.c + 1) + '）被吞噬击倒，倒地顺序 #' + u.deathOrder, 'death');
      return true;
    }

    marks.forEach(function (m) {
      if (m.done) return;
      m.done = true;
      if (m.tgt.dead) {
        m.cancelled = true;
        log('  标记 ' + m.src.name + '→' + m.tgt.name + ' 取消（目标已倒地）', 'cancelled');
        return;
      }
      // 归溟幽灵鲨切换傀儡时有替身无敌帧：傀儡形态视为不可被吞噬，后续标记全部无效
      if (m.tgt.subForm) {
        m.cancelled = true;
        log('  标记 ' + m.src.name + '→' + m.tgt.name + ' 取消（傀儡形态·无敌帧，无法被吞噬）', 'cancelled');
        return;
      }
      m.tgt.hp -= 5000;
      m.lethal = m.tgt.hp <= 0;
      if (m.lethal) {
        log('  ' + m.src.name + '→' + m.tgt.name + '：5000 流失（致命，剩余 ' + Math.round(m.tgt.hp) + '）', 'dmg');
        tryDeath(m.tgt, '吞噬');
      } else {
        log('  ' + m.src.name + '→' + m.tgt.name + '：5000 流失（剩余 HP ' + Math.round(m.tgt.hp) + '/' + m.tgt.hpMax + '）', 'dmg');
      }
    });

    // ---- 8. 六阿戈尔高档：前3名阿戈尔首次被击倒 → 复活 / 召唤替换
    var distinct = {};
    var harmonyOnField = false;
    units.forEach(function (u) {
      if (isAegirOp(u.op)) distinct[u.name] = 1;
      if (isHarmonyOp(u.op)) harmonyOnField = true;
    });
    var distinctAegir = Object.keys(distinct).length;
    var harmonyBonus = harmonyOnField ? 1 : 0; // 调和：核心盟约激活人数 +1（只 +1 次）
    var activation = distinctAegir + harmonyBonus;
    var highTier = activation >= 6;
    var bench = (cfg.bench || []).slice(); // 从左到右
    var benchUsed = {};
    log('在场不同阿戈尔干员 ' + distinctAegir + ' 名' + (harmonyBonus ? ' + 调和 1 名（激活人数 +1 → ' + activation + '）' : '') + ' → ' + (highTier ? '已触发 <在场6名不同阿戈尔> 高档效果' : '未触发高档效果（需6名不同，调和可+1）'), 'bond');

    if (highTier) {
      // 只有阿戈尔干员的倒地会占用「前3名」名额（调和干员不占）
      var aegirDeaths = deaths.filter(function (d) { return isAegirOp(d.unit.op); });
      aegirDeaths.slice(0, 3).forEach(function (d) {
        var u = d.unit;
        if (strategy === 'gladiia') {
          var code = cellAt(map, u.r, u.c);
          var needRanged = isHigh(code);
          var pickIdx = -1;
          for (var i = bench.length - 1; i >= 0; i--) {
            if (benchUsed[i]) continue;
            var b = bench[i]; var bop = getOp(b.name);
            if (!bop) continue;
            if (!isAegirOp(bop)) continue; // 猎人战法只召唤阿戈尔
            if (!canHigh(bop) && needRanged) continue;
            pickIdx = i; break;
          }
          if (pickIdx >= 0) {
            var b = bench[pickIdx], bop = getOp(b.name);
            benchUsed[pickIdx] = true;
            var bp = panelOf(bop, !!b.elite, (b.own || own), b.potential, b.module);
            var nu = {
              id: 'r' + u.id, name: b.name, op: bop, elite: !!b.elite, r: u.r, c: u.c, facing: u.facing,
              panel: bp, extraHpPct: 0, extraAtkPct: 0, extraDefPct: 0,
              hpMax: Math.round(bp.hp * (1 + layerPct)), hp: Math.round(bp.hp * (1 + layerPct)),
              atk: bp.atk, block: bp.block, dead: false, deathOrder: 0,
              marksFrom: [], bittenBy: [], revived: true, summoned: true, replacedName: u.name,
            };
            u.replacedBy = b.name;
            field[u.r + ',' + u.c] = nu;
            logs.push({ kind: 'replace', text: '  ↳ 歌蕾蒂娅策略：' + u.name + ' 倒地格（' + (u.r + 1) + ',' + (u.c + 1) + '，' + (needRanged ? '高台' : '地面') + '）从整备区最右侧可部署者召唤 → ' + b.name + (b.elite ? '(精锐)' : '') });
            d.action = 'replace'; d.benchName = b.name;
          } else {
            logs.push({ kind: 'replace', text: '  ↳ 歌蕾蒂娅策略：' + u.name + ' 倒地格（' + (u.r + 1) + ',' + (u.c + 1) + '，' + (needRanged ? '高台' : '地面') + '）无可部署阿戈尔，位置留空' });
            d.action = 'none';
          }
        } else {
          // Pith / 其他策略：只保留「前3名倒地原地复活」，没有从整备区替换部署
          u.dead = false; u.alive = true; u.hp = u.hpMax; u.block = u.panel.block;
          u.atk = u.panel.atk * u.pithMul * (1 + u.extraAtkPct / 100); u.inheritAtk = 0; u.inheritBlock = 0;
          u.revived = true;
          field[u.r + ',' + u.c] = u;
          log('  ↳ 六阿戈尔复活：' + u.name + ' 原地满血复活（当前策略：' + strategyName + '，无替换）', 'revive');
          d.action = 'revive';
        }
      });
    }

    // ---- 8.5 吞噬带来的层数（本回合生命上限在吞噬前已结算，这里仅统计，供下一回合参考）
    var eatenOnce = {}, devourLayers = 0;
    marks.forEach(function (m) {
      if (eatenOnce[m.tgt.id]) return;
      eatenOnce[m.tgt.id] = 1;
      devourLayers += (m.tgt.op && m.tgt.op.rank) || 1;
    });
    if (marks.length) log('吞噬叠层：按全部标记的唯一目标等阶合计参考 +' + devourLayers + ' 层（含取消标记，不回算本次生命；实际叠层时点待核对）', 'layer');

    // ---- 9. 输出
    var fieldList = [];
    Object.keys(field).forEach(function (k) {
      var u = field[k]; if (!u || u.dead) return;
      fieldList.push({ name: u.name, elite: u.elite, r: u.r, c: u.c, facing: u.facing, hp: Math.round(u.hp), hpMax: u.hpMax, atk: Math.round(u.atk), block: u.block, from: u.summoned ? u.replacedName : null, revived: !!u.revived, subForm: !!u.subForm });
    });
    fieldList.sort(function (a, b) { return a.r - b.r || a.c - b.c; });

    var outUnits = units.map(function (u) {
      return {
        name: u.name, elite: u.elite, r: u.r, c: u.c, facing: u.facing,
        baseHp: Math.round(u.panel.hp * u.pithMul * 10) / 10, baseAtk: Math.round(u.panel.atk * u.pithMul * 10) / 10, baseDef: u.panel.def, baseBlock: u.panel.block,
        hpMax: u.hpMax, hpLeft: Math.max(0, Math.round(u.hp)), atk: Math.round(u.atk), block: u.block,
        inheritAtk: u.inheritAtk || 0, inherited: (u.inheritAtk || 0) > 0,
        eaten: u.marksFrom.slice(), bittenBy: u.bittenBy.slice(),
        dead: u.dead, deathOrder: u.deathOrder,
        revived: !!u.revived, replacedBy: u.replacedBy, substituteUsed: !!u.substituteUsed, moduleReviveUsed: !!u.moduleReviveUsed, subForm: !!u.subForm,
      };
    });

    var warnings2 = warnings.slice();
    if (distinctAegir < 3) warnings2.push('不同阿戈尔少于3名；须连同调和加成合计达到3才激活，请以界面盟约状态为准');
    else if (!highTier) warnings2.push('在场=' + distinctAegir + '名不同阿戈尔' + (harmonyBonus ? '（+调和1）' : '') + '，未达6名高档：前3次倒地不会复活/召唤');
    if (harmonyOnField) warnings2.push('调和：场上存在【调和】干员，核心盟约激活人数+1（只计1次）；调和干员享受阿戈尔生命加成，并可发起/参与吞噬，但不占复活名额');
    if (strategy === 'other') warnings2.push('策略「其他」：6名高档时没有歌蕾蒂娅的整备区替换，只有前3名阿戈尔倒地的原地复活');
    if (strategy === 'pith') warnings2.push('Pith「优等生」：不提供猎人战法替换，6名高档时前3名阿戈尔倒地原地复活；调和干员按 +20%/+40% 攻击与生命上限计入面板');
    if (!applyTalents) warnings2.push('本工具未自动计算原天赋与技能；仅实现部分特质、职业/模组机制，不代表这些效果在游戏中不生效');
    warnings2.push('模型假设：有效吞噬标记直接扣除5000生命，未计算防御、护盾和减伤；与游戏实战是否一致仍待核对');

    return {
      ok: true,
      map: { id: map.id, label: map.label, name: map.name },
      layersInput: layersInput, layersAfter: L, layerPct: DATA.meta.layerHpBase + L,
      layersFromDevour: devourLayers,
      strategy: strategy, strategyName: strategyName, mojiaLayers: mojiaLayers,
      harmony: harmonyOnField, harmonyBonus: harmonyBonus, activation: activation,
      deployOrder: deployOrder.map(function (u) { return { name: u.name, r: u.r, c: u.c, facing: u.facing }; }),
      units: outUnits,
      marks: marks.map(function (m) { return { src: m.src.name, tgt: m.tgt.name, lethal: !!m.lethal, cancelled: !!m.cancelled }; }),
      deaths: deaths.map(function (d) { return { order: d.order, name: d.name, r: d.r, c: d.c, action: d.action || 'none', benchName: d.benchName || null }; }),
      field: fieldList,
      distinctAegir: distinctAegir, highTier: highTier, strategyOn: strategy === 'gladiia',
      logs: logs, warnings: warnings2,
    };
  }

  var api = {
    version: DATA.meta.version,
    meta: DATA.meta,
    operators: DATA.operators,
    maps: DATA.maps,
    rangeCells: rangeCells,
    panelOf: panelOf,
    simulate: simulate,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { AegirEngine: api, AEGIR_STATIC: DATA };
  else global.AegirEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
