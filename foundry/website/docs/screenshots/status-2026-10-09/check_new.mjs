// Drives /status/ (prod by default, or a local preview): screenshots + interaction asserts.
//   URL=http://127.0.0.1:8771/status/ node check_new.mjs <outdir>   (URL defaults to prod)
import { createRequire } from 'module';
const require = createRequire('/home/slackwing/src/manuscript-studio/');
const { chromium } = require('playwright-core');
const out = process.argv[2];
const URL = process.env.URL || 'https://andrewcheong.com/status/';
const browser = await chromium.launch({ executablePath: '/usr/sbin/google-chrome-stable', headless: true });
const errors = [];
const fail = m => { errors.push(m); console.log('FAIL', m); };
const ok = m => console.log('ok  ', m);

const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
page.on('pageerror', e => fail('pageerror: ' + e.message + '\n' + e.stack));
page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) fail('console: ' + m.text()); });
// /admin/api/me answers 401 when logged out — that's how the roles card knows to stay away
page.on('response', r => { if (r.status() >= 400 && !/favicon|\/admin\/api\/me$/.test(r.url())) fail(`HTTP ${r.status()} ${r.url()}`); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__status && window.__status.dates.length > 0 && !document.querySelector('.chart.pending'));
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
const drcLegend = await page.$eval('#drcLegend', el => el.textContent.trim());
ok('drc legend: ' + drcLegend);
if (!/DRC\d/.test(drcLegend)) fail('drc legend has no value');

// Study: chart, card, category lists
const studyLegend = await page.$eval('#studyLegend', el => el.textContent.trim());
ok('study legend: ' + studyLegend);
if (!/Actual\d/.test(studyLegend)) fail('study legend has no value');
const studyCard = await page.$eval('#studyValueLeft', el => el.textContent.trim());
if (!/^\d+$/.test(studyCard)) fail('study card has no value: ' + studyCard); else ok('study card: ' + studyCard + 'h');
const lists = await page.$$eval('.categories-list h3', hs => hs.map(h => h.textContent.trim()));
if (lists.join('|') !== 'Hobby Categories|Work Categories|Study Categories|Other Categories') fail('category lists: ' + lists.join('|')); else ok('four category lists');
if (await page.$('#latestOther')) fail('the Current Other card is still there'); else ok('Current Other card replaced by study');

// Sabbatical '27 card: first in main, a full grid with today marked
await page.waitForFunction(() => document.querySelector('.sabbatical-card .gos-cell.is-lit'), null, { timeout: 15000 }).catch(() => fail('sabbatical grid never filled'));
const sab = await page.evaluate(() => {
  const card = document.querySelector('main > section');
  const grid = document.querySelector('.sabbatical-grid');
  const cols = grid.querySelectorAll('.gos-col');
  return {
    first: card.classList.contains('sabbatical-card'),
    title: card.querySelector('h2').textContent,
    cols: cols.length,
    fits: Math.max(10, Math.floor((grid.clientWidth + 2) / 12)),
    today: grid.querySelectorAll('.gos-col.is-today').length,
    marker: !!grid.querySelector('.gos-today'),
    legend: [...grid.querySelectorAll('.gos-key')].map(k => k.textContent),
    tallest: Math.max(...[...cols].map(c => c.children.length)),
    bottoms: new Set([...cols].map(c => Math.round(c.getBoundingClientRect().bottom))).size,
    titles: [...cols].map(c => c.getAttribute('title')),
    litBeforeStart: [...cols].filter(c => c.dataset.date < '2026-10-22' && c.querySelector('.is-lit')).length,
    tallestLit: Math.max(...[...cols].map(c => c.querySelectorAll('.is-lit').length)),
  };
});
console.log('sabbatical', JSON.stringify(sab));
if (!sab.first || sab.title !== "Sabbatical '27") fail('sabbatical card is not first in main'); else ok("Sabbatical '27 card at the top");
if (sab.cols !== sab.fits) fail(`sabbatical columns ${sab.cols} ≠ fit ${sab.fits}`); else ok(`sabbatical grid fills the width: ${sab.cols} columns`);
if (sab.today !== 1 || !sab.marker) fail('sabbatical today column/marker missing'); else ok('today marked');
if (sab.legend.length) fail('sabbatical legend is showing: ' + sab.legend.join(', ')); else ok('no legend (the colors stay private)');
if (!sab.titles.every(t => /^[A-Z][a-z]{2} \d{1,2}$/.test(t || ''))) fail('tooltips say more than the date: ' + sab.titles.find(t => !/^[A-Z][a-z]{2} \d{1,2}$/.test(t || ''))); else ok('tooltips show only the date');
if (sab.tallest !== 20 || sab.bottoms !== 1) fail(`columns: tallest ${sab.tallest}, ${sab.bottoms} baselines`); else ok('20 tall, one shared baseline');
if (sab.litBeforeStart) fail(`${sab.litBeforeStart} columns before Oct 22 have squares`); else ok('nothing before the Oct 22 start');
// Logged out (this run has no session): the admin-only roles card stays away.
if (await page.$('.nr-card')) fail('the roles card shows without a login'); else ok('roles card hidden when logged out');
if (!(await page.$eval('footer', f => !!f.querySelector('a[href="/admin/"]')))) fail('no sign-in link in the footer'); else ok('footer offers sign in');

// Full-page screenshot at a tall viewport (charts autosize to width only)
const h = await page.evaluate(() => document.documentElement.scrollHeight);
await page.setViewportSize({ width: 1400, height: h });
await page.waitForTimeout(400);
await page.screenshot({ path: `${out}/new-desktop-full.png` });
const sections = await page.$$('main > section');
const names = ['sabbatical', 'stats', 'summary', 'hobbies', 'work', 'study', 'categories', 'alcohol-mood', 'drc', 'sleep'];
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
await m.waitForFunction(() => window.__status && window.__status.dates.length > 0 && !document.querySelector('.chart.pending'));
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
