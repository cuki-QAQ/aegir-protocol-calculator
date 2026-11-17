# -*- coding: utf-8 -*-
"""Analyze act3autochess mNN_sub_02 maps: find arena split, buildable grid, emit summary."""
import json, os, glob, sys

LVL_DIR = r'D:\Dsh-WorkSpace\tmp\levels'

def load(name):
    with open(os.path.join(LVL_DIR, f'lvl_{name}_sub_02.json'), encoding='utf-8') as f:
        return json.load(f)

def main():
    maps = ['m01','m02','m03','m04','m05','m06','m09','m10','m11','m12']
    for name in maps:
        d = load(name)
        md = d['mapData']; mp = md['map']; tiles = md['tiles']
        rows = len(mp); cols = len(mp[0])
        # buildable classification
        grid = []
        for r in range(rows):
            line = []
            for c in range(cols):
                t = tiles[mp[r][c]]
                b = t['buildableType']; h = t['heightType']
                kind = t['tileKey'].replace('tile_', '')
                if b == 'ALL' and h == 'LOWLAND':
                    s = 'G'
                elif b == 'RANGED':
                    s = 'E'
                elif b == 'ALL' and h == 'HIGHLAND':
                    s = 'H'
                else:
                    s = '.'
                line.append(s + kind[0])  # e.g. Gr = buildable road
            grid.append(line)
        print('==', name, rows, 'x', cols)
        for r in range(rows):
            print(f'r{r}: ' + ' '.join(grid[r]))
        # deployable cells positions
        dep = [(r,c) for r in range(rows) for c in range(cols) if grid[r][c][0] in 'GE']
        print('deployable count:', len(dep))
        xs = [c for r,c in dep]; ys=[r for r,c in dep]
        print('bbox cols', min(xs), max(xs), 'rows', min(ys), max(ys))
        print()

if __name__ == '__main__':
    main()
