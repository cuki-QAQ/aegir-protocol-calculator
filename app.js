/* 阿戈尔 · 开局吞噬计算器 v13（公开测试；2026-11-17 文案整理）
 * 依赖：data.js（window.AEGIR_STATIC）、engine.js（window.AegirEngine）
 */
(function () {
  'use strict';

  var DATA = window.AEGIR_STATIC;
  var ENGINE = window.AegirEngine;
  var BENCH_N = 6;
  var LIMIT = DATA.meta.deployLimit || 8;
  var STORE = 'aegirCalc.v3';

  var AVATAR = {
    '幽灵鲨': 'avatars/gs.png',
    '安哲拉': 'avatars/azl.png',
    '深巡': 'avatars/sx.png',
    '斯卡蒂': 'avatars/skd.png',
    '归溟幽灵鲨': 'avatars/gmgs.png',
    '水月': 'avatars/sy.png',
    '歌蕾蒂娅': 'avatars/gld.png',
    '乌尔比安': 'avatars/web.png',
    '浊心斯卡蒂': 'avatars/hdt.png',
    '克莱门莎': 'avatars/klm.png',
    '魔王': 'avatars/mw.png',
    '盟约·辅助干员': 'avatars/pith.png'
  };
  var SHORT = {
    '幽灵鲨': '鲨鲨', '安哲拉': '海猫', '深巡': '深巡', '斯卡蒂': '蓝蒂',
    '归溟幽灵鲨': '归鲨', '水月': '水月', '歌蕾蒂娅': '歌蒂', '乌尔比安': '饼干',
    '浊心斯卡蒂': '红蒂', '克莱门莎': '克莱', '魔王': '魔王', '盟约·辅助干员': 'Pith'
  };
  var RANK_GLYPH = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ', 'Ⅴ', 'Ⅵ'];
  var THEME = {
    '01': 'desert', '02': 'hall', '03': 'desert', '04': 'desert', '05': 'metal',
    '06': 'swamp', '09': 'snow', '10': 'metal', '11': 'snow', '12': 'metal', 'wb': 'white'
  };
  var OWN = {
    none: { phase: 0, level: 0 },
    p1: { phase: 1, level: 1 },
    p2: { phase: 2, level: 1 },
    p2max: { phase: 2, level: 60 }
  };
  var DIRS = { R: [0, 1], D: [1, 0], L: [0, -1], U: [-1, 0] };
  var DIRNAME = { R: '朝右', D: '朝下', L: '朝左', U: '朝上' };
  var DIRARROW = { R: '→', D: '↓', L: '←', U: '↑' };

  var state = {
    mapId: 'wb',
    layers: 0,
    ownKey: 'p2max',
    strategy: 'gladiia',
    mojiaLayers: true,
    eliteMode: 'normal',
    units: [],          // {uid,name,elite,r,c,facing,extraHpPct,extraDefPct,extraAtkPct,benchSlot}
    bench: new Array(BENCH_N).fill(null), // null | {name,elite}
    nextUid: 1,
    tab: 'report',
    result: null,
    dirty: false,
    pending: null,      // {name,elite,r,c,fromBench}
    aim: { dir: null },
    rotate: null,       // {uid, oldFacing}
    selectedUid: null,
    selectedBench: null,
    drag: null,
    hand: null
  };

  /* ---------------- 基础工具 ---------------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { var v = Math.round(Number(n) || 0); return String(v); }
  function opByName(name) { for (var i = 0; i < DATA.operators.length; i++) if (DATA.operators[i].name === name) return DATA.operators[i]; return null; }
  function curMap() { for (var i = 0; i < DATA.maps.length; i++) if (DATA.maps[i].id === state.mapId) return DATA.maps[i]; return DATA.maps[DATA.maps.length - 1]; }
  function codeAt(r, c) { var m = curMap(); if (r < 0 || r >= m.rows.length || c < 0 || c >= m.cols) return null; return m.rows[r][c]; }
  function isGroundCode(ch) { return 'GFIMDP'.indexOf(ch) >= 0; }
  function isHighCode(ch) { return ch === 'H'; }
  function isNoneCode(ch) { return ch === '.'; }
  function canHighOp(op) { return !!op && (op.position === 'RANGED' || op.name === '歌蕾蒂娅'); }
  function harmonyOp(op) { return !!op && op.bonds && op.bonds.indexOf('调和') >= 0; }
  function aegirOp(op) { return !!op && op.bonds && op.bonds.indexOf('阿戈尔') >= 0; }
  function canPlaceOp(op, code) {
    if (!code) return { ok: false, msg: '超出棋盘' };
    if (isGroundCode(code)) return { ok: true };
    if (isHighCode(code)) return canHighOp(op) ? { ok: true } : { ok: false, msg: '这里是高台，只有远程干员（及歌蕾蒂娅）能部署' };
    if (isNoneCode(code)) return { ok: false, msg: '该格不可部署' };
    if (code === ',') return { ok: false, msg: '这里是装饰地面，无法部署' };
    if (code === 'E') return { ok: false, msg: '这是蓝门，无法部署' };
    if (code === 'S') return { ok: false, msg: '这是红门，无法部署' };
    return { ok: false, msg: '这里无法部署' };
  }
  function unitAt(r, c) {
    for (var i = 0; i < state.units.length; i++) if (state.units[i].r === r && state.units[i].c === c) return state.units[i];
    return null;
  }
  function unitByUid(uid) {
    for (var i = 0; i < state.units.length; i++) if (state.units[i].uid === uid) return state.units[i];
    return null;
  }
  function benchDeployed(i) {
    for (var k = 0; k < state.units.length; k++) if (state.units[k].benchSlot === i) return state.units[k];
    return null;
  }
  function toast(msg, kind) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.hidden = true; }, 2400);
  }
  function markStale() {
    state.dirty = true;
    var b = $('runBtn'); if (b) b.classList.add('stale');
  }
  function cleanStale() {
    state.dirty = false;
    var b = $('runBtn'); if (b) b.classList.remove('stale');
  }
  function bannerOf() { return 'maps/m' + (curMap().id === 'wb' ? '01' : curMap().id) + '.png'; }

  /* ---------------- 存档 ---------------- */
  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        mapId: state.mapId, layers: state.layers, ownKey: state.ownKey,
        strategy: state.strategy, eliteMode: state.eliteMode,
        units: state.units, bench: state.bench, nextUid: state.nextUid
      }));
    } catch (e) { /* ignore */ }
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORE);
      if (!raw) return false;
      var s = JSON.parse(raw);
      if (!s || !Array.isArray(s.units)) return false;
      state.mapId = s.mapId || 'wb';
      var m = curMap();
      if (!m) { state.mapId = 'wb'; m = curMap(); }
      state.layers = Math.max(0, Number(s.layers) || 0);
      state.ownKey = OWN[s.ownKey] ? s.ownKey : 'p2max';
      state.strategy = (s.strategy === 'pith' || s.strategy === 'other') ? s.strategy : 'gladiia';
      state.mojiaLayers = true;
      state.eliteMode = s.eliteMode === 'elite' ? 'elite' : 'normal';
      state.units = (s.units || []).filter(function (u) {
        return u && opByName(u.name) && codeAt(u.r, u.c) && canPlaceOp(opByName(u.name), codeAt(u.r, u.c)).ok;
      }).filter(function (u, i, arr) {
        return !arr.some(function (o, j) { return j < i && o.r === u.r && o.c === u.c; });
      }).map(function (u) {
        return { uid: u.uid || state.nextUid++, name: u.name, elite: !!u.elite, r: u.r, c: u.c, facing: DIRS[u.facing] ? u.facing : 'R', extraHpPct: Number(u.extraHpPct) || 0, extraDefPct: Number(u.extraDefPct) || 0, extraAtkPct: Number(u.extraAtkPct) || 0, benchSlot: (typeof u.benchSlot === 'number' ? u.benchSlot : null) };
      });
      state.bench = new Array(BENCH_N).fill(null);
      (s.bench || []).forEach(function (b, i) { if (i < BENCH_N && b && opByName(b.name)) state.bench[i] = { name: b.name, elite: !!b.elite }; });
      state.nextUid = Math.max(state.nextUid, Number(s.nextUid) || 1, state.units.length + 1);
      return true;
    } catch (e) { return false; }
  }

  /* ---------------- 模态框 ---------------- */
  var modalCloser = null;
  function openModal(html, cls) {
    $('modalBox').className = 'modal ' + (cls || '');
    $('modalBox').innerHTML = html;
    $('modalRoot').hidden = false;
    var mask = $('modalMask');
    mask.onclick = closeModal;
    var cb = $('modalBox').querySelector('[data-close]');
    if (cb) cb.onclick = closeModal;
    modalCloser = closeModal;
  }
  function closeModal() {
    $('modalRoot').hidden = true;
    $('modalBox').innerHTML = '';
    modalCloser = null;
  }
  function isModalOpen() { return !$('modalRoot').hidden; }

  function openOperatorModal(name) {
    var op = opByName(name); if (!op) return;
    var harmony = harmonyOp(op);
    var stIdx = 0;
    function body(idx) {
      var st = op.states[idx];
      var tags = [
        '<span class="tag">' + RANK_GLYPH[op.rank - 1] + ' 阶</span>',
        '<span class="tag">' + (op.position === 'RANGED' ? '远程 · 地面/高台' : (canHighOp(op) ? '近战 · 地面/高台' : '近战 · 地面')) + '</span>',
        '<span class="tag">' + esc(op.profession) + (op.subclass ? ' / ' + esc(op.subclass) : '') + '</span>'
      ];
      (op.bonds || []).forEach(function (b) {
        tags.push('<span class="tag' + (b === '调和' ? ' harm' : '') + '">' + esc(b) + '</span>');
      });
      var extra = st.extraStats || {};
      var stTxt = (idx === 0 ? '普通' : '精锐') + '：' + (st.phase === 1 ? '精一 Lv' : '精二 Lv') + st.level + (st.moduleLevel ? ' · 模组 ' + st.moduleLevel + ' 级' : ' · 无模组');
      var trait = (st.trait && st.trait.desc) || '（该状态无特质说明）';
      var html = '' +
        '<div class="opHead">' +
          '<img src="' + AVATAR[name] + '" alt="">' +
          '<div><h3>' + esc(name) + (harmony ? ' <small style="font-size:12px;color:#6a52a0">调和</small>' : '') + '</h3>' +
          '<div class="tags">' + tags.join('') + '</div></div>' +
        '</div>' +
        '<div class="stateTabs"><button data-st="0" class="' + (idx === 0 ? 'on' : '') + '">普通</button><button data-st="1" class="' + (idx === 1 ? 'on' : '') + '">精锐</button></div>' +
        '<div class="statGrid">' +
          '<div class="statCell"><span>生命上限</span><b>' + (Math.round(st.hp * 10) / 10) + '</b></div>' +
          '<div class="statCell"><span>攻击力</span><b>' + (Math.round(st.atk * 10) / 10) + '</b></div>' +
          '<div class="statCell"><span>防御力</span><b>' + (Math.round(st.def * 10) / 10) + '</b></div>' +
          '<div class="statCell"><span>阻挡数</span><b>' + st.block + '</b></div>' +
          '<div class="statCell"><span>法抗</span><b>' + (st.res || 0) + '</b></div>' +
          '<div class="statCell"><span>部署费用</span><b>' + st.cost + '</b></div>' +
        '</div>' +
        '<div class="traitBox"><h4>' + stTxt + ' · 特质资料（不代表全部实现）</h4>' + esc(trait) + '</div>' +
        (extra.max_hp || extra.atk || extra.def || extra.block_cnt ?
          '<div class="traitBox"><h4>快照记录的模组加成（非当前选择）</h4>生命 +' + (extra.max_hp || 0) + ' · 攻击 +' + (extra.atk || 0) + ' · 防御 +' + (extra.def || 0) + (extra.block_cnt ? ' · 阻挡 +' + extra.block_cnt : '') + '</div>' : '') +
        (harmony ? '<div class="traitBox"><h4>调和：本工具的处理</h4>魔王或盟约·辅助干员在场时，阿戈尔激活人数合计 +1，多名调和不重复增加；调和可参与吞噬，不占前 3 名阿戈尔倒地名额。具体生效与时序仍需实战确认。</div>' : '') +
        (aegirOp(op) ? '<div class="traitBox"><h4>阿戈尔：本工具的处理</h4>激活人数达到 3 后，按列优先生成吞噬链，继承目标基准攻击与阻挡；有效标记直接扣除 5000 生命。达到 6 人档后，前 3 名阿戈尔倒地按策略复活或召唤替补。吞噬标记叠层仅作参考，不回算本次生命。</div>' : '') +
        '<p class="hlRowNote">此处展示数据快照中的基准面板，不是所选实例的最终面板。持有练度、潜能和模组请在棋盘或整备区的「装备」中设置；这里只展示资料，不模拟全部特质效果。</p>' +
        '<div style="display:flex;justify-content:flex-end;margin-top:14px"><button data-close="1">关闭</button></div>';
      return html;
    }
    function show(idx) {
      openModal(body(idx), 'modalMid opModal');
      bindClose();
      $('modalBox').querySelectorAll('.stateTabs button').forEach(function (b) {
        b.onclick = function (e) { e.preventDefault(); show(Number(b.dataset.st)); };
      });
    }
    show(stIdx);
    function bindClose() {
      var cb = $('modalBox').querySelector('[data-close]');
      if (cb) cb.onclick = closeModal;
    }
  }

  function openMapPreview(id) {
    var m = null;
    for (var i = 0; i < DATA.maps.length; i++) if (DATA.maps[i].id === id) m = DATA.maps[i];
    if (!m) return;
    if (m.id === 'wb') {
      openModal('<div class="modalHead"><h3>白盒 · 全地面</h3><button class="closeBtn" data-close="1">✕</button></div>' +
        '<p class="mapCap">白盒为 4 行 × 9 列的全地面测试棋盘，不对应游戏实战地图，用于自由试验摆位。</p>', 'modalMid');
      return;
    }
    openModal('<div class="modalHead"><h3>' + esc(m.label) + ' · ' + esc(m.devices || m.name) + '</h3><button class="closeBtn" data-close="1">✕</button></div>' +
      '<img class="mapShot" src="maps/m' + m.id + '.png" alt="' + esc(m.name) + '">' +
      '<p class="mapCap">' + esc(m.note || '') + '　（原包收录的地图参考图，来源标注为 PRTS；装置与地形效果未自动计算。点击空白处或 ✕ 关闭）</p>', 'modalWide');
  }

  /* ---------------- 地图下拉 ---------------- */
  var MENU_TAGS = {
    '01': { text: '原包备注：出现难度范围待核对', danger: true },
    '02': '',
    '03': '地块含手动修订，待实测核对',
    '04': '活性源石；地块含手动修订',
    '05': '源石流发生装置',
    '06': '沼泽地板',
    '09': '隐匿地板',
    '11': '地形与装置以实战为准',
    '12': '攻速地板',
    'wb': ''
  };
  function buildMapMenu() {
    var menu = $('mapMenu');
    menu.innerHTML = DATA.maps.map(function (m) {
      var tagDef = Object.prototype.hasOwnProperty.call(MENU_TAGS, m.id) ? MENU_TAGS[m.id] : (m.devices || '');
      var tagText = '', tagCls = 'mi-tag';
      if (tagDef && typeof tagDef === 'object' && tagDef.text) { tagText = tagDef.text; if (tagDef.danger) tagCls += ' danger'; }
      else if (typeof tagDef === 'string') { tagText = tagDef; }
      return '<button type="button" class="mapMenuItem' + (m.id === state.mapId ? ' on' : '') + '" data-id="' + m.id + '">' +
        '<span class="mi-id">' + esc(m.id === 'wb' ? '白盒' : m.label) + '</span>' +
        '<span class="mi-name">' + esc(m.id === 'wb' ? '全地面 · 9×4' : (m.devices ? m.name + ' · ' + m.devices : m.name)) + '</span>' +
        (tagText ? '<span class="' + tagCls + '">' + esc(tagText) + '</span>' : '') + '</button>';
    }).join('');
    menu.querySelectorAll('.mapMenuItem').forEach(function (btn) {
      btn.addEventListener('click', function () {
        selectMap(btn.dataset.id);
        closeMapMenu();
      });
      btn.addEventListener('mouseenter', function () { showHoverPreview(btn); });
      btn.addEventListener('mouseleave', hideHoverPreviewSoon);
      btn.addEventListener('mousemove', function () { showHoverPreview(btn); });
    });
  }
  var hoverTimer = null;
  function showHoverPreview(item) {
    clearTimeout(hoverTimer);
    var id = item.dataset.id;
    var box = $('hoverPreview');
    if (id === 'wb') { box.hidden = true; return; }
    var m = null;
    for (var i = 0; i < DATA.maps.length; i++) if (DATA.maps[i].id === id) m = DATA.maps[i];
    if (!m) return;
    var img = box.querySelector('img');
    img.src = 'maps/m' + id + '.png';
    box.querySelector('.cap').textContent = m.label + ' · ' + (m.devices || m.name) + (m.note ? '　' + m.note : '');
    box.hidden = false;
    var r = item.getBoundingClientRect();
    var top = Math.min(r.top, window.innerHeight - 300);
    var left = r.right + 12;
    if (left + 330 > window.innerWidth) left = r.left - 340;
    box.style.top = Math.max(8, top) + 'px';
    box.style.left = Math.max(8, left) + 'px';
  }
  function hideHoverPreviewSoon() {
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(function () { $('hoverPreview').hidden = true; }, 140);
  }
  function openMapMenu() {
    buildMapMenu();
    $('mapMenu').hidden = false;
    var btn = $('mapBtn');
    btn.classList.add('open');
  }
  function closeMapMenu() {
    $('mapMenu').hidden = true;
    $('hoverPreview').hidden = true;
  }
  function selectMap(id) {
    if (id === state.mapId) return;
    // 切换地图：场上所有内容清除（整备区保留，已上场的放回整备区空位）
    state.units.forEach(function (u) {
      if (typeof u.benchSlot === 'number' && !state.bench[u.benchSlot]) state.bench[u.benchSlot] = { name: u.name, elite: u.elite };
    });
    state.units = [];
    state.pending = null; state.aim = { dir: null }; state.rotate = null;
    state.selectedUid = null;
    state.result = null; cleanStale();
    hideUnitBar(); hideEquip();
    state.mapId = id;
    renderAll(); save();
    toast('已切换地图，场上内容已清除');
  }

  /* ---------------- 工具栏 ---------------- */
  function syncSeg(id, val) {
    var seg = $(id);
    if (!seg) return;
    seg.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.v === val); });
  }
  function bindToolbar() {
    var mapBtn = $('mapBtn');
    mapBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if ($('mapMenu').hidden) openMapMenu(); else closeMapMenu();
    });
    document.addEventListener('click', function (e) {
      if (!$('mapMenu').hidden && !e.target.closest('#mapPicker')) closeMapMenu();
    });

    $('layMinus').addEventListener('click', function () { setLayers(state.layers - 10); });
    $('layPlus').addEventListener('click', function () { setLayers(state.layers + 10); });
    $('layersInput').addEventListener('input', function () {
      var v = Math.max(0, Math.min(999, Math.floor(Number(this.value) || 0)));
      state.layers = v; markStale(); renderHint();
    });
    $('ownSelect').addEventListener('change', function () { state.ownKey = this.value; markStale(); renderHint(); });
    $('strategySeg').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-v]'); if (!b) return;
      state.strategy = b.dataset.v;
      syncSeg('strategySeg', state.strategy);
      buildPalette();
      markStale(); renderHint(); save();
    });
    $('eliteSeg').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-v]'); if (!b) return;
      state.eliteMode = b.dataset.v;
      syncSeg('eliteSeg', state.eliteMode);
    });
    $('runBtn').addEventListener('click', function () {
      if (state.result) { resetToPreBattle(); return; }
      runSimulation();
    });
    $('clearFieldBtn').addEventListener('click', function () {
      if (!state.units.length) { toast('场上没有干员'); return; }
      state.units.forEach(function (u) {
        if (typeof u.benchSlot === 'number' && !state.bench[u.benchSlot]) state.bench[u.benchSlot] = { name: u.name, elite: u.elite };
      });
      state.units = [];
      state.selectedUid = null; state.pending = null; state.aim = { dir: null }; state.rotate = null;
      hideUnitBar(); hideEquip(); markStale(); renderAll(); save();
      toast('已清空场上干员');
    });
    $('clearAllBtn').addEventListener('click', function () {
      state.units = []; state.bench = new Array(BENCH_N).fill(null);
      state.layers = 0; $('layersInput').value = '0';
      state.pending = null; state.aim = { dir: null }; state.rotate = null;
      state.selectedUid = null; state.result = null; cleanStale();
      hideUnitBar(); hideEquip(); renderAll(); save();
      toast('已清空场上、整备区与层数；地图、策略和全局练度保留');
    });
    $('previewBtn').addEventListener('click', function () { openMapPreview(state.mapId); });
    $('tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-tab]'); if (!b) return;
      state.tab = b.dataset.tab;
      syncTabs(); renderResults();
    });
    var own = $('ownSelect'); own.value = state.ownKey;
    syncSeg('strategySeg', state.strategy);
    syncSeg('eliteSeg', state.eliteMode);
  }
  function setLayers(v) {
    state.layers = Math.max(0, Math.min(999, Math.floor(v)));
    $('layersInput').value = String(state.layers);
    markStale(); renderHint();
  }

  /* ---------------- 干员库 ---------------- */
  function paletteList() {
    var list = DATA.operators.filter(function (op) { return aegirOp(op); });
    list.sort(function (a, b) { return a.rank - b.rank || a.name.localeCompare(b.name, 'zh'); });
    var harmony = DATA.operators.filter(function (op) { return harmonyOp(op); });
    harmony.sort(function (a, b) { return a.rank - b.rank; });
    harmony.forEach(function (op) { list.push(op); });
    list = list.filter(function (op) {
      if (op.name === '盟约·辅助干员') return state.strategy === 'pith';
      return true;
    });
    return list;
  }
  function buildPalette() {
    var pal = $('palette');
    pal.innerHTML = paletteList().map(function (op) {
      var meta = (op.position === 'RANGED' ? '高台·远程' : '地面·近战') + ' · ' + RANK_GLYPH[op.rank - 1] + '阶';
      if (harmonyOp(op)) meta += ' · 调和';
      return '<button type="button" class="opCard rk' + op.rank + (harmonyOp(op) ? ' harmony' : '') + '" data-name="' + esc(op.name) + '">' +
        '<img class="ava" src="' + AVATAR[op.name] + '" alt="">' +
        '<span class="info"><span class="nm">' + esc(op.name) + '</span><span class="meta2">' + meta + '</span></span>' +
        '<span class="rk">' + RANK_GLYPH[op.rank - 1] + '</span>' +
        (harmonyOp(op) ? '<span class="badgeHarm">调和</span>' : '') +
        '</button>';
    }).join('');
    pal.querySelectorAll('.opCard').forEach(function (card) {
      card.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        e.preventDefault();
        hideUnitBar(); hideEquip();
        startDrag({ kind: 'palette', name: card.dataset.name, elite: state.eliteMode === 'elite', x0: e.clientX, y0: e.clientY });
      });
      card.addEventListener('click', function (e) {
        if (e.detail === 0) return;
      });
    });
  }

  /* ---------------- 整备区 ---------------- */
  function renderBench() {
    var row = $('benchRow');
    var html = '';
    for (var i = 0; i < BENCH_N; i++) {
      var b = state.bench[i];
      var cls = 'benchSlot';
      if (b) cls += ' filled';
      if (state.selectedBench === i) cls += ' sel';
      html += '<div class="' + cls + '" data-idx="' + i + '">' +
        '<span class="slotNo">第' + (i + 1) + '格</span>' +
        (i === BENCH_N - 1 ? '<span class="firstTag">最先</span>' : '');
      if (b) {
        html += '<img class="bAva" src="' + AVATAR[b.name] + '" alt="">' +
          (b.elite ? '<span class="bElite">精</span>' : '') +
          '<span class="bName">' + esc(b.name) + '</span>' +
          '<span class="bMeta">' + esc(SHORT[b.name] || '') + '</span>' +
          '<button type="button" class="rmBtn" data-rm="' + i + '" title="从整备区移除">×</button>';
      } else {
        html += '<span class="emptyTxt">空</span><span class="slotHint">拖入干员</span>';
      }
      html += '</div>';
    }
    row.innerHTML = html;
    row.querySelectorAll('.benchSlot').forEach(function (slot) {
      var idx = Number(slot.dataset.idx);
      slot.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        if (e.target.closest('.rmBtn')) return;
        var b = state.bench[idx];
        if (!b) return;
        e.preventDefault();
        hideUnitBar(); hideEquip();
        startDrag({ kind: 'bench', idx: idx, name: b.name, elite: !!b.elite, extra: b, x0: e.clientX, y0: e.clientY, dep: null });
      });
    });
    row.querySelectorAll('.rmBtn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var i = Number(btn.dataset.rm);
        state.bench[i] = null;
        hideUnitBar();
        renderBench(); save();
      });
    });
  }

  /* ---------------- 拖拽管理 ---------------- */
  function startDrag(info) {
    info.moved = false;
    state.drag = info;
    document.body.classList.add('dragging');
    if (info.kind === 'unit') {
      var _u0 = unitByUid(info.uid);
      info.name = _u0 ? _u0.name : '';
      info.snap = _u0 ? JSON.parse(JSON.stringify(_u0)) : null;
    }
    if (info.name) showGhost(info.name);
    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', onDragUp, { once: true });
    document.addEventListener('pointercancel', onDragCancel, { once: true });
  }
  function showGhost(name) {
    var g = $('dragGhost');
    g.innerHTML = '<img src="' + AVATAR[name] + '" alt=""><span>' + esc(SHORT[name] || name) + '</span>';
    g.hidden = false;
  }
  function moveGhost(x, y) {
    var g = $('dragGhost');
    g.style.left = (x + 14) + 'px';
    g.style.top = (y + 10) + 'px';
  }
  function clearDropHl() {
    document.querySelectorAll('.dropOk,.dropBad').forEach(function (el) { el.classList.remove('dropOk', 'dropBad'); });
    var pal = $('palette'); if (pal) pal.classList.remove('destroyOn');
  }
  function onDragMove(e) {
    var d = state.drag; if (!d) return;
    if (!d.moved) {
      var dx = e.clientX - d.x0, dy = e.clientY - d.y0;
      if (dx * dx + dy * dy < 25) return;
      d.moved = true;
      hideUnitBar(); hideEquip();
      if (d.kind === 'unit' && d.snap && !d.taken) {
        state.units = state.units.filter(function (x) { return x.uid !== d.snap.uid; });
        state.rotate = null; state.aim = { dir: null }; state.selectedUid = null;
        d.taken = true; renderBoard();
      }
    }
    moveGhost(e.clientX, e.clientY);
    clearDropHl();
    var t = document.elementFromPoint(e.clientX, e.clientY);
    if (!t) return;
    var palEl = $('palette');
    if ((d.kind === 'unit' || d.kind === 'bench') && (t.closest('#paletteCard') || (palEl && palEl.contains(t)))) {
      clearDropHl();
      if (palEl) palEl.classList.add('destroyOn');
      return;
    }
    var slot = t.closest('.benchSlot');
    var cell = t.closest('.cell');
    var token = t.closest('.token');
    function mark(el, ok, msg) {
      if (!el) return;
      el.classList.add(ok ? 'dropOk' : 'dropBad');
    }
    if (slot) {
      var idx = Number(slot.dataset.idx);
      var ok = true;
      if (d.kind === 'bench') ok = (idx !== d.idx);
      if (d.kind === 'unit') ok = true;
      if (d.kind === 'palette') ok = true;
      mark(slot, ok);
    } else if (cell) {
      var r = Number(cell.dataset.r), c = Number(cell.dataset.c);
      var op = opByName(d.name || (d.kind === 'unit' ? (unitByUid(d.uid) || {}).name : ''));
      var res = op ? canPlaceOp(op, codeAt(r, c)) : { ok: false };
      var occupied = unitAt(r, c);
      if (occupied && !(d.kind === 'unit' && occupied.uid === d.uid)) {
        if (d.kind === 'unit') {
          var okSwap = canPlaceOp(opByName(d.name || (d.snap || {}).name), codeAt(occupied.r, occupied.c)).ok &&
            canPlaceOp(opByName(occupied.name), codeAt((d.snap || {}).r, (d.snap || {}).c)).ok;
          res = { ok: okSwap };
        } else if (d.kind === 'bench') {
          res = { ok: canPlaceOp(opByName(d.name), codeAt(r, c)).ok };
        } else {
          res = { ok: true };
        }
      }
      /* palette 也可直接上棋盘 */
      mark(cell, res.ok);
    } else if (token && d.kind === 'unit') {
      mark(token.closest('.cell'), true);
    }
  }
  function onDragCancel() {
    var d = state.drag;
    if (d && d.kind === 'unit' && d.taken && d.snap) restoreDraggedUnit(d.snap);
    cleanupDrag();
    if (d) renderAll();
  }
  function cleanupDrag() {
    state.drag = null;
    document.body.classList.remove('dragging');
    $('dragGhost').hidden = true;
    clearDropHl();
    document.removeEventListener('pointermove', onDragMove);
  }
  function onDragUp(e) {
    var d = state.drag;
    cleanupDrag();
    if (!d) return;
    if (!d.moved) { handleClick(d); return; }
    var t = document.elementFromPoint(e.clientX, e.clientY);
    if (!t) { if (d.kind === 'unit' && d.taken) { restoreDraggedUnit(d.snap); renderAll(); } return; }
    var palEl = $('palette');
    var overPal = !!(t.closest('#paletteCard') || (palEl && palEl.contains(t)));
    if (overPal && (d.kind === 'unit' || d.kind === 'bench')) {
      if (d.kind === 'unit') {
        var nm = d.snap ? d.snap.name : '';
        d.taken = false;
        state.selectedUid = null; state.rotate = null; state.aim = { dir: null };
        state.result = null; cleanStale(); hideUnitBar(); hideEquip();
        renderAll(); save();
        toast((SHORT[nm] || nm) + ' 已销毁');
      } else {
        var nm2 = state.bench[d.idx] ? state.bench[d.idx].name : '';
        state.bench[d.idx] = null;
        renderBench(); save();
        toast((SHORT[nm2] || nm2) + ' 已销毁');
      }
      return;
    }
    var slot = t.closest('.benchSlot');
    var cell = t.closest('.cell');
    if (slot) {
      var idx = Number(slot.dataset.idx);
      if (d.kind === 'palette') {
        state.bench[idx] = { name: d.name, elite: !!d.elite, own: 'global', potential: 1, module: 1 };
        renderBench(); save();
        toast((SHORT[d.name] || d.name) + ' 已放入整备区第 ' + (idx + 1) + ' 格');
        return;
      }
      if (d.kind === 'bench') {
        if (idx === d.idx) return;
        var otherB = state.bench[idx];
        state.bench[d.idx] = otherB || null;
        state.bench[idx] = { name: d.name, elite: !!d.elite,
          extraHpPct: (d.extra && d.extra.extraHpPct) || 0, extraDefPct: (d.extra && d.extra.extraDefPct) || 0, extraAtkPct: (d.extra && d.extra.extraAtkPct) || 0,
          own: (d.extra && d.extra.own) || 'global', potential: (d.extra && d.extra.potential) || 1, module: (d.extra && d.extra.module) || 1 };
        renderBench(); save();
        toast('整备区已交换');
        return;
      }
      var sp = d.snap; if (!sp) return;
      var benchOther = state.bench[idx];
      if (benchOther) {
        var chk0 = canPlaceOp(opByName(benchOther.name), codeAt(sp.r, sp.c));
        if (!chk0.ok) { if (d.taken) restoreDraggedUnit(sp); toast(chk0.msg + '，无法交换', 'warn'); renderAll(); return; }
        state.bench[idx] = { name: sp.name, elite: !!sp.elite,
          extraHpPct: sp.extraHpPct || 0, extraDefPct: sp.extraDefPct || 0, extraAtkPct: sp.extraAtkPct || 0,
          own: sp.own || 'global', potential: sp.potential || 1, module: sp.module || 1 };
        d.taken = false;
        startPending(benchOther.name, !!benchOther.elite, sp.r, sp.c, null, benchOther);
        toast('与整备区「' + (SHORT[sp.name] || sp.name) + '」交换，请为 ' + (SHORT[benchOther.name] || benchOther.name) + ' 选择朝向');
        return;
      }
      state.units = state.units.filter(function (x) { return x.uid !== sp.uid; });
      state.bench[idx] = { name: sp.name, elite: !!sp.elite,
        extraHpPct: sp.extraHpPct || 0, extraDefPct: sp.extraDefPct || 0, extraAtkPct: sp.extraAtkPct || 0 };
      d.taken = false;
      state.selectedUid = null; state.rotate = null; state.aim = { dir: null };
      hideUnitBar(); hideEquip(); renderAll(); save();
      toast((SHORT[sp.name] || sp.name) + ' 已放入整备区（可拖回棋盘重新部署）');
      return;
    }
    if (cell) {
      var r = Number(cell.dataset.r), c = Number(cell.dataset.c);
      if (d.kind === 'palette') {
        var occ = unitAt(r, c);
        if (occ) {
          state.units = state.units.filter(function (x) { return x.uid !== occ.uid; });
          if (state.selectedUid === occ.uid) state.selectedUid = null;
          state.rotate = null; state.aim = { dir: null };
          state.result = null; cleanStale(); hideUnitBar(); hideEquip();
        }
        startPending(d.name, !!d.elite, r, c, null);
        toast((SHORT[d.name] || d.name) + ' 已部署到 ' + (r + 1) + '-' + (c + 1) + '，请选择朝向');
        return;
      }
      if (d.kind === 'bench') {
        if (unitAt(r, c)) { swapBenchToCell(d, r, c); return; }
        startPending(d.name, !!d.elite, r, c, d.idx, d.extra || null);
        return;
      }
      if (d.kind === 'unit') {
        var snap = d.snap; if (!snap) return;
        var hit = unitAt(r, c);
        if (hit) { swapFieldUnits(d, snap, hit, r, c); return; }
        var chk = canPlaceOp(opByName(snap.name), codeAt(r, c));
        if (!chk.ok) { if (d.taken) restoreDraggedUnit(snap); toast(chk.msg, 'warn'); renderAll(); return; }
        d.taken = false;
        startPendingMove(snap, r, c);
        return;
      }
    }
    if (d.kind === 'unit' && d.taken) { restoreDraggedUnit(d.snap); renderAll(); }
  }
  function handleClick(d) {
    if (d.kind === 'palette') { openOperatorModal(d.name); return; }
    if (d.kind === 'bench') {
      if (state.selectedBench === d.idx) { hideUnitBar(); renderBench(); return; }
      showBenchBar(d.idx);
      return;
    }
    if (d.kind === 'unit') {
      if (state.rotate && state.rotate.uid === d.uid) { exitUnitIndicator(true); return; }
      selectUnit(d.uid, true);
    }
  }

  /* ---------------- 部署（菱形定朝向） ---------------- */
  function startPending(name, elite, r, c, fromBench, extras) {
    var op = opByName(name); if (!op) return;
    var chk = canPlaceOp(op, codeAt(r, c));
    if (!chk.ok) { toast(chk.msg, 'warn'); return; }
    if (unitAt(r, c)) { toast('该格已有干员', 'warn'); return; }
    if (unitAt(r, c) || state.units.length >= LIMIT) { toast('上场干员已达上限 ' + LIMIT, 'warn'); return; }
    if (typeof fromBench === 'number') state.bench[fromBench] = null;
    var _ex = extras || {};
    state.pending = { name: name, elite: !!elite, r: r, c: c, fromBench: (typeof fromBench === 'number' ? fromBench : null),
      extraHpPct: _ex.extraHpPct || 0, extraDefPct: _ex.extraDefPct || 0, extraAtkPct: _ex.extraAtkPct || 0,
      own: _ex.own || 'global', potential: _ex.potential || 1, module: _ex.module || 1 };
    state.aim = { dir: null, moveMode: false };
    state.selectedUid = null; state.rotate = null;
    hideUnitBar(); hideEquip();
    renderAll();
  }
  function restoreDraggedUnit(snap) {
    if (!snap) return;
    if (!unitByUid(snap.uid)) state.units.push(JSON.parse(JSON.stringify(snap)));
    state.units.sort(function (a, b) { return (a.r - b.r) || (a.c - b.c); });
  }
  function startPendingMove(snap, r, c) {
    var op = opByName(snap.name);
    var chk = canPlaceOp(op, codeAt(r, c));
    if (!chk.ok) { restoreDraggedUnit(snap); toast(chk.msg, 'warn'); renderAll(); return; }
    if (unitAt(r, c)) { restoreDraggedUnit(snap); toast('该格已有干员', 'warn'); renderAll(); return; }
    state.units = state.units.filter(function (x) { return x.uid !== snap.uid; });
    state.pending = { name: snap.name, elite: !!snap.elite, r: r, c: c, fromBench: null, movingFrom: snap,
      own: snap.own || 'global', potential: snap.potential || 1, module: snap.module || 1 };
    state.aim = { dir: null, moveMode: false };
    state.selectedUid = null; state.rotate = null;
    hideUnitBar(); hideEquip();
    renderAll();
  }
  function exitUnitIndicator(keepSel) {
    state.rotate = null; state.aim = { dir: null };
    if (!keepSel) { state.selectedUid = null; hideUnitBar(); }
    hideEquip();
    renderAll(); save();
  }
  function cancelPending() {
    var p = state.pending; if (!p) return;
    state.pending = null; state.aim = { dir: null };
    if (p.movingFrom) { restoreDraggedUnit(p.movingFrom); }
    if (typeof p.fromBench === 'number') {
      var _bex = { name: p.name, elite: p.elite, extraHpPct: p.extraHpPct || 0, extraDefPct: p.extraDefPct || 0, extraAtkPct: p.extraAtkPct || 0 };
      if (!state.bench[p.fromBench]) state.bench[p.fromBench] = _bex;
      else {
        var free = state.bench.indexOf(null);
        if (free >= 0) state.bench[free] = _bex;
        else toast('整备区已满，' + p.name + ' 未返回整备区', 'warn');
      }
    }
    renderAll(); save();
  }
  function movePendingTo(r, c) {
    var p = state.pending; if (!p) return;
    var op = opByName(p.name);
    var chk = canPlaceOp(op, codeAt(r, c));
    if (!chk.ok) { toast(chk.msg, 'warn'); return; }
    if (unitAt(r, c)) { toast('该格已有干员', 'warn'); return; }
    p.r = r; p.c = c; renderAll();
  }
  function commitFacing(dir) {
    if (state.rotate) {
      var ru = unitByUid(state.rotate.uid);
      if (ru) { ru.facing = dir; }
      state.rotate = null; state.aim = { dir: null };
      markStale(); renderAll(); save();
      return;
    }
    var p = state.pending; if (!p) return;
    if (state.units.length >= LIMIT) { toast('上场干员已达上限 ' + LIMIT, 'warn'); return; }
    var _snap = p.movingFrom || null;
    var _src = _snap || p;
    var u = {
      uid: state.nextUid++, name: p.name, elite: !!p.elite, r: p.r, c: p.c, facing: dir,
      extraHpPct: _src.extraHpPct || 0,
      extraDefPct: _src.extraDefPct || 0,
      extraAtkPct: _src.extraAtkPct || 0,
      own: _src.own || 'global',
      potential: _src.potential || 1,
      module: _src.module || 1,
      benchSlot: (typeof p.fromBench === 'number' ? p.fromBench : null)
    };
    state.units.push(u);
    state.pending = null; state.aim = { dir: null };
    state.result = null; markStale();
    renderAll(); save();
    toast('已部署 ' + u.name + ' @' + (u.r + 1) + '-' + (u.c + 1) + ' · ' + DIRNAME[dir]);
  }

  function renderAim() {
    var layer = $('deployLayer');
    var target = null;
    if (state.pending) target = { r: state.pending.r, c: state.pending.c, name: state.pending.name, elite: state.pending.elite, fromBench: state.pending.fromBench };
    else if (state.rotate) {
      var ru = unitByUid(state.rotate.uid);
      if (ru) target = { r: ru.r, c: ru.c, name: ru.name, elite: ru.elite, rotate: true, facing: ru.facing };
    }
    if (!target) { layer.hidden = true; layer.innerHTML = ''; return; }
    var cell = document.querySelector('#board .cell[data-r="' + target.r + '"][data-c="' + target.c + '"]');
    if (!cell) { layer.hidden = true; return; }
    var cx = cell.offsetLeft + cell.offsetWidth / 2;
    var cy = cell.offsetTop + cell.offsetHeight / 2;
    var dir = state.aim.dir;
    var isRot = !!target.rotate;
    var corners = ['U', 'R', 'D', 'L'].map(function (k) {
      return '<div class="aimCorner c-' + k.toLowerCase() + (dir === k ? ' hot' : '') + '" data-dir="' + k + '" title="' + DIRNAME[k] + '">' + arrowSvg(k) + '</div>';
    }).join('');
    layer.innerHTML = '<div class="diamondWrap' + (target.r >= 2 ? ' flipUp' : '') + '" style="left:' + cx + 'px;top:' + cy + 'px">' +
      '<div class="diamond"></div>' +
      corners +
      '<div class="innerDiamond' + (dir ? ' aim-' + dir : '') + '" title="拖动到四角选择朝向"></div>' +
      (isRot ? '<img class="aimToken" src="' + AVATAR[target.name] + '" alt="">' : '') +
      (isRot ? '' : '<div class="deployTip">拖中间小菱形到四角选择朝向 · 松手即部署（Esc 取消）</div>') +
      '<div class="deployActions">' +
        '<button type="button" class="cancel" data-act="cancel">取消</button>' +
        (isRot ? '' : '<button type="button" class="move" data-act="move">移动位置</button>') +
      '</div>' +
      '</div>';
    layer.hidden = false;
    var wrap = layer.querySelector('.diamondWrap');
    var inner = wrap.querySelector('.innerDiamond');
    if (isRot) {
      /* aimToken 仅作视觉，不拦截指针：拖动交给小菱形/大菱形 */
      wrap.querySelector('.diamond').addEventListener('pointerdown', function (e) {
        if (e.target.closest('.aimCorner') || e.target.closest('.deployActions') || e.target.closest('.innerDiamond') || e.target.closest('.aimToken')) return;
        e.preventDefault(); beginAim(e, 'dir');
      });
      inner.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); beginAim(e, 'dir'); });
    } else {
      wrap.addEventListener('pointerdown', function (e) {
        if (e.target.closest('.aimCorner') || e.target.closest('.deployActions')) return;
        e.preventDefault(); beginAim(e, 'dir');
      });
    }
    wrap.querySelectorAll('.aimCorner').forEach(function (cor) {
      cor.addEventListener('pointerdown', function (e) {
        e.preventDefault(); e.stopPropagation();
        var k = cor.dataset.dir;
        if (state.rotate) {
          var ru2 = unitByUid(state.rotate.uid);
          if (ru2) ru2.facing = k;
          state.aim = { dir: k, moveMode: false };
          markStale();
          toast('朝向 → ' + DIRNAME[k]);
          exitUnitIndicator(true);
          return;
        }
        state.aim.dir = k; renderAim();
        commitFacing(k);
      });
    });
    var cancelBtn = layer.querySelector('[data-act="cancel"]');
    cancelBtn.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); });
    cancelBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (state.rotate) { toast('已取消更换朝向'); exitUnitIndicator(true); }
      else cancelPending();
    });
    var mv = layer.querySelector('[data-act="move"]');
    if (mv) mv.addEventListener('click', function (e) {
      e.stopPropagation();
      state.aim.moveMode = true;
      toast('点击棋盘上的目标格即可移动；Esc 取消');
    });
  }
  function arrowSvg(k) {
    var rot = { U: 0, R: 90, D: 180, L: 270 }[k];
    return '<svg viewBox="0 0 24 24" style="transform:rotate(' + rot + 'deg)"><path d="M12 3 L18 13 L14 13 L14 21 L10 21 L10 13 L6 13 Z" fill="#2f6fb0"/></svg>';
  }
  function moveRotatingTo(r, c) {
    var rot = state.rotate; if (!rot) return;
    var u = unitByUid(rot.uid); if (!u) return;
    if (u.r === r && u.c === c) { renderAim(); return; }
    var op = opByName(u.name);
    var chk = canPlaceOp(op, codeAt(r, c));
    if (!chk.ok) { toast(chk.msg, 'warn'); return; }
    if (unitAt(r, c)) { toast('该格已有干员', 'warn'); return; }
    u.r = r; u.c = c;
    state.selectedUid = u.uid;
    state.rotate = { uid: u.uid, oldFacing: u.facing };
    state.aim = { dir: u.facing, moveMode: false };
    markStale(); renderAll(); save();
    toast(u.name + ' 已移动到 ' + (r + 1) + '-' + (c + 1));
  }
  function beginAim(e, mode) {
    mode = mode || 'dir';
    var layer = $('deployLayer');
    var wrap = layer.querySelector('.diamondWrap');
    if (!wrap) return;
    var rect = wrap.getBoundingClientRect();
    var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    function cellUnder(ev) {
      var el = document.elementFromPoint(ev.clientX, ev.clientY);
      return el && el.closest ? el.closest('.cell') : null;
    }
    function move(ev) {
      if (mode === 'move') {
        clearDropHl();
        var cell = cellUnder(ev);
        if (cell) {
          var rr = Number(cell.dataset.r), cc = Number(cell.dataset.c);
          var ru = state.rotate ? unitByUid(state.rotate.uid) : null;
          var chk = ru ? canPlaceOp(opByName(ru.name), codeAt(rr, cc)) : { ok: false };
          cell.classList.add((chk.ok && !unitAt(rr, cc)) ? 'dropOk' : 'dropBad');
        }
        return;
      }
      var dx = ev.clientX - cx, dy = ev.clientY - cy;
      if (Math.abs(dx) + Math.abs(dy) < 10) return;
      var dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U');
      if (state.aim.dir !== dir) { state.aim.dir = dir; renderAim(); }
    }
    function up(ev) {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      if (mode === 'move') {
        var cell2 = ev ? cellUnder(ev) : null;
        clearDropHl();
        if (cell2) { moveRotatingTo(Number(cell2.dataset.r), Number(cell2.dataset.c)); return; }
        return;
      }
      if (!state.aim.dir) {
        if (state.rotate) exitUnitIndicator(true);
        return;
      }
      if (state.rotate) {
        var ru2 = unitByUid(state.rotate.uid);
        if (ru2) { ru2.facing = state.aim.dir; }
        markStale();
        toast('朝向 → ' + DIRNAME[state.aim.dir]);
        exitUnitIndicator(true);
      } else {
        commitFacing(state.aim.dir);
      }
    }
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  }

  /* ---------------- 选中 / 操作栏 ---------------- */
  function hideUnitBar() { var b = $('unitBar'); if (b) { b.hidden = true; b.innerHTML = ''; } var rx = $('retreatBtn'); if (rx) { rx.hidden = true; rx.onclick = null; } state.selectedBench = null; }
  function hideEquip() { var e = $('equipPop'); if (e) { e.hidden = true; e.innerHTML = ''; } }
  function cellElOf(r, c) { return document.querySelector('#board .cell[data-r="' + r + '"][data-c="' + c + '"]'); }
  function selectUnit(uid, showDiamond) {
    var u = unitByUid(uid); if (!u) return;
    if (state.rotate && state.rotate.uid !== uid) { state.rotate = null; state.aim = { dir: null }; }
    state.selectedBench = null;
    if (showDiamond && state.rotate && state.rotate.uid === uid) { exitUnitIndicator(true); return; }
    state.selectedUid = uid;
    state.pending = null;
    state.aim = { dir: null, moveMode: false };
    state.rotate = showDiamond ? { uid: u.uid, oldFacing: u.facing } : null;
    renderBoard();
    renderUnitBar();
    renderBench();
    if (state.result && !state.dirty) {
      var ru = findResultUnit(u);
      if (ru) {
        state.tab = 'detail'; syncTabs();
      }
      renderResults();
    }
    save();
  }
  function findResultUnit(u) {
    if (!state.result) return null;
    for (var i = 0; i < state.result.units.length; i++) {
      var x = state.result.units[i];
      if (x.name === u.name && x.r === u.r && x.c === u.c) return x;
    }
    return null;
  }
  function renderUnitBar() {
    var bar = $('unitBar');
    var rx = $('retreatBtn');
    if (state.selectedBench != null) {
      var slot = document.querySelector('#benchRow .benchSlot[data-idx="' + state.selectedBench + '"]');
      var b = state.bench[state.selectedBench];
      if (!slot || !b) { bar.hidden = true; if (rx) rx.hidden = true; return; }
      var wr = $('boardWrap').getBoundingClientRect();
      var sr = slot.getBoundingClientRect();
      var cx = sr.left - wr.left + sr.width / 2;
      var btop = sr.top - wr.top - 40;
      bar.innerHTML =
        '<button type="button" data-act="equip">装备</button>' +
        '<button type="button" data-act="elite">换' + (b.elite ? '普通' : '精锐') + '</button>' +
        '<button type="button" class="danger" data-act="retreat">移除</button>';
      bar.style.left = cx + 'px';
      bar.style.top = btop + 'px';
      bar.hidden = false;
      if (rx) rx.hidden = true;
      bar.querySelector('[data-act="retreat"]').onclick = function (e) {
        e.stopPropagation();
        var nm = state.bench[state.selectedBench] ? state.bench[state.selectedBench].name : '';
        state.bench[state.selectedBench] = null;
        hideUnitBar(); hideEquip(); renderBench(); save();
        toast(nm + ' 已从整备区移除');
      };
      bar.querySelector('[data-act="equip"]').onclick = function (e) { e.stopPropagation(); showEquipBench(state.selectedBench, slot); };
      bar.querySelector('[data-act="elite"]').onclick = function (e) {
        e.stopPropagation();
        b.elite = !b.elite;
        renderBench(); renderUnitBar(); save();
        toast(b.name + ' 已切换为' + (b.elite ? '精锐' : '普通'));
      };
      return;
    }
    if (!state.selectedUid) { bar.hidden = true; if (rx) rx.hidden = true; return; }
    var u = unitByUid(state.selectedUid);
    var cell = u ? cellElOf(u.r, u.c) : null;
    if (!u || !cell) { bar.hidden = true; if (rx) rx.hidden = true; return; }
    var cx = cell.offsetLeft + cell.offsetWidth / 2;
    var cy = cell.offsetTop;
    bar.innerHTML =
      '<button type="button" data-act="equip">装备</button>' +
      '<button type="button" data-act="elite">换' + (u.elite ? '普通' : '精锐') + '</button>';
    var cyc = cell.offsetTop + cell.offsetHeight / 2;
    bar.style.left = cx + 'px';
    bar.style.top = (cyc - 112) + 'px';
    bar.hidden = false;
    if (rx) {
      rx.style.left = (cell.offsetLeft - 10) + 'px';
      rx.style.top = (cyc - 116) + 'px';
      rx.hidden = false;
      rx.onclick = function (e) { e.stopPropagation(); retreatUnit(u); };
    }
    bar.querySelector('[data-act="equip"]').onclick = function (e) { e.stopPropagation(); showEquip(u); };
    bar.querySelector('[data-act="elite"]').onclick = function (e) {
      e.stopPropagation();
      u.elite = !u.elite; markStale(); renderAll(); save();
      toast(u.name + ' 已切换为' + (u.elite ? '精锐' : '普通'));
    };
  }
  function retreatUnit(u) {
    if (!u) return;
    state.units = state.units.filter(function (x) { return x.uid !== u.uid; });
    if (state.selectedUid === u.uid) state.selectedUid = null;
    if (state.rotate && state.rotate.uid === u.uid) state.rotate = null;
    state.aim = { dir: null };
    hideUnitBar(); hideEquip();
    state.result = null; markStale();
    renderAll(); save();
    toast(u.name + ' 已撤退（从场上移除，不回整备区）');
  }
  function moduleOptions(name, v) {
    var op = opByName(name); var mods = (op && op.modules) || [];
    if (mods.length < 2) return '';
    var cur = v || 1;
    return mods.map(function (m, i) {
      var lab = '模组' + (i === 0 ? 'Ⅰ' : 'Ⅱ') + ' · ' + (m.name || '');
      return '<option value="' + (i + 1) + '"' + (cur === (i + 1) ? ' selected' : '') + '>' + esc(lab) + '</option>';
    }).join('');
  }
  function ownOptions(v) {
    var opts = [['global', '跟随全局'], ['none', '精0（无加成）'], ['p1', '精1'], ['p2', '精2 Lv1'], ['p2max', '精2 Lv60+']];
    return opts.map(function (o) { return '<option value="' + o[0] + '"' + ((v || 'global') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
  }
  function potOptions(v) {
    var out = ''; for (var i = 1; i <= 6; i++) out += '<option value="' + i + '"' + ((v || 1) === i ? ' selected' : '') + '>' + i + '</option>';
    return out;
  }
  function showEquip(u) {
    var pop = $('equipPop');
    var cell = cellElOf(u.r, u.c);
    if (!cell) return;
    var cx = cell.offsetLeft + cell.offsetWidth / 2;
    var cy = cell.offsetTop - 54;
    pop.innerHTML =
      '<h4>' + esc(u.name) + ' · 装备/额外加成</h4>' +
      '<div class="row3">' +
        '<div><label>生命 %</label><input type="number" id="eqHp" value="' + (u.extraHpPct || 0) + '"></div>' +
        '<div><label>防御 %（预留）</label><input type="number" id="eqDef" value="' + (u.extraDefPct || 0) + '"></div>' +
        '<div><label>攻击 %</label><input type="number" id="eqAtk" value="' + (u.extraAtkPct || 0) + '"></div>' +
      '</div>' +
      '<div class="row2b">' +
        '<div><label>持有练度</label><select id="eqOwn">' + ownOptions(u.own) + '</select></div>' +
        '<div><label>潜能</label><select id="eqPot">' + potOptions(u.potential) + '</select></div>' +
      '</div>' +
      (moduleOptions(u.name, u.module) ? '<div class="row2b"><div><label>模组</label><select id="eqMod">' + moduleOptions(u.name, u.module) + '</select></div></div>' : '') +
      '<p class="note">生命、攻击百分比用于当前实例；防御输入暂不参与结算。地形与队友效果须自行核对后填写，当前不自动计算。</p>' +
      '<div class="acts"><button type="button" data-act="cancel">取消</button><button type="button" class="primary" data-act="apply">应用</button></div>';
    pop.style.left = cx + 'px';
    pop.style.top = cy + 'px';
    pop.hidden = false;
    pop.querySelector('[data-act="cancel"]').onclick = hideEquip;
    pop.querySelector('[data-act="apply"]').onclick = function () {
      u.extraHpPct = Number($('eqHp').value) || 0;
      u.extraDefPct = Number($('eqDef').value) || 0;
      u.extraAtkPct = Number($('eqAtk').value) || 0;
      u.own = $('eqOwn').value;
      u.potential = Number($('eqPot').value) || 1;
      if ($('eqMod')) u.module = Number($('eqMod').value) || 1;
      hideEquip(); markStale(); renderAll(); save();
    };
    setTimeout(function () { var i = $('eqHp'); if (i) i.select(); }, 0);
  }

  function showBenchBar(idx) {
    if (!state.bench[idx]) return;
    state.selectedBench = idx;
    state.selectedUid = null;
    state.rotate = null;
    state.aim = { dir: null };
    renderAll();
  }
  function showEquipBench(idx, slot) {
    var b = state.bench[idx]; if (!b) return;
    var pop = $('equipPop');
    var wr = $('boardWrap').getBoundingClientRect();
    var sr = slot.getBoundingClientRect();
    var cx = sr.left - wr.left + sr.width / 2;
    var cy = sr.top - wr.top - 158;
    pop.innerHTML =
      '<h4>' + esc(b.name) + ' · 装备/额外加成</h4>' +
      '<div class="row3">' +
        '<div><label>生命 %</label><input type="number" id="eqHp" value="' + (b.extraHpPct || 0) + '"></div>' +
        '<div><label>防御 %（预留）</label><input type="number" id="eqDef" value="' + (b.extraDefPct || 0) + '"></div>' +
        '<div><label>攻击 %</label><input type="number" id="eqAtk" value="' + (b.extraAtkPct || 0) + '"></div>' +
      '</div>' +
      '<div class="row2b">' +
        '<div><label>持有练度</label><select id="eqOwn">' + ownOptions(b.own) + '</select></div>' +
        '<div><label>潜能</label><select id="eqPot">' + potOptions(b.potential) + '</select></div>' +
      '</div>' +
      (moduleOptions(b.name, b.module) ? '<div class="row2b"><div><label>模组</label><select id="eqMod">' + moduleOptions(b.name, b.module) + '</select></div></div>' : '') +
      '<p class="note">普通移动可带入部分设置；部分交换、取消和刷新会丢失个体设置。猎人战法替补不带入额外百分比，召唤前请核对。</p>' +
      '<div class="acts"><button type="button" data-act="cancel">取消</button><button type="button" class="primary" data-act="apply">应用</button></div>';
    pop.style.left = cx + 'px';
    pop.style.top = cy + 'px';
    pop.hidden = false;
    pop.querySelector('[data-act="cancel"]').onclick = hideEquip;
    pop.querySelector('[data-act="apply"]').onclick = function () {
      b.extraHpPct = Number($('eqHp').value) || 0;
      b.extraDefPct = Number($('eqDef').value) || 0;
      b.extraAtkPct = Number($('eqAtk').value) || 0;
      b.own = $('eqOwn').value;
      b.potential = Number($('eqPot').value) || 1;
      if ($('eqMod')) b.module = Number($('eqMod').value) || 1;
      hideEquip(); renderBench(); save();
      toast(b.name + ' 装备加成已更新');
    };
    setTimeout(function () { var i = $('eqHp'); if (i) i.select(); }, 0);
  }

  /* ---------------- 棋盘渲染 ---------------- */
  function decoFor(ch) {
    if (ch === 'F') return 'fence';
    if (ch === 'I') return 'infection';
    if (ch === 'M') return 'mire';
    if (ch === 'D') return 'grass';
    if (ch === 'P') return 'speedup';
    if (ch === 'H') return 'wall';
    if (ch === 'E' || ch === 'S') return 'portal';
    return '';
  }
  function tokenHTML(u, opts) {
    opts = opts || {};
    var cls = 'token rk' + (opByName(u.name) ? opByName(u.name).rank : 1) + (opts.sel ? ' sel' : '') + (opts.ghost ? ' ghost' : '');
    var esc_ = '';
    if (opts.elite) esc_ = '<span class="eliteBadge">精</span>';
    var arrow = '<span class="facingArrow ' + (u.facing || 'R') + '"></span>';
    var hp = '';
    if (opts.hp != null) hp = '<span class="hpTag">' + fmt(opts.hp) + '/' + fmt(opts.hpMax) + '</span>';
    var badge = '';
    if (opts.call) badge = '<span class="callBadge">' + esc(opts.call) + '</span>';
    var dead = opts.dead ? '<span class="badgeDead">倒地</span>' : '';
    var sub = opts.sub ? '<span class="badgeSub">傀</span>' : '';
    var empty = opts.emptyBadge ? '<span class="badgeEmpty">' + esc(opts.emptyBadge) + '</span>' : '';
    return '<span class="tokenWrap"><span class="' + cls + '"><img src="' + AVATAR[u.name] + '" alt="">' + esc_ + arrow + hp + dead + badge + empty + sub + '</span></span>';
  }
  function renderBoard() {
    var board = $('board');
    var m = curMap();
    board.className = 'board theme-' + (THEME[m.id] || 'white');
    var deaths = {};
    if (state.result && !state.dirty) {
      state.result.deaths.forEach(function (d) { deaths[d.r + ',' + d.c] = d; });
    }
    var resultMode = !!(state.result && !state.dirty);
    var fieldByCell = {};
    if (resultMode) state.result.field.forEach(function (f) { fieldByCell[f.r + ',' + f.c] = f; });
    var html = '';
    for (var r = 0; r < m.rows.length; r++) {
      html += '<div class="row">';
      for (var c = 0; c < m.cols; c++) {
        var ch = m.rows[r][c];
        var cls = 'cell';
        if (ch === '.') cls += ' none';
        else if (ch === ',') cls += ' floor';
        else if (ch === 'H') cls += ' high';
        else if (ch === 'E') cls += ' goal';
        else if (ch === 'S') cls += ' spawn';
        var key = r + ',' + c;
        var d = deaths[key];
        if (resultMode && d) cls += ' deadCell';
        var inner = '<span class="tileNo">' + (r + 1) + '-' + (c + 1) + '</span>';
        var deco = decoFor(ch);
        if (deco && ch !== 'H') inner += '<span class="deco ' + deco + '"></span>';
        if (ch === 'H') inner += '<span class="highTag">高台</span>';
        inner += '<span class="tokenArea">';
        if (resultMode) {
          var f = fieldByCell[key];
          if (f) {
            inner += tokenHTML({ name: f.name, facing: f.facing, elite: f.elite }, {
              hp: f.hp, hpMax: f.hpMax, sel: !!(state.resultSel && state.resultSel.r === f.r && state.resultSel.c === f.c),
              call: f.from ? ('替换 ' + SHORT[f.from] || f.from) : (f.revived ? '复活' : null),
              sub: !!f.subForm
            });
          } else if (d) {
            inner += tokenHTML({ name: d.name, facing: 'R', elite: false }, { ghost: true, dead: false, emptyBadge: d.action === 'none' ? ('倒地 #' + d.order + ' · 留空') : ('倒地 #' + d.order) });
          }
        } else {
          var u = unitAt(r, c);
          if (u) inner += tokenHTML(u, { elite: u.elite, sel: state.selectedUid === u.uid });
        }
        inner += '</span>';
        html += '<div class="' + cls + '" data-r="' + r + '" data-c="' + c + '">' + inner + '</div>';
      }
      html += '</div>';
    }
    board.innerHTML = html;
    board.querySelectorAll('.cell').forEach(function (cell) {
      cell.addEventListener('click', function (e) {
        var r = Number(cell.dataset.r), c = Number(cell.dataset.c);
        if (e.target.closest('.token')) {
          if (resultMode) { selectResultUnitAt(r, c); return; }
          var uu = unitAt(r, c);
          if (uu) {
            if (state.rotate && state.rotate.uid === uu.uid) { exitUnitIndicator(true); return; }
            selectUnit(uu.uid, true); return;
          }
        }
        if (state.pending) {
          if (state.aim && state.aim.moveMode) movePendingTo(r, c);
          else { cancelPending(); toast('已取消本次部署'); }
          return;
        }
        if (state.rotate) { exitUnitIndicator(true); return; }
        state.selectedUid = null; hideUnitBar(); hideEquip(); renderBoard(); renderBench();
      });
    });
    board.querySelectorAll('.token').forEach(function (tk) {
      tk.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        var cellEl = tk.closest('.cell'); if (!cellEl) return;
        var rr = Number(cellEl.dataset.r), cc = Number(cellEl.dataset.c);
        if (resultMode) { e.preventDefault(); e.stopPropagation(); selectResultUnitAt(rr, cc); return; }
        var uu = unitAt(rr, cc);
        if (!uu) return;
        e.preventDefault(); e.stopPropagation();
        hideUnitBar(); hideEquip();
        startDrag({ kind: 'unit', uid: uu.uid, x0: e.clientX, y0: e.clientY });
      });
    });
    requestAnimationFrame(function () {
      renderAim();
      if (state.selectedUid) renderUnitBar();
    });
  }
  function renderMapHeader() {
    var m = curMap();
    var title = m.id === 'wb' ? '白盒 · 全地面' : (m.label + (m.devices ? ' · ' + m.devices : '') + ' <small style="font-size:12px;color:var(--muted)">' + esc(m.name) + '</small>');
    $('mapTitle').innerHTML = title;
    $('mapBtnText').textContent = m.id === 'wb' ? '白盒 · 全地面' : (m.label + ' · ' + (m.devices || m.name));
    $('mapNote').innerHTML = m.note || '';
    $('mapBtn').classList.toggle('open', !$('mapMenu').hidden);
    var legend = [
      '<span class="pill"><i class="sw ground"></i>地面（可部署任何干员）</span>',
      '<span class="pill"><i class="sw high"></i>高台（仅远程/歌蕾蒂娅）</span>',
      '<span class="pill"><i class="sw none"></i>不可部署</span>',
      '<span class="pill"><i class="sw goal"></i>蓝门</span>',
      '<span class="pill"><i class="sw spawn"></i>红门</span>'
    ];
    if (m.devices) legend.push('<span class="pill"><i class="sw warn"></i>装置：' + esc(m.devices) + '</span>');
    $('mapLegend').innerHTML = legend.join('');
    $('previewBtn').hidden = (m.id === 'wb');
    var wrap = $('boardWrap');
    if (m.id === 'wb') wrap.style.backgroundImage = '';
    else wrap.style.backgroundImage = 'linear-gradient(180deg,rgba(255,252,244,.86),rgba(249,242,226,.9)), url("' + bannerOf() + '")';
    wrap.style.backgroundSize = 'cover, cover';
    wrap.style.backgroundPosition = 'center, center';
    renderBondStatus();
  }
  function renderBondStatus() {
    var box = $('bondStatus'); if (!box) return;
    var seen = {}, n = 0, harmony = false;
    state.units.forEach(function (u) {
      var op = opByName(u.name); if (!op) return;
      var bs = op.bonds || [];
      if (bs.indexOf('阿戈尔') >= 0 && !seen[u.name]) { seen[u.name] = 1; n++; }
      if (bs.indexOf('调和') >= 0) harmony = true;
    });
    var act = n + (harmony ? 1 : 0);
    var tier = act >= 6 ? 2 : (act >= 3 ? 1 : 0);
    var bars = '';
    if (tier >= 1) bars += '<i class="on"></i>';
    if (tier >= 2) bars += '<i class="on"></i>';
    if (tier === 0) bars = '<i></i><i></i>';
    var cnt = '<span class="bondCount">' + (tier === 0 ? (act + '/3') : act) + '</span>';
    var tip = '阿戈尔盟约：在场不同阿戈尔 ' + n + ' 名' + (harmony ? '（+调和1，激活人数 ' + act + '）' : '') +
      ' → ' + (tier === 2 ? '已触发 6 名高档：前3名阿戈尔首次被击倒时复活/召唤' : tier === 1 ? '已激活 3 名：生命上限 +(35+层数)% + 吞噬' : '未激活：不同阿戈尔人数与调和加成合计不足 3');
    box.innerHTML = '<span class="bondChip' + (tier ? ' tier' + tier : '') + '" title="' + esc(tip) + '">' +
      '<span class="bondIcon' + (tier ? '' : ' off') + '">阿</span>' +
      '<span class="bondName">阿戈尔</span>' +
      '<span class="bondBars">' + bars + '</span>' + cnt + '</span>';
  }
  function updateLayerPreview() {
    var el = $('layersPreview'); if (!el) return;
    try {
      var res = ENGINE.simulate({
        mapId: state.mapId, layers: state.layers, own: OWN[state.ownKey], strategy: state.strategy,
        units: state.units.map(function (u) { return { name: u.name, elite: !!u.elite, r: u.r, c: u.c, facing: u.facing, extraHpPct: u.extraHpPct || 0, extraDefPct: u.extraDefPct || 0, extraAtkPct: u.extraAtkPct || 0 }; }),
        bench: [], applyTalents: false
      });
      var add = res.layersAfter - state.layers;
      el.innerHTML = '<b>' + res.layersAfter + '</b> 层' + (add ? '（休整期 ' + state.layers + ' + 开局 ' + add + '）' : '（无开局叠层）');
    } catch (e) { el.textContent = '—'; }
  }
  function renderHint() {
    var m = curMap();
    var ground = 0, high = 0;
    for (var r = 0; r < m.rows.length; r++) for (var c = 0; c < m.cols; c++) {
      var ch = m.rows[r][c];
      if (isGroundCode(ch)) ground++;
      else if (isHighCode(ch)) high++;
    }
    var parts = ['可用部署位 ' + (ground + high) + ' 个（地面 ' + ground + (high ? ' / 高台 ' + high : '') + '）',
      '上场 ' + state.units.length + '/' + LIMIT];
    if (state.pending) parts.push('正在部署 ' + state.pending.name + '：拖中间小菱形到四角选朝向，Esc 取消');
    if (state.rotate) parts.push('正在为 ' + (unitByUid(state.rotate.uid) || {}).name + ' 选择朝向 · 拖中央小菱形或点角箭头 · Esc 结束');
    if (state.strategy === 'pith') parts.push('策略：Pith「优等生」· 盟约·辅助干员已加入干员库');
    $('boardHint').textContent = parts.join(' · ');
    updateLayerPreview();
    var tip = document.querySelector('.benchTip');
    if (tip) {
      if (state.strategy === 'gladiia') tip.textContent = '猎人战法：达到 6 人档后，前 3 名阿戈尔倒地，从右向左取可部署阿戈尔替补';
      else if (state.strategy === 'pith') tip.textContent = 'Pith 优等生：达到 6 人档后，前 3 名阿戈尔倒地原地复活；不取整备区替补';
      else tip.textContent = '其他：不模拟其他策略专属效果；达到 6 人档后，前 3 名阿戈尔倒地原地复活';
    }
  }

  /* ---------------- 编辑态 / 重置休整期 / 交换 ---------------- */
  function switchToEdit() {
    state.result = null; state.resultSel = null; highlightPalette(null);
    cleanStale();
    renderRunBtn();
  }
  function selectResultUnitAt(r, c) {
    if (!state.result) return;
    var name = null;
    state.result.field.forEach(function (f) { if (f.r === r && f.c === c) name = f.name; });
    if (!name) state.result.deaths.forEach(function (d) { if (d.r === r && d.c === c) name = d.name; });
    if (!name) return;
    state.resultSel = { name: name, r: r, c: c };
    state.selectedUid = null; state.rotate = null; state.aim = { dir: null }; state.selectedBench = null;
    hideUnitBar(); hideEquip();
    state.tab = 'detail'; syncTabs();
    renderResults(); renderBoard(); highlightPalette(name);
    save();
  }
  function highlightPalette(name) {
    var p = $('palette'); if (!p) return;
    p.querySelectorAll('.opCard').forEach(function (card) { card.classList.toggle('hi', card.dataset.name === name); });
  }
  function renderRunBtn() {
    var b = $('runBtn'); if (!b) return;
    if (state.result) { b.innerHTML = '↩ 重置休整期'; b.classList.add('runReset'); b.title = '回到点击开始本回合前的整备状态'; }
    else { b.innerHTML = '▶ 开始本回合'; b.classList.remove('runReset'); b.title = ''; }
  }
  function resetToPreBattle() {
    if (state.preBattle) {
      state.units = JSON.parse(JSON.stringify(state.preBattle.units));
      state.bench = JSON.parse(JSON.stringify(state.preBattle.bench));
    }
    state.result = null; state.resultSel = null; state.pending = null; state.aim = { dir: null }; state.rotate = null;
    state.selectedUid = null;
    hideUnitBar(); hideEquip(); cleanStale();
    renderAll(); save();
    toast('已回到本回合开始前的整备状态');
  }
  function swapFieldUnits(d, snap, other, r, c) {
    var a = snap, opA = opByName(a.name), opB = opByName(other.name);
    var okA = canPlaceOp(opA, codeAt(other.r, other.c)).ok;
    var okB = canPlaceOp(opB, codeAt(a.r, a.c)).ok;
    if (!okA || !okB) {
      if (d.taken) restoreDraggedUnit(a);
      toast('双方无法合法部署到交换后的地块，不能交换', 'warn'); renderAll(); return;
    }
    other.r = a.r; other.c = a.c;
    var moved = JSON.parse(JSON.stringify(a)); moved.r = r; moved.c = c;
    state.units.push(moved);
    d.taken = false;
    state.selectedUid = null; state.rotate = null; state.aim = { dir: null };
    state.result = null; cleanStale(); hideUnitBar(); hideEquip();
    renderAll(); save();
    toast('已交换 ' + (SHORT[moved.name] || moved.name) + ' ↔ ' + (SHORT[other.name] || other.name) + '（位置互换，朝向保留）');
  }
  function swapBenchToCell(d, r, c) {
    var b = state.bench[d.idx]; if (!b) return;
    var target = unitAt(r, c); if (!target) return;
    var chk = canPlaceOp(opByName(d.name), codeAt(r, c));
    if (!chk.ok) { toast(chk.msg, 'warn'); return; }
    state.bench[d.idx] = { name: target.name, elite: !!target.elite,
      extraHpPct: target.extraHpPct || 0, extraDefPct: target.extraDefPct || 0, extraAtkPct: target.extraAtkPct || 0 };
    state.units = state.units.filter(function (x) { return x.uid !== target.uid; });
    if (state.selectedUid === target.uid) state.selectedUid = null;
    state.rotate = null; state.aim = { dir: null }; state.result = null; cleanStale();
    startPending(d.name, !!d.elite, r, c, null, d.extra || null);
    toast('与整备区「' + (SHORT[target.name] || target.name) + '」交换，请为 ' + (SHORT[d.name] || d.name) + ' 选择朝向');
  }
  function syncTabs() {
    $('tabs').querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === state.tab); });
  }
  function runSimulation() {
    if (state.pending) { toast('先把正在部署的干员放下（选择朝向）', 'warn'); return; }
    if (state.rotate) { state.rotate = null; state.aim = { dir: null }; }
    if (!state.units.length) { toast('先在棋盘上部署干员', 'warn'); return; }
    if (state.units.length > LIMIT) { toast('上场干员超过上限 ' + LIMIT, 'warn'); return; }
    state.preBattle = { units: JSON.parse(JSON.stringify(state.units)), bench: JSON.parse(JSON.stringify(state.bench)) };
    var bench = state.bench.filter(function (b) { return !!b; }).map(function (b) {
      return { name: b.name, elite: !!b.elite, own: (b.own && b.own !== 'global') ? OWN[b.own] : null, potential: b.potential || 1, module: b.module || 1 };
    });
    var res;
    try {
      res = ENGINE.simulate({
        mapId: state.mapId,
        layers: state.layers,
        own: OWN[state.ownKey],
        strategy: state.strategy,
        units: state.units.map(function (u) {
          return { name: u.name, elite: !!u.elite, r: u.r, c: u.c, facing: u.facing, extraHpPct: u.extraHpPct || 0, extraDefPct: u.extraDefPct || 0, extraAtkPct: u.extraAtkPct || 0,
            own: (u.own && u.own !== 'global') ? OWN[u.own] : null, potential: u.potential || 1, module: u.module || 1 };
        }),
        bench: bench,
        applyTalents: false
      });
    } catch (err) {
      console.error(err);
      toast('计算失败：' + err.message, 'bad');
      return;
    }
    state.result = res; state.resultSel = null;
    cleanStale();
    state.tab = 'report';
    state.selectedUid = null; hideUnitBar(); hideEquip();
    syncTabs();
    renderAll(); save();
  }

  function posTxt(r, c) { return (r + 1) + '-' + (c + 1); }
  function renderResults() {
    var box = $('resultsBody');
    if (!state.result) {
      box.innerHTML = '<div class="emptyBox">摆好干员、输入休整期层数，点「▶ 开始本回合」查看开局吞噬、倒地与整备区替换结果。<br>单击左侧干员卡可以查看面板与特质；地图名旁「地图参考图」可看实拍。</div>';
      return;
    }
    var r = state.result;
    var html = '';
    var highCls = r.highTier ? 'ok' : 'warn';
    html += '<div class="resSummary">' +
      '<span class="kv">地图 <b>' + esc(r.map.label) + '</b></span>' +
      '<span class="kv">层数 <b>' + r.layersInput + ' → ' + r.layersAfter + '</b></span>' +
      '<span class="kv">生命加成参数（仅激活时生效）<b>+' + r.layerPct + '%</b></span>' +
      '<span class="kv">在场不同阿戈尔 <b>' + r.distinctAegir + (r.harmonyBonus ? ' +调和1' : '') + '</b></span>' +
      '<span class="kv ' + highCls + '">' + (r.highTier ? (r.distinctAegir >= 6 ? '6名高档已触发' : '调和补足高档已触发') : '未达6名高档') + '</span>' +
      '<span class="kv">策略 <b>' + esc(r.strategyName) + '</b></span>' +
      '<span class="kv">吞噬标记 <b>' + r.marks.length + '</b></span>' +
      (r.layersFromDevour ? '<span class="kv warn">标记叠层参考 +' + r.layersFromDevour + '（不回算本次生命）</span>' : '') +
      (state.dirty ? '<span class="kv bad">配置已修改，需重新计算</span>' : '') +
      '</div>';
    if (state.tab === 'report') {
      html += '<div class="resGroupTitle">倒地顺序与处理</div>';
      if (!r.deaths.length) {
        html += '<div class="emptyBox" style="padding:14px">本次开局没有人被吞噬击倒。</div>';
      } else {
        html += '<table class="grid"><thead><tr><th>#</th><th>干员</th><th>位置</th><th>处理</th></tr></thead><tbody>';
        r.deaths.forEach(function (d) {
          var act = d.action === 'replace' ? ('召唤替换 → ' + esc(d.benchName) + '（整备区最右可部署者）')
            : d.action === 'revive' ? '原地满血复活（当前策略无替换）'
              : '倒地（未复活或替换，位置留空）';
          html += '<tr><td>' + d.order + '</td><td class="' + (d.action === 'none' ? 'dead' : '') + '">' + esc(d.name) + '</td><td class="pos">' + posTxt(d.r, d.c) + '</td><td>' + act + '</td></tr>';
        });
        html += '</tbody></table>';
      }
      html += '<div class="resGroupTitle">结算后场上</div>';
      if (!r.field.length) html += '<div class="emptyBox" style="padding:14px">场上没有干员。</div>';
      else {
        html += '<div class="fieldList">' + r.field.map(function (f) {
          var tags = [];
          if (f.from) tags.push('替换 ' + esc(SHORT[f.from] || f.from));
          if (f.revived) tags.push('复起/召唤');
          if (f.subForm) tags.push('傀儡形态');
          return '<span class="chip' + (f.from ? ' replace' : f.revived ? ' revive' : '') + '">' + esc(f.name) + ' @' + posTxt(f.r, f.c) + (tags.length ? ' <small>' + tags.join(' · ') + '</small>' : '') + '</span>';
        }).join('') + '</div>';
      }
      html += '<div class="resGroupTitle">部署顺序（列优先：同一列从上到下，再从左到右）</div>';
      html += '<div class="orderList">' + r.deployOrder.map(function (u, i) {
        return '<span class="orderPill">' + (i + 1) + '. <b>' + esc(SHORT[u.name] || u.name) + '</b> @' + posTxt(u.r, u.c) + ' ' + (DIRNAME[u.facing] || '') + '</span>';
      }).join('') + '</div>';
      if (r.warnings.length) {
        html += '<div class="resGroupTitle">提示</div><ul class="warnList">' + r.warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>';
      }
    } else {
      html += '<div class="resGroupTitle">原始场上实例的参考数值</div><p class="hlRowNote">标记来源与标记目标均为标记阶段记录，含随后取消的标记；同名用位置区分。攻击列在无继承时可能只显示基准值，替补数值未在此另列。请结合日志与已知限制核对。</p>';
      html += '<table class="grid"><thead><tr><th>干员</th><th>位置/朝向</th><th>攻击参考（基准→继承后）</th><th>阻挡</th><th>血量</th><th>标记来源</th><th>标记目标</th><th>结果</th></tr></thead><tbody>';
      r.units.forEach(function (u) {
        var resTxt = u.dead ? ('倒地 #' + u.deathOrder) : (u.subForm ? '切换傀儡（未阵亡）' : (u.revived ? '已复活' : '存活'));
        if (u.replacedBy) resTxt += ' → 替换为 ' + esc(SHORT[u.replacedBy] || u.replacedBy);
        var cls = u.dead ? 'dead' : (u.revived ? 'revived' : '');
        html += '<tr data-key="' + esc(u.name) + '|' + u.r + '|' + u.c + '">' +
          '<td><b>' + esc(u.name) + '</b></td>' +
          '<td class="pos">' + posTxt(u.r, u.c) + ' / ' + (DIRNAME[u.facing] || '') + '</td>' +
          '<td>' + fmt(u.baseAtk) + (u.inheritAtk ? ' → ' + fmt(u.atk) + ' <small>(+' + fmt(u.inheritAtk) + ')</small>' : '') + '</td>' +
          '<td>' + u.baseBlock + (u.block !== u.baseBlock ? ' → ' + u.block : '') + '</td>' +
          '<td>' + fmt(u.hpLeft) + ' / ' + fmt(u.hpMax) + '</td>' +
          '<td>' + (u.bittenBy.length ? esc(u.bittenBy.join('、')) : '—') + '</td>' +
          '<td>' + (u.eaten.length ? esc(u.eaten.join('、')) : '—') + '</td>' +
          '<td class="' + cls + '">' + resTxt + '</td></tr>';
      });
      html += '</tbody></table>';
      html += '<div class="resGroupTitle">吞噬标记与结算日志</div><div class="logList">' +
        r.logs.map(function (l) { return '<div class="lg ' + l.kind + '">' + esc(l.text) + '</div>'; }).join('') + '</div>';
    }
    box.innerHTML = html;
    highlightRows();
  }
  function highlightRows() {
    var tbl = document.querySelector('#resultsBody table.grid');
    if (!tbl) return;
    tbl.querySelectorAll('tr').forEach(function (tr) { tr.classList.remove('hl'); });
    var resultMode = !!(state.result && !state.dirty);
    function markRow(name, r, c) {
      var tr = document.querySelector('#resultsBody tr[data-key="' + name.replace(/"/g, '\\"') + '|' + r + '|' + c + '"]');
      if (tr) { tr.classList.add('hl'); if (!resultMode) tr.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    }
    if (state.resultSel) { markRow(state.resultSel.name, state.resultSel.r, state.resultSel.c); return; }
    if (!state.selectedUid) return;
    var u = unitByUid(state.selectedUid); if (!u) return;
    markRow(u.name, u.r, u.c);
  }

  /* ---------------- 总渲染 ---------------- */
  function renderAll() {
    renderRunBtn();
    renderMapHeader();
    renderBoard();
    renderBench();
    renderHint();
    renderResults();
    renderAim();
    if (state.selectedUid || state.selectedBench != null) renderUnitBar();
  }

  /* ---------------- 演示 / 初始化 ---------------- */
  function mkUnit(name, elite, r, c, facing) {
    return { uid: state.nextUid++, name: name, elite: !!elite, r: r, c: c, facing: facing || 'R', extraHpPct: 0, extraDefPct: 0, extraAtkPct: 0, benchSlot: null };
  }
  function prefillDemo() {
    state.mapId = 'wb'; state.layers = 0;
    state.units = [
      mkUnit('幽灵鲨', false, 1, 2, 'R'),
      mkUnit('斯卡蒂', false, 1, 3, 'R'),
      mkUnit('深巡', false, 1, 4, 'R'),
      mkUnit('歌蕾蒂娅', false, 2, 2, 'R'),
      mkUnit('安哲拉', false, 2, 4, 'U')
    ];
  }
  function applyDemo(kind) {
    if (kind === 'substitute') {
      state.mapId = 'wb'; state.layers = 0; state.strategy = 'gladiia';
      state.units = [
        mkUnit('幽灵鲨', false, 0, 0, 'R'),
        mkUnit('归溟幽灵鲨', false, 0, 1, 'R')
      ];
      state.bench = [null, null, null, null, null, null];
    } else if (kind === 'six') {
      state.mapId = 'wb'; state.layers = 100; state.strategy = 'gladiia';
      state.units = ['幽灵鲨', '斯卡蒂', '归溟幽灵鲨', '水月', '歌蕾蒂娅', '乌尔比安'].map(function (n, i) { return mkUnit(n, false, 1, i, 'R'); });
      state.bench = [null, null, null, { name: '归溟幽灵鲨', elite: true }, { name: '克莱门莎', elite: false }, { name: '水月', elite: false }];
    } else if (kind === 'high') {
      state.mapId = '05'; state.layers = 50; state.strategy = 'gladiia';
      state.units = [
        mkUnit('浊心斯卡蒂', false, 0, 3, 'D'),
        mkUnit('乌尔比安', false, 0, 4, 'D'),
        mkUnit('斯卡蒂', false, 1, 3, 'D'),
        mkUnit('安哲拉', false, 2, 2, 'D'),
        mkUnit('深巡', false, 2, 3, 'L'),
        mkUnit('水月', false, 3, 2, 'R'),
        mkUnit('歌蕾蒂娅', false, 3, 3, 'R')
      ];
      state.bench = [null, null, null, { name: '克莱门莎', elite: false }, { name: '归溟幽灵鲨', elite: true }, { name: '浊心斯卡蒂', elite: false }];
    } else if (kind === 'unitdrag') {
      prefillDemo();
    } else if (kind === 'pending') {
      state.mapId = 'wb'; state.layers = 40;
      state.units = [mkUnit('幽灵鲨', false, 1, 2, 'R'), mkUnit('斯卡蒂', false, 1, 3, 'R')];
      state.bench = [null, null, null, null, null, { name: '歌蕾蒂娅', elite: false }];
      state.pending = { name: '歌蕾蒂娅', elite: false, r: 2, c: 3, fromBench: 5 };
      state.bench[5] = null;
      state.aim = { dir: null };
    } else if (kind === 'pith') {
      state.mapId = 'wb'; state.layers = 80; state.strategy = 'pith';
      state.units = [
        mkUnit('幽灵鲨', false, 1, 2, 'R'), mkUnit('斯卡蒂', false, 1, 3, 'R'), mkUnit('深巡', false, 1, 4, 'R'),
        mkUnit('歌蕾蒂娅', false, 1, 5, 'R'), mkUnit('魔王', false, 2, 2, 'R'), mkUnit('盟约·辅助干员', false, 2, 4, 'U')
      ];
      state.bench = [null, null, null, { name: '安哲拉', elite: false }, { name: '归溟幽灵鲨', elite: true }, { name: '克莱门莎', elite: false }];
    } else if (kind === 'grid') {
      state.units = []; state.bench = [null, null, null, null, null, null];
      state.result = null; state.dirty = true;
    } else if (kind === 'other') {
      state.mapId = 'wb'; state.layers = 100; state.strategy = 'other';
      state.units = ['幽灵鲨', '斯卡蒂', '归溟幽灵鲨', '水月', '歌蕾蒂娅', '乌尔比安'].map(function (n, i) { return mkUnit(n, false, 1, i, 'R'); });
      state.bench = [null, null, null, { name: '归溟幽灵鲨', elite: true }, { name: '克莱门莎', elite: false }, { name: '水月', elite: false }];
    } else if (kind === 'select' || kind === 'equip') {
      prefillDemo();
    } else if (kind === 'rotate') {
      prefillDemo();
    } else {
      prefillDemo();
    }
  }
  function init() {
    var params = new URLSearchParams(location.search);
    var demo = params.get('demo');
    if (demo) applyDemo(demo);
    else if (!load()) {
      if (params.get('map')) state.mapId = params.get('map');
      if (params.get('layers')) state.layers = Number(params.get('layers')) || 0;
      prefillDemo();
    }
    if (params.get('map')) state.mapId = params.get('map');
    if (params.get('layers')) state.layers = Math.max(0, Number(params.get('layers')) || 0);
    if (params.get('strategy')) { state.strategy = params.get('strategy'); }
    if (state.strategy !== 'gladiia' && state.strategy !== 'pith' && state.strategy !== 'other') state.strategy = 'gladiia';
    $('layersInput').value = String(state.layers);
    var metaEl = $('metaInfo');
    if (metaEl && DATA.meta) {
      metaEl.textContent = 'v13 公开测试 · 数据快照：' + DATA.meta.version + ' · 原包标注 ' + DATA.meta.checked;
    }
    buildPalette();
    bindToolbar();
    buildMapMenu();
    renderAll();
    save();

    if (demo === 'grid') {
      renderResults();
    } else if (demo === 'pending') {
      var pd = params.get('dir');
      if (pd) state.aim.dir = pd;
      requestAnimationFrame(function () { renderAim(); });
    } else if (demo === 'bench') {
      state.bench[1] = { name: '归溟幽灵鲨', elite: true, extraHpPct: 0, extraDefPct: 0, extraAtkPct: 0 };
      state.bench[3] = { name: '克莱门莎', elite: false, extraHpPct: 0, extraDefPct: 10, extraAtkPct: 0 };
      state.bench[4] = { name: '魔王', elite: false, extraHpPct: 5, extraDefPct: 0, extraAtkPct: 0 };
      renderBench();
      requestAnimationFrame(function () { showBenchBar(1); });
    } else if (demo === 'select' || demo === 'equip') {
      runSimulation();
      requestAnimationFrame(function () {
        if (state.units.length) {
          var _du = state.units.filter(function (x) { return x.name === '斯卡蒂'; })[0] || state.units[0];
          selectUnit(_du.uid, true);
          if (demo === 'equip') showEquip(_du);
        }
      });
    } else if (demo === 'move') {
      runSimulation();
      requestAnimationFrame(function () {
        if (state.units.length) selectUnit(state.units[0].uid, true);
      });
    } else if (demo === 'ressel') {
      runSimulation();
      requestAnimationFrame(function () { selectResultUnitAt(1, 2); });
    } else if (demo === 'rotate') {
      runSimulation();
      requestAnimationFrame(function () {
        if (state.units.length) {
          state.rotate = { uid: state.units[0].uid, oldFacing: state.units[0].facing };
          state.aim = { dir: state.units[0].facing };
          renderAll();
        }
      });
    } else if (demo === 'info') {
      openOperatorModal('魔王');
    } else if (demo === 'mapmenu') {
      requestAnimationFrame(function () { openMapMenu(); });
    } else if (demo === 'preview') {
      requestAnimationFrame(function () { openMapPreview(state.mapId === 'wb' ? '01' : state.mapId); });
    } else if (demo) {
      // six / high / pith 自动结算
      runSimulation();
      if (demo === 'pith') {
        requestAnimationFrame(function () {
          if (state.units.length) selectUnit(state.units[0].uid);
        });
      }
    } else if (params.get('autorun')) {
      runSimulation();
    } else {
      renderResults();
    }

    document.addEventListener('pointerdown', function (e) {
      var t = e.target;
      // 这些区域内点击不视为「空白」：棋盘/菱形层/操作栏/装备弹窗/整备区/红叉/干员库/地图选择/弹窗/预览浮层
      var keep = t.closest('#board') || t.closest('#deployLayer') || t.closest('#unitBar') || t.closest('#equipPop') ||
                 t.closest('#benchRow') || t.closest('#retreatBtn') || t.closest('#paletteCard') || t.closest('#palette') ||
                 t.closest('#mapPicker') || t.closest('.mapMenu') || t.closest('#mapMenu') || t.closest('#modalRoot') ||
                 t.closest('#hoverPreview') || t.closest('#tabs') || t.closest('#resultsBody');
      if (keep) return;
      var changed = false;
      if (state.pending) { cancelPending(); changed = true; }
      if (state.rotate) { state.rotate = null; state.aim = { dir: null }; changed = true; }
      if (state.selectedUid) { state.selectedUid = null; changed = true; }
      if (state.resultSel) { state.resultSel = null; highlightPalette(null); changed = true; }
      hideUnitBar(); hideEquip();
      if (changed) { renderAll(); save(); }
    });
    document.addEventListener('keydown', onKeyDown);
    if (params.get('dev')) window.__A = { state: function () { return state; }, select: selectUnit, exit: exitUnitIndicator, renderAll: renderAll, openOp: openOperatorModal };
  }
  function onKeyDown(e) {
    if (e.key === 'Escape') {
      if (isModalOpen()) { closeModal(); return; }
      if (!$('mapMenu').hidden) { closeMapMenu(); return; }
      if (state.aim && state.aim.moveMode) { state.aim.moveMode = false; return; }
      if (state.rotate) { state.rotate = null; state.aim = { dir: null }; renderAll(); return; }
      if (state.pending) { cancelPending(); return; }
      hideUnitBar(); hideEquip();
      if (state.selectedUid) { state.selectedUid = null; renderBoard(); renderBench(); }
      return;
    }
    if ((state.pending || state.rotate) && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) >= 0) {
      e.preventDefault();
      var dir = { ArrowUp: 'U', ArrowDown: 'D', ArrowLeft: 'L', ArrowRight: 'R' }[e.key];
      state.aim.dir = dir;
      commitFacing(dir);
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedUid && !e.target.closest('input,select,textarea')) {
      var u = unitByUid(state.selectedUid);
      if (u) { e.preventDefault(); retreatUnit(u); }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
