// Drives /status/new/ on the local preview server: screenshots + interaction asserts.
//   URL=http://127.0.0.1:8771/status/new/ node check_new.mjs <outdir>   (URL defaults to prod)
import { createRequire } from 'module';
const require = createRequire('/home/slackwing/src/manuscript-studio/');
const { chromium } = require('playwright-core');
const out = process.argv[2];
const URL = process.env.URL || 'https://andrewcheong.com/status/new/';
const browser = await chromium.launch({ executablePath: '/usr/sbin/google-chrome-stable', headless: true });
const errors = [];
const fail = m => { errors.push(m); console.log('FAIL', m); };
const ok = m => console.log('ok  ', m);

const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
page.on('pageerror', e => fail('pageerror: ' + e.message + '\n' + e.stack));
page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) fail('console: ' + m.text()); });
page.on('response', r => { if (r.status() >= 400 && !/favicon/.test(r.url())) fail(`HTTP ${r.status()} ${r.url()}`); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__status && window.__status.dates.length > 0 && !document.querySelector('.container.loading'));
await page.waitForTimeout(500);

const ranges = () => page.evaluate(() => window.__status.charts.map(c => { const r = c.timeScale().getVisibleLogicalRange(); return [r.from, r.to]; }));
const n = await page.evaluate(() => window.__status.dates.length);
ok(`loaded ${n} days: ${await page.evaluate(() => window.__status.dates[0] + ' → ' + window.__status.dates.at(-1))}`);

// Initial range: last 30 days on every chart
let rs = await ranges();
console.log('initial ranges', JSON.stringify(rs.map(r => r.map(x => +x.toFixed(2)))));
if (!rs.every(r => Math.abs((r[1] - r[0]) - 30) < 0.75 && Math.abs(r[1] - (n - 0.5)) < 0.75)) fail('initial range is not the last 30 days on all charts');
else ok('initial range = last 30 days, all charts');
if ((await page.$eval('#range button.active', b => b.textContent)) !== '1M') fail('1M button not active'); else ok('1M active');

// Legend readout shows latest values
const legend = await page.$eval('#hobbyLegend', el => el.textContent.trim());
ok('hobby legend: ' + legend);
if (!/\dh/.test(legend)) fail('hobby legend has no hours value');

// Full-page screenshot at a tall viewport (charts autosize to width only)
const h = await page.evaluate(() => document.documentElement.scrollHeight);
await page.setViewportSize({ width: 1400, height: h });
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/new-desktop-full.png` });
const sections = await page.$$('main > section');
const names = ['stats', 'summary', 'hobbies', 'work', 'categories', 'alcohol-mood', 'sleep'];
for (let i = 0; i < sections.length; i++) await sections[i].screenshot({ path: `${out}/new-${String(i + 1).padStart(2, '0')}-${names[i]}.png` });
await page.setViewportSize({ width: 1400, height: 900 });

// Hover: crosshair + legend readout follow the pointer on every chart
const hobbyEl = await page.$('#hobbyChart'); await hobbyEl.scrollIntoViewIfNeeded(); await page.waitForTimeout(100);
const hobbyBox = await hobbyEl.boundingBox();
await page.mouse.move(hobbyBox.x + hobbyBox.width * 0.5, hobbyBox.y + hobbyBox.height * 0.5);
await page.waitForTimeout(200);
const hoverDates = await page.$$eval('.legend-date', els => els.map(e => e.textContent));
console.log('hover dates', hoverDates);
if (new Set(hoverDates).size !== 1) fail('legend dates differ across charts while hovering');
else ok('all legends show the hovered date ' + hoverDates[0]);
await page.screenshot({ path: `${out}/new-hover.png`, clip: { x: 0, y: Math.max(0, hobbyBox.y - 120), width: 1400, height: hobbyBox.height + 160 } });
await page.mouse.move(5, 5);
await page.waitForTimeout(200);
const restDates = await page.$$eval('.legend-date', els => els.map(e => e.textContent));
if (restDates[0] === hoverDates[0]) fail('legend did not return to the latest date after mouse leave'); else ok('legend back to latest: ' + restDates[0]);

// Wheel zoom on one chart zooms all
await page.mouse.move(hobbyBox.x + hobbyBox.width * 0.5, hobbyBox.y + hobbyBox.height * 0.5);
await page.mouse.wheel(0, -400);
await page.waitForTimeout(300);
rs = await ranges();
const spans = rs.map(r => +(r[1] - r[0]).toFixed(2));
console.log('spans after wheel-in', spans);
if (spans[0] >= 30) fail('wheel did not zoom in'); else ok('wheel zoomed in to ' + spans[0] + ' days');
if (new Set(spans).size !== 1) fail('charts not in sync after wheel'); else ok('all charts in sync after wheel');
if (await page.$('#range button.active')) fail('a range button stayed active after a manual zoom'); else ok('range buttons cleared after manual zoom');
await page.mouse.wheel(0, 1200);
await page.waitForTimeout(300);
rs = await ranges();
console.log('spans after wheel-out', rs.map(r => +(r[1] - r[0]).toFixed(2)));
if (rs[0][1] - rs[0][0] <= 30) fail('wheel did not zoom out past 30 days'); else ok('wheel zoomed out to ' + (rs[0][1] - rs[0][0]).toFixed(1) + ' days');

// Drag pan on the Work chart moves every chart
const workEl = await page.$('#workChart'); await workEl.scrollIntoViewIfNeeded(); await page.waitForTimeout(100);
const workBox = await workEl.boundingBox();
const before = (await ranges())[0];
await page.mouse.move(workBox.x + workBox.width * 0.6, workBox.y + workBox.height * 0.5);
await page.mouse.down();
await page.mouse.move(workBox.x + workBox.width * 0.8, workBox.y + workBox.height * 0.5, { steps: 10 });
await page.mouse.up();
await page.waitForTimeout(300);
rs = await ranges();
console.log('after drag', JSON.stringify(rs.map(r => r.map(x => +x.toFixed(2)))));
if (rs[0][0] >= before[0]) fail('drag did not pan left'); else ok('drag panned left by ' + (before[0] - rs[0][0]).toFixed(1) + ' days');
if (new Set(rs.map(r => r[0].toFixed(2))).size !== 1) fail('charts not in sync after drag'); else ok('all charts in sync after drag');
await page.screenshot({ path: `${out}/new-zoomed-panned.png`, fullPage: false });

// All button
await page.click('#range button[data-days="0"]');
await page.waitForTimeout(300);
rs = await ranges();
if (Math.abs((rs[0][1] - rs[0][0]) - (n - 1)) > 0.75) fail('All did not show the full history: ' + JSON.stringify(rs[0])); else ok('All = full history');
if ((await page.$eval('#range button.active', b => b.textContent)) !== 'All') fail('All button not active'); else ok('All active');
const h2 = await page.evaluate(() => document.documentElement.scrollHeight);
await page.setViewportSize({ width: 1400, height: h2 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/new-desktop-all.png` });
await page.setViewportSize({ width: 1400, height: 900 });
await page.click('#range button[data-days="90"]');
await page.waitForTimeout(300);
rs = await ranges();
if (Math.abs((rs[0][1] - rs[0][0]) - 90) > 0.75) fail('3M did not show 90 days'); else ok('3M = 90 days');

// Mobile
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
m.on('pageerror', e => fail('mobile pageerror: ' + e.message));
await m.goto(URL, { waitUntil: 'networkidle' });
await m.waitForFunction(() => window.__status && window.__status.dates.length > 0 && !document.querySelector('.container.loading'));
await m.waitForTimeout(500);
const mh = await m.evaluate(() => document.documentElement.scrollHeight);
await m.setViewportSize({ width: 390, height: mh });
await m.waitForTimeout(400);
await m.screenshot({ path: `${out}/new-mobile-full.png` });
const overflow = await m.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
if (overflow) fail('mobile page scrolls horizontally'); else ok('mobile: no horizontal overflow');

await browser.close();
console.log(errors.length ? `\n${errors.length} FAILURE(S)` : '\nALL OK');
process.exit(errors.length ? 1 : 0);
