#!/usr/bin/env python3
"""tools/projects.json、tools/lab.json → sources/data/projects.js、lab.js(遊戲讀的格式)。
圖片要先用 tools/shots.mjs 截好放進 static/projects/images/ 與 static/lab/images/。
用法:python3 tools/make_data.py"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def write(name, header, items):
    body = ''.join(f'    {json.dumps(i, ensure_ascii=False)},\n' for i in items)
    (ROOT / 'sources' / 'data' / name).write_text(f'{header}\nexport default [\n{body}]\n', encoding='utf-8')


projects = json.loads((ROOT / 'tools' / 'projects.json').read_text(encoding='utf-8'))
write('projects.js', '// 作品清單:由 tools/projects.json 產生(圖是 tools/shots.mjs 截的 webp)', [
    {'title': p['title'], 'titleSmall': [p['title']], 'url': p['url'],
     'attributes': {'role': p['role'], 'with': p['with']}, 'distinctions': [],
     'images': [f"{p['id']}-{n}.webp" for n in (1, 2, 3)]} for p in projects])

lab = json.loads((ROOT / 'tools' / 'lab.json').read_text(encoding='utf-8'))
write('lab.js', '// 實驗室:小工具與實驗(tools/lab.json)', [
    {'title': l['title'], 'url': l['url'], 'image': f"{l['id']}.webp", 'imageMini': f"{l['id']}-mini.webp"} for l in lab])
