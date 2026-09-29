#!/usr/bin/env python3
"""產生職涯區石條上的字(static/career/*.png)。紅色通道=發光的字、綠色通道=字的底板,尺寸比例要跟原圖一樣。
用法:python3 tools/make_career.py"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FONT = str(Path.home() / '.local/share/fonts/NotoSansTC-Bold.ttf')
SCALE = 4
# 檔名(對應 areas.glb 裡石條的 texture 名):原圖尺寸、每一行字(第一行粗大)
CAREER = {
    'careerHetic':           ((316, 60), ['機器手臂整合', 'KUKA 機器人']),
    'careerUzik':            ((168, 60), ['機器視覺', '檢測系統']),
    'careerImmersiveGarden': ((340, 60), ['AGV 車隊', '工業自動化系統整合']),
    'careerFreelancer':      ((240, 60), ['系統整合 SI', '十年以上']),
    'careerIRLTeacher':      ((268, 92), ['大學授課', '2015–2020', '8 門課程開源']),
    'careerOnlineTeacher':   ((332, 92), ['AI 應用開發', '擎添工業', '在職中']),
}

for name, ((w, h), lines) in CAREER.items():
    W, H = w * SCALE, h * SCALE
    im = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    d = ImageDraw.Draw(im)
    row = H / len(lines)
    for i, text in enumerate(lines):
        size = int(row * 0.78)
        font = ImageFont.truetype(FONT, size)
        while d.textlength(text, font=font) > W - 8 and size > 10:
            size -= 2
            font = ImageFont.truetype(FONT, size)
        tw = d.textlength(text, font=font)
        y0, y1 = int(i * row), int((i + 1) * row)
        d.rectangle([0, y0, tw + 12, y1 - 2], fill=(0, 255, 0, 255))      # 底板(綠)
        d.text((6, (y0 + y1) / 2), text, font=font, fill=(255, 255, 0, 255), anchor='lm')  # 字(紅+綠)
    im.save(ROOT / 'static/career' / f'{name}.png')
    print(name)
