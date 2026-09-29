#!/usr/bin/env python3
"""抓 GitHub 上的公開 repo，自動分區，寫成 tools/repos.json 給 repo 城市用。

用法：python3 tools/fetch_repos.py [帳號]      （需要 gh 已登入；預設 yazelin）
分區是依 repo 名稱＋說明的關鍵字自動判斷，判錯的寫進 tools/repo-overrides.json：
  {"repo 名稱": "區的 id"}      區的 id 見下面 DISTRICTS。
"""
import json, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
USER = sys.argv[1] if len(sys.argv) > 1 else "yazelin"

# 順序就是判斷順序：先對上的先贏
DISTRICTS = [
    ("company", "公司與工業", r"ching-tech|ctos|jaba|erpnext|fishtool|metereye|cad-agent|render|blender|ikapc|visor|webcam|industrial|company-ai|printer|msi-fan|擎添|工業"),
    ("characters", "角色宇宙", r"glitch-(?!park)|mori|yori|catime|neko|token-unlimited|larch-taoyuan|world-tree|^workshop$|clawpet|clawbit|taiwan-people|city-monster|buddy|waiting-for-light|omotenashi|meltan|格莉奇|咒泉鄉"),
    ("games", "遊戲與 3D", r"battlefield|roll-formosa|k-rider|chant|glitch-park|div-smash|gewu|wwii|webgl|skull-cam|drive-folio|slot|遊戲|3d"),
    ("teaching", "教學與範本", r"^usc|^cnu|^asia2020|starter|course|dotnet10|lrt-example|jsonp|qrcode|icemore|^j303$|comfyui|guide|slide-background|ubuntu"),
    ("agents", "Agent 與開發工具", r"skill|speak|^wip$|harness|herdr|codex|claude|gemini-web|suno-web|nanobanana|mcp|ralph|agentpulse|rushcut|telegram|bot|runner|voice-loop|tts|asr|hermes|openclaw|ltx|image-service|shorturl|image-bed|ai-digest|video-sharing|^yazelin$|mycelium|mori-meeting|hey-mori|gemini-watermark|url-no-trace"),
    ("tools", "網頁小工具", r"."),   # 其他全部
]


def classify(r, overrides):
    if r["name"] in overrides:
        return overrides[r["name"]]
    text = (r["name"] + " " + (r.get("description") or "")).lower()
    for did, _, pat in DISTRICTS:
        if re.search(pat, text, re.I):
            return did
    return "tools"


def main():
    raw = json.loads(subprocess.check_output([
        "gh", "repo", "list", USER, "--limit", "500", "--visibility", "public", "--source",
        "--json", "name,description,isArchived,stargazerCount,primaryLanguage,homepageUrl,url,pushedAt"]))
    ov_path = ROOT / "tools" / "repo-overrides.json"
    overrides = json.loads(ov_path.read_text(encoding="utf-8")) if ov_path.exists() else {}
    repos = []
    for r in raw:
        if r["isArchived"]:
            continue
        repos.append({
            "name": r["name"],
            "desc": (r.get("description") or "").strip()[:80],
            "stars": r["stargazerCount"],
            "lang": (r.get("primaryLanguage") or {}).get("name") or "",
            "url": r["url"],
            "home": (r.get("homepageUrl") or "").strip(),
            "pushed": r["pushedAt"][:10],
            "district": classify(r, overrides),
        })
    repos.sort(key=lambda r: (-r["stars"], r["name"]))
    out = {"user": USER, "districts": [{"id": d, "name": n} for d, n, _ in DISTRICTS], "repos": repos}
    (ROOT / "tools" / "repos.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    for d, n, _ in DISTRICTS:
        names = [r["name"] for r in repos if r["district"] == d]
        print(f"{n}（{len(names)}）：{'、'.join(names[:12])}{' …' if len(names) > 12 else ''}")


if __name__ == "__main__":
    main()
