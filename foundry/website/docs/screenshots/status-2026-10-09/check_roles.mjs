// Drives the Netflix roles card with /admin/api/me and /status/api/jobs*
// intercepted (an admin + a realistic catalog). node check_roles.mjs <url> <outdir>
import { createRequire } from 'module';
const require = createRequire('/home/slackwing/src/manuscript-studio/');
const { chromium } = require('playwright-core');
const [URL, out] = [process.argv[2], process.argv[3]];
let failed = 0;
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) failed++; };

const today = new Date();
const d = (n) => { const t = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - n * 86400000); return t.toISOString(); };
const P = (source, url, location, posted, gone, title) => ({ source, title, url, location, posted_at: posted, gone_at: gone || null, salary_min: null, salary_max: null });
const R = (id, title, posted, extra) => {
  const role = Object.assign({ role_id: id, title, favorite: false, hidden: false, posted_at: posted, gone_at: null, salary_min: 388000, salary_max: 558000, locations: ['Remote, United States'], postings: null }, extra);
  role.postings = (role.postings || [P('netflix', 'https://explore.jobs.netflix.net/careers/job/1', 'Remote, United States', posted)]).map((p) => ({ ...p, title: p.title || title }));
  return role;
};
const roles = [
  R('11111111-1111-5111-8111-111111111111', 'Software Engineer 5 - iOS', d(0), { locations: ['Remote, United States', 'United States'], postings: [P('netflix', 'https://explore.jobs.netflix.net/careers/job/790318041034', 'Remote, United States', d(10)), P('linkedin', 'https://www.linkedin.com/jobs/view/4454674339', 'United States', d(0), null, 'Software Engineer 4/5 – iOS')] }),
  R('22222222-2222-5222-8222-222222222222', 'Software Engineer (L6) - Compute Runtime', d(1), { salary_min: 499000, salary_max: 900000 }),
  R('55555555-5555-5555-8555-555555555555', 'Software Engineer 5 - TV Product UI', d(9), { gone_at: d(2), salary_min: 320000, salary_max: 500000 }),
  R('44444444-4444-5444-8444-444444444444', 'Software Engineering 5 - Ads Agent (Agentic Platform for Enterprise)', d(18), { salary_min: null, salary_max: null, locations: ['New York, NY'], postings: [P('linkedin', 'https://www.linkedin.com/jobs/view/4468375380', 'New York, NY', d(18))] }),
];
// fillers so the default view runs to a second page
for (let i = 0; i < 12; i++) roles.push(R(`aaaaaaaa-aaaa-5aaa-8aaa-${String(i).padStart(12, '0')}`, `Software Engineer 5 - Team ${i + 1}`, d(30 + i)));
roles.push(
  R('33333333-3333-5333-8333-333333333333', 'Software Engineer 5 – Model Development and Management, AI Platform', d(63), { favorite: true, salary_min: 466000, salary_max: 750000 }),
  R('88888888-8888-5888-8888-888888888888', 'Staff Software Engineer (L6) / TLM - Developer Productivity', d(87), { salary_min: 600000, salary_max: 1066000 }),
  R('66666666-6666-5666-8666-666666666666', 'Software Engineer 5 - Android', d(100), { gone_at: d(10) }),
  R('77777777-7777-5777-8777-777777777777', 'Security Software Engineer 5', d(130), { hidden: true, salary_min: null, salary_max: null, locations: ['Poland - Remote'] }),
);
const checks = [
  { source: 'netflix', checked_at: new Date(Date.now() - 5 * 60000).toISOString(), ok: true, error: '' },
  { source: 'linkedin', checked_at: new Date(Date.now() - 5 * 60000).toISOString(), ok: false, error: 'status 429 from https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search' },
];
// The iOS role in full: each source's details and description (one with
// things the page must never run or insert).
const iosFull = {
  ...roles[0],
  postings: [
    { ...roles[0].postings[0], description: '<p>At Netflix, our mission is to entertain the world.</p><p>&nbsp;</p><p>The range for this role is $388,000.00 - $558,000.00.<script>window.__pwned = 1</script></p><img src="x" onerror="window.__pwned = 2"><ul><li><b>Swift</b></li></ul><a href="javascript:window.__pwned = 3">bad</a> <a href="https://jobs.netflix.com/culture" onclick="window.__pwned = 4">culture</a>',
      meta: [{ label: 'Job Requisition ID', value: 'JR42272' }, { label: 'Work Type', value: 'Remote' }, { label: 'Locations', value: 'Remote, United States' }] },
    { ...roles[0].postings[1], description: 'At Netflix, our mission is to entertain the world.<br><br>LinkedIn wording.',
      meta: [{ label: 'Location', value: 'United States' }, { label: 'Employment type', value: 'Full-time' }, { label: 'Work Type', value: 'Remote' }] },
  ],
};

const browser = await chromium.launch({ executablePath: '/usr/sbin/google-chrome-stable', headless: true });

// Logged out: no card, a sign-in link.
{
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.route('**/admin/api/me', (r) => r.fulfill({ status: 401, body: 'Unauthorized' }));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  ok(!(await page.$('.nr-card')), 'logged out: no roles card');
  ok(await page.$eval('footer', (f) => f.textContent.includes('sign in') && !!f.querySelector('a[href="/admin/"]')), 'logged out: footer offers sign in');
  ok(!(await page.evaluate(() => document.documentElement.outerHTML.includes('Software Engineer 5 - iOS'))), 'logged out: no role data in the page');
  await page.close();
}
// Signed in, not an admin: no card.
{
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.route('**/admin/api/me', (r) => r.fulfill({ json: { username: 'abi', roles: [{ website: 'hxh', role: 'guest' }] } }));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  ok(!(await page.$('.nr-card')), 'non-admin: no roles card');
  await page.close();
}

async function asAdmin(page, log) {
  await page.route('**/admin/api/me', (r) => r.fulfill({ json: { username: 'andrew', roles: [{ website: 'admin', role: 'admin' }] } }));
  await page.route('**/status/api/jobs', (r) => r.fulfill({ json: { roles, checks } }));
  await page.route('**/status/api/jobs/roles/*', (r) => {
    const req = r.request();
    log.push({ url: req.url(), method: req.method(), body: req.method() === 'PATCH' ? req.postDataJSON() : null });
    if (req.method() === 'GET') r.fulfill({ json: req.url().endsWith(roles[0].role_id) ? iosFull : { ...roles[1], postings: roles[1].postings.map((p) => ({ ...p, description: '', meta: [] })) } });
    else r.fulfill({ status: 204 });
  });
}

// Admin, desktop: 5 columns × 2 rows a page.
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
const calls = [];
await asAdmin(page, calls);
page.on('pageerror', (e) => { console.log('pageerror', e.message); failed++; });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('.nr-role');

const order = await page.evaluate(() => [...document.querySelectorAll('main > section')].map((s) => s.className));
ok(order[0].includes('sabbatical-card') && order[1].includes('nr-card'), 'roles card sits right under the Sabbatical card');
const tiles = async () => page.$$eval('.nr-role', (rs) => rs.map((r) => ({
  title: r.querySelector('.nr-title').textContent, full: r.querySelector('.nr-title').title, age: r.querySelector('.nr-age').textContent,
  pay: r.querySelector('.nr-pay').textContent, where: (r.querySelector('.nr-where') || {}).textContent || '',
  marks: [...r.querySelectorAll('.nr-mark')].map((m) => m.textContent), cls: r.className })));
const pager = async () => page.$eval('.nr-pager', (p) => ({ shown: !p.hidden, text: p.querySelector('.nr-page').textContent, prev: !p.querySelector('.nr-prev').disabled, next: !p.querySelector('.nr-next').disabled }));
const everyPage = async () => {
  const all = [];
  while ((await pager()).prev) await page.click('.nr-prev');
  for (;;) {
    all.push(...await tiles());
    if (!(await pager()).next) break;
    await page.click('.nr-next');
  }
  while ((await pager()).prev) await page.click('.nr-prev');
  return all;
};

let ts = await tiles();
let pg = await pager();
ok(ts.length === 10 && pg.shown && pg.text === '1/2' && !pg.prev && pg.next, `page 1: 10 tiles (5 × 2), pager 1/2 — got ${ts.length} tiles, ${JSON.stringify(pg)}`);
const by = (t) => ts.find((r) => r.title.startsWith(t));
ok(by('SE5 - iOS') && by('SE5 - iOS').cls.includes('is-new') && by('SE5 - iOS').age === 'today' && by('SE5 - iOS').marks.join() === 'N,in' && by('SE5 - iOS').pay === '$388–558K' && by('SE5 - iOS').where === '', 'iOS: today (its latest posting), highlighted, both source marks, salary, plain US left out');
ok(by('SE6 - Compute Runtime') && by('SE6 - Compute Runtime').age === '1d' && by('SE6 - Compute Runtime').cls.includes('is-new'), '(L6) → SE6; yesterday highlighted');
ok(by('SE5 - TV Product UI') && by('SE5 - TV Product UI').cls.includes('is-gone') && by('SE5 - TV Product UI').age === 'gone 2d', 'gone 2 days ago: red, "gone 2d"');
ok(by('SE5 - Ads Agent') && by('SE5 - Ads Agent').where === 'New York, NY' && by('SE5 - Ads Agent').marks.join() === 'in' && by('SE5 - Ads Agent').pay === '', 'LinkedIn-only New York role: location, "in" mark, no salary');
await page.screenshot({ path: `${out}/roles-default.png`, clip: await (await page.$('.nr-card')).boundingBox() });

await page.click('.nr-next');
ts = await tiles();
pg = await pager();
ok(ts.length === 8 && pg.text === '2/2' && pg.prev && !pg.next, `page 2: the other 8, pager 2/2 — got ${ts.length}, ${JSON.stringify(pg)}`);
ok(by('Staff SE6 / TLM') && by('Staff SE6 / TLM').pay === '$600K–1.07M', 'staff role: "$600K–1.07M"');
ok(by('SE5 – Model Development') && by('SE5 – Model Development').cls.includes('is-favorite'), 'favorite marked');
await page.screenshot({ path: `${out}/roles-page2.png`, clip: await (await page.$('.nr-card')).boundingBox() });
await page.click('.nr-prev');

let every = await everyPage();
ok(!every.some((r) => r.title.startsWith('SE5 - Android') || r.title.startsWith('Security SE5')), 'gone > a week and hidden roles are not in the default view');
ok(every.map((r) => r.full).join('|') === roles.filter((x) => !x.hidden && (!x.gone_at || x.role_id.startsWith('5'))).map((x) => x.title).join('|'), 'order kept across pages (newest first, from the API)');
const status = await page.$eval('.nr-status', (s) => ({ cls: s.className, title: s.title, text: s.textContent }));
ok(status.cls.includes('is-failing') && status.title.includes('Netflix: ok') && status.title.includes('LinkedIn: status 429') && status.text === '5m ago', 'status: last checked 5m ago, failing LinkedIn flagged in the tooltip');

// All: hidden and past roles too, from page 1.
await page.click('.nr-next');
await page.click('.nr-all');
ok((await pager()).text === '1/2', 'all: back to page 1');
every = await everyPage();
ok(every.length === roles.length && every.some((r) => r.title.startsWith('Security SE5') && r.cls.includes('is-hidden')) && every.some((r) => r.title.startsWith('SE5 - Android') && r.cls.includes('is-gone')), `all: every role (${every.length}/${roles.length}), hidden ones faded, old gone ones red`);
await page.click('.nr-all');

// Favorite + hide from a tile (not opening it).
await page.click('.nr-role:has(.nr-title[title="Software Engineer 5 - iOS"]) .nr-star');
await page.hover('.nr-role:has-text("SE5 - Ads Agent")');
await page.click('.nr-role:has-text("SE5 - Ads Agent") .nr-hide');
await page.waitForTimeout(200);
const patches = calls.filter((c) => c.method === 'PATCH');
ok(patches.length === 2 && patches[0].url.endsWith(`/status/api/jobs/roles/${roles[0].role_id}`) && patches[0].body.favorite === true && patches[1].body.hidden === true, 'star and × send PATCH {favorite} / {hidden} for the role');
ok(!(await page.$eval('.nr-dialog', (dlg) => dlg.open)), 'star and × do not open the role');
ts = await tiles();
ok(by('SE5 - iOS').cls.includes('is-favorite') && !by('SE5 - Ads Agent'), 'the favorite shows, the hidden role leaves the default view');

// The dialog: the role in full.
await page.click('.nr-role:has(.nr-title[title="Software Engineer 5 - iOS"])');
await page.waitForSelector('.nr-dialog[open] .nr-desc');
const dlg = await page.$eval('.nr-dialog', (dl) => ({
  title: dl.querySelector('.nr-dialog-title').textContent,
  facts: [...dl.querySelectorAll('.nr-facts span')].map((s) => s.textContent),
  postings: [...dl.querySelectorAll('.nr-postings .nr-mark')].map((a) => ({ text: a.textContent, href: a.href })),
  rows: [...dl.querySelectorAll('.nr-details dt')].map((dt) => ({ label: dt.textContent, lines: [...dt.nextElementSibling.querySelectorAll('.nr-detail')].map((l) => l.textContent) })),
  descs: [...dl.querySelectorAll('.nr-desc')].map((s) => ({ head: (s.querySelector('.nr-desc-source') || {}).textContent || '', html: s.innerHTML })),
  fav: dl.classList.contains('is-favorite'),
}));
console.log(JSON.stringify(dlg.rows));
const row = (l) => dlg.rows.find((r) => r.label === l);
ok(dlg.title === 'Software Engineer 5 - iOS' && dlg.fav && dlg.facts.join('|') === '$388–558K|today', `dialog head: full title, favorite, pay + age — ${dlg.facts.join('|')}`);
ok(dlg.postings.length === 2 && /^N[A-Z][a-z]{2} \d+$/.test(dlg.postings[0].text) && dlg.postings[1].text.startsWith('in') && dlg.postings[1].href.includes('linkedin.com'), 'each source: mark + posted date, linking to its posting');
ok(row('Title') && row('Title').lines.join('|') === 'NSoftware Engineer 5 - iOS|inSoftware Engineer 4/5 – iOS', 'titles worded differently: each source\'s');
ok(row('Location') && row('Location').lines.join('|') === 'NRemote, United States|inUnited States', 'Locations/Location differ: one row, each source marked');
ok(row('Work Type') && row('Work Type').lines.join('|') === 'Remote', 'sources agree: one value, no marks');
ok(row('Job Requisition ID') && row('Employment type'), 'details from both sources (union)');
ok(dlg.descs.length === 2 && dlg.descs[0].head === 'Netflix' && dlg.descs[1].head === 'LinkedIn', 'different descriptions: both, each headed by its source');
const d0 = dlg.descs[0].html;
ok(!/script|onerror|onclick|<img|javascript:|pwned/i.test(d0) && d0.includes('<b>Swift</b>') && d0.includes('href="https://jobs.netflix.com/culture"') && d0.includes('target="_blank"'), 'description sanitized: structure + https links kept; scripts, images, handlers, javascript: links gone');
ok(!/<p>\s*(&nbsp;| )?\s*<\/p>/.test(d0), 'spacer paragraphs dropped');
ok(await page.evaluate(() => window.__pwned === undefined), 'nothing in a description ran');
await page.screenshot({ path: `${out}/roles-dialog.png` });

await page.keyboard.press('Escape');
ok(!(await page.$eval('.nr-dialog', (dl) => dl.open)), 'Esc closes the dialog');
await page.click('.nr-role:has(.nr-title[title="Software Engineer 5 - iOS"])');
await page.waitForSelector('.nr-dialog[open] .nr-desc');
ok(calls.filter((c) => c.method === 'GET').length === 1, 'reopening uses the loaded role (one GET)');
await page.mouse.click(10, 10); // the backdrop
ok(!(await page.$eval('.nr-dialog', (dl) => dl.open)), 'a backdrop click closes the dialog');

// A role with nothing read yet: details empty, still opens and closes.
await page.click('.nr-role:has(.nr-title[title="Software Engineer (L6) - Compute Runtime"])');
await page.waitForSelector('.nr-dialog[open] .nr-empty');
await page.click('.nr-dialog .nr-text-btn');
await page.waitForTimeout(150);
ok(calls.filter((c) => c.method === 'PATCH').pop().body.hidden === true && (await page.$eval('.nr-dialog .nr-text-btn', (b) => b.textContent)) === 'Unhide', 'Hide in the dialog hides the role; the button turns to Unhide');
await page.click('.nr-dialog .nr-close');
ok(!(await page.$eval('.nr-dialog', (dl) => dl.open)), '✕ closes the dialog');

// Mobile: 2 columns × 3 rows, full-screen dialog.
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await asAdmin(m, []);
await m.goto(URL, { waitUntil: 'networkidle' });
await m.waitForSelector('.nr-role');
ok(!(await m.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)), 'mobile: no horizontal overflow');
ok((await m.$$('.nr-role')).length === 6 && (await m.$eval('.nr-page', (p) => p.textContent)) === '1/3', 'mobile: 6 tiles a page (2 × 3), 18 roles → 3 pages');
await m.screenshot({ path: `${out}/roles-mobile.png`, clip: await (await m.$('.nr-card')).boundingBox() });
await m.tap('.nr-role:has(.nr-title[title="Software Engineer 5 - iOS"])');
await m.waitForSelector('.nr-dialog[open] .nr-desc');
const box = await (await m.$('.nr-dialog')).boundingBox();
ok(Math.round(box.width) === 390 && Math.round(box.height) === 844, `mobile: the dialog fills the screen (${box.width}×${box.height})`);
await m.screenshot({ path: `${out}/roles-mobile-dialog.png` });

await browser.close();
console.log(failed ? `\n${failed} FAILURE(S)` : '\nALL OK');
process.exit(failed ? 1 : 0);
