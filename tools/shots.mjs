// 每個作品截三張 16:9：桌機首屏、往下一頁、手機版（放在深色底中間）。存 png 給 make_projects.py
import { chromium } from '/home/ct/.nvm/versions/node/v22.17.1/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const list = JSON.parse(fs.readFileSync(new URL('./projects.json', import.meta.url)));
const out = process.argv[2]; fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--ignore-gpu-blocklist'] });
for (const p of list) {
  const d = await b.newPage({ viewport: { width: 1280, height: 720 } });
  try { await d.goto(p.url, { waitUntil: 'networkidle', timeout: 45000 }); } catch (e) {}
  if (p.url.includes('ai-brain-site')) { try { await d.waitForSelector('#boot.hide', { state: 'attached', timeout: 60000 }); } catch (e) {} }
  await d.waitForTimeout(4000);
  await d.screenshot({ path: out + '/' + p.id + '-1.png' });
  if (p.url.includes('ai-brain-site')) { await d.locator('[data-app="diary"]:visible').first().click(); await d.waitForTimeout(2500); }
  else { await d.evaluate(() => window.scrollTo(0, 720)); await d.waitForTimeout(1500); }
  await d.screenshot({ path: out + '/' + p.id + '-2.png' });
  await d.close();
  const m = await b.newPage({ viewport: { width: 390, height: 780 }, isMobile: true, deviceScaleFactor: 2 });
  try { await m.goto(p.url, { waitUntil: 'networkidle', timeout: 45000 }); } catch (e) {}
  if (p.url.includes('ai-brain-site')) { try { await m.waitForSelector('#boot.hide', { state: 'attached', timeout: 60000 }); } catch (e) {} }
  await m.waitForTimeout(4000); await m.screenshot({ path: out + '/' + p.id + '-3.png' }); await m.close();
  console.log('ok', p.id);
}
await b.close();
