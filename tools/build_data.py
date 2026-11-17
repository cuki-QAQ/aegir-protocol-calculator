# -*- coding: utf-8 -*-
"""Build data.js for the Aegir (阿戈尔) placement calculator.

Sources (all local, already downloaded):
  - egircal/operators.js : PRTS-derived operator snapshot of 卫戍协议·规程·序列Ⅰ
  - tmp/activity_table.json : V3_1 status / constants (not needed for data.js beyond notes)
  - tmp/levels/lvl_mNN_sub_02.json : official battle-field arena tiles (场地2)
  - tmp/range_table.json : attack range grids
Output: aegir/data.js  ->  window.AEGIR_STATIC
"""
import json, os

ROOT = os.environ.get('AEGIR_ROOT', os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LVL = os.path.join(ROOT, 'tmp', 'levels')
OUT = os.path.join(ROOT, 'aegir', 'data.js')

AEGIR = ['幽灵鲨', '安哲拉', '深巡', '斯卡蒂', '归溟幽灵鲨', '水月',
         '歌蕾蒂娅', '乌尔比安', '浊心斯卡蒂', '克莱门莎']

MAP_IDS = ['01', '02', '03', '04', '05', '06', '09', '10', '11', '12']

MAP_META = {
    '01': ('#01', '阻隔工事', '训练/标准模拟固定图；场地2半场。'),
    '02': ('#02', '', '常规战斗图。'),
    '03': ('#03', '阻隔工事 / 射击台', '常规战斗图。'),
    '04': ('#04', '活性源石', '部署于其上的我军和经过的敌军每秒受到70真实伤害，攻击力+20%，攻击速度+20。'),
    '05': ('#05', '源石流发生装置', '气流：同向敌人移速+50%。'),
    '06': ('#06', '沼泽控制', '位于沼泽地段的单位每3秒攻速-5%/移速-5%，最多10层。'),
    '09': ('#09', '隐匿模块', '位于其上的单位和敌人获得隐匿。'),
    '10': ('#10', '盐坨子炮', '传送炮图。'),
    '11': ('#11', '', '围栏图。'),
    '12': ('#12', '优化模块', '加速地板图：干员攻速提升、经过敌人移速提升。'),
}


def load_operators():
    s = open(os.path.join(ROOT, 'egircal', 'operators.js'), encoding='utf-8').read()
    j = s.find('{"version"')
    obj = json.loads(s[j:].rstrip().rstrip(';'))
    return obj


def interp_frame(frames, level):
    """Linear interpolation between level breakpoints of attributesKeyFrames."""
    fs = sorted(frames, key=lambda f: f['level'])
    if level <= fs[0]['level']:
        return fs[0]
    if level >= fs[-1]['level']:
        return fs[-1]
    for a, b in zip(fs, fs[1:]):
        if a['level'] <= level <= b['level']:
            t = (level - a['level']) / float(b['level'] - a['level']) if b['level'] != a['level'] else 0.0
            return {k: a[k] + (b[k] - a[k]) * t for k in ('maxHp', 'atk', 'def', 'magicResistance', 'blockCnt', 'cost')}
    return fs[-1]


def talent_hp_bonus(op, phase):
    """Self max_hp% from original talents (phase-gated, potential 1 only)."""
    total = 0.0
    for group in op.get('talents') or []:
        best = None
        for c in group:
            # candidates carry 'phase' key; keep highest phase <= current
            if c.get('phase', 0) <= phase:
                if best is None or c.get('phase', 0) > best.get('phase', 0):
                    best = c
        if best:
            total += float((best.get('values') or {}).get('max_hp') or 0)
    return round(total, 4)


def build_panel(op, state_idx):
    st = op['states'][state_idx]
    ph = op['phases'][st['phase']]
    fr = interp_frame(ph['frames'], st['level'])
    modstats = {}
    modtraits = []
    if st['moduleLevel'] > 0 and op.get('modules'):
        mod = op['modules'][0]
        stages = mod.get('stages') or []
        if st['moduleLevel'] - 1 < len(stages):
            stage = stages[st['moduleLevel'] - 1]
            modstats = stage.get('stats') or {}
            modtraits = stage.get('traits') or []
    hp = fr['maxHp'] + float(modstats.get('max_hp', 0) or 0)
    atk = fr['atk'] + float(modstats.get('atk', 0) or 0)
    dfn = fr['def'] + float(modstats.get('def', 0) or 0)
    res = fr['magicResistance'] + float(modstats.get('magic_resistance', 0) or 0)
    block = fr['blockCnt'] + int(modstats.get('block_cnt', 0) or 0)
    cost = fr['cost']
    thp = talent_hp_bonus(op, st['phase'])
    trait = {'desc': st['description']}
    if modtraits:
        trait['moduleTrait'] = modtraits[0].get('description', '')
        trait['moduleValues'] = modtraits[0].get('values', {})
    return {
        'phase': st['phase'],
        'level': st['level'],
        'moduleLevel': st['moduleLevel'],
        'skillLevel': st['skillLevel'],
        'rangeId': ph['rangeId'],
        'hp': round(hp, 1),
        'atk': round(atk, 1),
        'def': round(dfn, 1),
        'res': round(res, 3),
        'block': block,
        'cost': cost,
        'talentHp': thp,
        'extraStats': {'max_hp': float(modstats.get('max_hp', 0) or 0),
                       'atk': float(modstats.get('atk', 0) or 0),
                       'def': float(modstats.get('def', 0) or 0),
                       'block_cnt': int(modstats.get('block_cnt', 0) or 0)},
        'trait': trait,
    }


def build_maps():
    maps = []
    for mid in MAP_IDS:
        d = json.load(open(os.path.join(LVL, f'lvl_m{mid}_sub_02.json'), encoding='utf-8'))
        md = d['mapData']
        mp = md['map']
        tiles = md['tiles']
        rows = []
        for r in range(1, 5):
            row = ''
            for c in range(2, 11):
                t = tiles[mp[r][c]]
                key = t['tileKey']
                bt = t['buildableType']
                ht = t['heightType']
                if bt == 'RANGED' and ht == 'HIGHLAND':
                    row += 'H'
                elif bt == 'ALL' and ht == 'LOWLAND':
                    if key == 'tile_fence_bound':
                        row += 'F'
                    elif key == 'tile_infection':
                        row += 'I'
                    elif key == 'tile_mire':
                        row += 'M'
                    elif key == 'tile_duel_grassland':
                        row += 'D'
                    elif key == 'tile_speedup':
                        row += 'P'
                    else:
                        row += 'G'
                elif key == 'tile_end':
                    row += 'E'
                elif key == 'tile_start':
                    row += 'S'
                elif key == 'tile_floor':
                    row += ','
                else:
                    row += '.'
            rows.append(row)
        label, devices, note = MAP_META[mid]
        maps.append({
            'id': mid, 'label': label, 'name': '战场' + mid,
            'devices': devices, 'note': note,
            'rows': rows, 'cols': 9,
            'legend': 'G 地面·道路 / F 地面·围栏 / I 活性源石 / M 沼泽 / D 草地 / P 加速地板 / H 高台(仅远程) / E 蓝门 / S 红门 / . 不可部署 / , 装饰地面',
        })
    # white box: all ground
    wb = ['G' * 9 for _ in range(4)]
    maps.append({
        'id': 'wb', 'label': '白盒', 'name': '白盒(全地面)',
        'devices': '', 'note': '全部为地面格，无高台、无特殊地形，用于自由测试摆位。',
        'rows': wb, 'cols': 9,
        'legend': '全部可部署(地面)',
    })
    return maps


def main():
    obj = load_operators()
    by_name = {o['name']: o for o in obj['operators']}
    ranges = json.load(open(os.path.join(ROOT, 'tmp', 'range_table.json'), encoding='utf-8'))
    used_ranges = {}
    ops = []
    for name in AEGIR:
        o = by_name[name]
        states = [build_panel(o, 0), build_panel(o, 1)]
        for st in states:
            used_ranges[st['rangeId']] = ranges.get(st['rangeId'])
        ops.append({
            'id': o['id'],
            'name': name,
            'rank': o['rank'],
            'position': o['position'],
            'bonds': o['bonds'],
            'profession': o['profession'],
            'subclass': o.get('subclass'),
            'potentials': o['potentials'],
            'states': states,
        })
    data = {
        'meta': {
            'version': obj['version'],
            'season': obj['season'],
            'checked': obj['checked'],
            'source': 'PRTS 干员数据 via EgirCal snapshot + 官方关卡数据',
            'deployLimit': 8,
            'benchSize': 6,
            'layerHpBase': 35,
        },
        'operators': ops,
        'ranges': {k: v for k, v in used_ranges.items() if v},
        'maps': build_maps(),
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('/* 自动生成 by aegir/build_data.py — 数据源: egircal/operators.js(PRTS 2026-11-15 快照) + 官方 act3autochess 关卡数据 + range_table */\n')
        f.write('window.AEGIR_STATIC = ')
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';\n')
    print('wrote', OUT, os.path.getsize(OUT), 'bytes')
    for m in data['maps']:
        print(m['id'], m['rows'])


if __name__ == '__main__':
    main()
