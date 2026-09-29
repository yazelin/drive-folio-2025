#!/usr/bin/env python3
"""抓 catime 最新 12 隻成功的貓，縮成 384px 存進 static/yaze/cats/，並寫 tools/cats.json。
網站用的是建置當下的快照；要換新就重跑這支再部署。"""
import io, json, urllib.request
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
LIST = "https://raw.githubusercontent.com/yazelin/catime/main/catlist.json"
out = ROOT / "static" / "yaze" / "cats"
out.mkdir(parents=True, exist_ok=True)
cats = [c for c in json.load(urllib.request.urlopen(LIST, timeout=60)) if c.get("status") == "success" and c.get("url")]
picked = []
for c in reversed(cats):
    try:
        raw = urllib.request.urlopen(urllib.request.Request(c["url"], headers={"User-Agent": "drive-folio"}), timeout=60).read()
        im = Image.open(io.BytesIO(raw)).convert("RGB")
    except Exception as e:
        print("跳過", c["number"], e); continue
    w = min(im.size); im = im.crop(((im.width - w) // 2, (im.height - w) // 2, (im.width + w) // 2, (im.height + w) // 2)).resize((384, 384))
    name = f"cat-{c['number']}.webp"
    im.save(out / name, "WEBP", quality=80)
    picked.append({"number": c["number"], "title": c.get("title", ""), "file": name})
    print("ok", c["number"], c.get("title"))
    if len(picked) == 12:
        break
for f in out.glob("cat-*.webp"):   # 清掉不在這次名單的舊檔
    if f.name not in {p["file"] for p in picked}:
        f.unlink()
(ROOT / "tools" / "cats.json").write_text(json.dumps(picked, ensure_ascii=False, indent=1), encoding="utf-8")
