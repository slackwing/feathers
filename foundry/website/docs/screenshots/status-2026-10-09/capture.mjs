import { createRequire } from 'module';
const require = createRequire('/home/slackwing/src/manuscript-studio/');
const { chromium } = require('playwright-core');
const out = process.argv[2];
const browser = await chromium.launch({ executablePath: '/usr/sbin/google-chrome-stable', headless: true });
for (const [name, width, dpr] of [['desktop', 1400, 2], ['mobile', 390, 3]]) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: dpr });
  await page.goto('https://andrewcheong.com/status/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !document.querySelector('.container.loading') && document.getElementById('hobbyValueLeft').textContent !== '--');
  await page.waitForTimeout(1500);
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.setViewportSize({ width, height: h });
  await page.waitForTimeout(1500); // let Chart.js re-render after resize
  await page.screenshot({ path: `${out}/${name}-full.png` });
  await page.close();
}
await browser.close();
