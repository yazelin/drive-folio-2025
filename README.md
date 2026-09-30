# drive-folio-2025

開一台車在 3D 島上逛 Yaze Lin 的作品。

**線上玩：** <https://yazelin.github.io/drive-folio-2025/>（電腦玩比較順：方向鍵或 WASD 開車、空白鍵跳、Enter 互動、R 回重生點）

2019 版在 [drive-folio](https://yazelin.github.io/drive-folio/)，主島上的時光機也會帶你過去。

## 出處

改自 [Bruno Simon 的 folio-2025](https://github.com/brunosimon/folio-2025)（MIT），他的作品集本人在 <https://bruno-simon.com>。整座島、車子、物理、天氣、音樂都是原作的，這個 repo 換的是內容，另外在北邊海上加了一座「Yaze 島」。

主島上改的地方：

- 開場的立體字：BRUNO SIMON 換成 YAZE LIN（沿用原本每個字母的碰撞盒，一樣撞得飛）
- 作品區（Projects）：九個作品，截圖由 `tools/shots.mjs` 產生
- 實驗室（Lab）：十三個小工具
- 職涯區（Career）：石條上的字換成我的經歷（`tools/make_career.py` 產生）。我只寫確定的事，沒有逐年的年份，所以把原作的年份計數器藏起來
- 社群區（Social）：原作一圈是他的社群標誌（X、Bluesky、YouTube…），對不上的藏起來；GitHub 對到原本的 GitHub 標誌，Facebook、部落格、Buy Me a Coffee 做成立牌站在空石座上
- 時光機：連到 2019 版
- 選單首頁與「幕後」頁改成中文介紹；選單預覽圖、分享圖換成 YAZE LIN 的開場畫面
- 地上與看板的字加了中文字型備援

Yaze 島（開場 YAZE 左邊的紫色傳送台按 Enter，或打開地圖點上緣的「Yaze 島」）：

- **repo 城市**：179 個公開 repo 一個一棟樓，4 棟一個街區，分成六區（公司與工業、角色宇宙、遊戲與 3D、教學與範本、Agent 與開發工具、網頁小工具），每區一個顏色，區名寫在該區開頭的路上，島的地圖上也看得出分區。有馬路、斑馬線、路燈、遮雨棚，屋頂有招牌；樓越高星越多，樓頂有綠色燈圈的有 GitHub Pages。車開到樓後面時，擋住車的樓會挖一個洞。每棟樓前的路邊有一個白色菱形，開過去按 Enter：有網頁的開網頁，沒有的開 repo 頁（`tools/fetch_repos.py` 產資料）。城市的做法搬自 2026-09-29 從零實測時另一個 agent 做的版本
- **角色廣場**：格莉奇、黑洞先生、Mori、優理的立牌，介紹照角色頁的副標
- **catime 貓圖牆**：最新 12 隻 AI 貓（`tools/fetch_cats.py` 抓的快照）
- **島的地圖**：人在島上時按 M 或右上角的地圖，會換成島的平面圖，點各區的標記就能傳送過去
- **週三直播路**：每場直播一根撞得倒的柱子，按 Enter 打開活動頁（`tools/lives.json`）

拿掉的：原作要連他自己伺服器的功能（訪客留言 whispers、賽道排行榜、線上人數），選單裡那兩頁也藏起來了；社群區的 OnlyFans 諧音梗互動點也拿掉了。沒有伺服器網址的時候原作的程式本來就不會去連，所以程式碼沒刪。

原作的授權聲明保留在 [license.md](license.md)。原作的 Blender 原檔在他的 repo 的 `resources/`，這裡沒有放。

## 怎麼做出來的

這是 2026-09-30 週三直播的示範。做法很簡單：

1. 先讓 AI 去找你想像中的效果，看有沒有人做過、放在 GitHub Pages 上，收集起來（我的收集在[網頁特效蒐集站](https://yazelin.github.io/web-effects-collector/)）
2. 跟 AI 說你想參考哪一個，哪些地方要改
3. 給它你要放上去的資料

這個 repo 的程式修改都是叫 AI（Claude）做的，要放什麼、哪裡不對是我看了再講。

## 換成你自己的

```
npm install --force
cp .env.example .env
# 作品與實驗室：改 tools/projects.json、tools/lab.json；node tools/shots.mjs <資料夾> 截圖，
#   轉成 960x540 的 webp 放進 static/projects/images/、static/lab/images/，
#   再跑 python3 tools/make_data.py 產生 sources/data/projects.js、lab.js
# 社群連結：sources/data/social.js
# 職涯：改 tools/make_career.py 裡的文字，再跑 python3 tools/make_career.py
# 開場的名字：sources/Game/World/Areas/LandingArea.js 的 letters
# Yaze 島：sources/Game/World/YazeIsland.js（repo 城市在 YazeCity.js）；資料在 tools/（repos.json、cats.json、lives.json）
npm run dev
```

推上 GitHub、Settings → Pages 的來源選 GitHub Actions，就會自動部署。

## 已知問題

- 網站約 53 MB，第一次開要等一下
- 支援 WebGPU 的瀏覽器用 WebGPU，其他退回 WebGL
- 選單、成就、按鍵說明還是原作的英文

## 授權

MIT（沿用原作）。
