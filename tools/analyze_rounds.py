# -*- coding: utf-8 -*-
"""Analyze act3autochess round battle levels (01..07, h01..h06) grids."""
import json, os, glob
from collections import Counter

LVL_DIR = r'D:\Dsh-WorkSpace\tmp\levels'

def main():
    files = sorted(glob.glob(os.path.join(LVL_DIR, 'lvl_*.json')))
    for f in files:
        name = os.path.basename(f).replace('lvl_', '').replace('.json', '')
        if name in ('m01',):
            continue
        with open(f, encoding='utf-8') as fh:
            d = json.load(fh)
        md = d.get('mapData')
        if not md:
            continue
        mp = md['map']; tiles = md['tiles']
        rows = len(mp); cols = len(mp[0])
        if rows > 10 or cols > 15:
            continue
        cen = Counter()
        for r in range(rows):
            for c in range(cols):
                t = tiles[mp[r][c]]
                b = t['buildableType']; h = t['heightType']
                cen[''.join([b[0], h[0]])] += 1
        print(name, f'{rows}x{cols}', dict(cen), '| limit', d.get('options', {}).get('characterLimit'))
        # ascii deploy map for small maps
        if rows <= 8 and cols <= 12:
            ab = {'ALL': 'G' if False else 'G', 'RANGED': 'E', 'NONE': '.'}
            for r in range(rows):
                line = ''
                for c in range(cols):
                    t = tiles[mp[r][c]]
                    b = t['buildableType']
                    line += ab.get(b, '?')
                print('   ', line)

if __name__ == '__main__':
    main()
