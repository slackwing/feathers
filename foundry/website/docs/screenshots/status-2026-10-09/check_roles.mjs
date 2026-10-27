// Drives the Netflix roles card with /admin/api/me and /status/api/jobs
// intercepted (an admin + a realistic catalog) — no real login needed.
//   node check_roles.mjs <status url> <outdir>
import { createRequire } from 'module';
const require = createRequire('/home/slackwing/src/manuscript-studio/');
const { chromium } = require('playwright-core');
const [URL, out] = [process.argv[2], process.argv[3]];
let failed = 0;
const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) failed++; };

const today = new Date();
const d = (n) => { const t = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - n * 86400000); return t.toISOString(); };
const P = (source, url, location, posted, gone) => ({ source, url, location, posted_at: posted, gone_at: gone || null });
const R = (id, title, posted, extra) => Object.assign({ role_id: id, title, favorite: false, hidden: false, posted_at: posted, gone_at: null, salary_min: 388000, salary_max: 558000, locations: ['Remote, United States'], postings: [P('careers', 'https://explore.jobs.netflix.net/careers/job/1', 'Remote, United States', posted)] }, extra);
const roles = [
  R('11111111-1111-5111-8111-111111111111', 'Software Engineer 5 - iOS', d(0), { postings: [P('careers', 'https://explore.jobs.netflix.net/careers/job/790318041034', 'Remote, United States', d(0)), P('linkedin', 'https://www.linkedin.com/jobs/view/4454674339', 'United States', d(0))] }),
  R('22222222-2222-5222-8222-222222222222', 'Software Engineer (L6) - Compute Runtime', d(1), { salary_min: 499000, salary_max: 900000 }),
  R('55555555-5555-5555-8555-555555555555', 'Software Engineer 5 - TV Product UI', d(9), { gone_at: d(2), salary_min: 320000, salary_max: 500000 }),
  R('44444444-4444-5444-8444-444444444444', 'Software Engineering 5 - Ads Agent (Agentic Platform for Enterprise)', d(18), { locations: ['New York, NY'], postings: [P('linkedin', 'https://www.linkedin.com/jobs/view/4468375380', 'New York, NY', d(18))] }),
  R('33333333-3333-5333-8333-333333333333', 'Software Engineer 5 – Model Development and Management, AI Platform', d(63), { favorite: true, salary_min: 466000, salary_max: 750000 }),
  R('88888888-8888-5888-8888-888888888888', 'Staff Software Engineer (L6) / TLM - Developer Productivity', d(87), { salary_min: 600000, salary_max: 1066000 }),
  R('66666666-6666-5666-8666-666666666666', 'Software Engineer 5 - Android', d(100), { gone_at: d(10) }),
  R('77777777-7777-5777-8777-777777777777', 'Security Software Engineer 5', d(130), { hidden: true, salary_min: null, salary_max: null, locations: ['Poland - Remote'] }),
];
const checks = [
  { source: 'careers', checked_at: new Date(Date.now() - 5 * 60000).toISOString(), ok: true, error: '' },
  { source: 'linkedin', checked_at: new Date(Date.now() - 5 * 60000).toISOString(), ok: false, error: 'status 429 from https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search' },
];

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

// Admin.
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
const patches = [];
await page.route('**/admin/api/me', (r) => r.fulfill({ json: { username: 'andrew', roles: [{ website: 'admin', role: 'admin' }] } }));
await page.route('**/status/api/jobs', (r) => r.fulfill({ json: { roles, checks } }));
await page.route('**/status/api/jobs/roles/*', (r) => { patches.push({ url: r.request().url(), method: r.request().method(), body: r.request().postDataJSON() }); r.fulfill({ status: 204 }); });
page.on('pageerror', (e) => { console.log('pageerror', e.message); failed++; });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('.nr-role');

const order = await page.evaluate(() => [...document.querySelectorAll('main > section')].map((s) => s.className));
ok(order[0].includes('sabbatical-card') && order[1].includes('nr-card'), 'roles card sits right under the Sabbatical card');
const rows = async () => page.$$eval('.nr-role', (rs) => rs.map((r) => ({
  title: r.querySelector('.nr-title').textContent, age: r.querySelector('.nr-age').textContent, pay: r.querySelector('.nr-pay').textContent,
  where: r.querySelector('.nr-where').textContent, marks: [...r.querySelectorAll('.nr-mark')].map((m) => m.textContent), cls: r.className })));
let rs = await rows();
console.log(rs.map((r) => `${r.title} | ${r.age} | ${r.pay} | ${r.where} | ${r.marks.join(',')} | ${r.cls}`).join('\n'));
ok(rs.length === 6, `default view: 6 roles (live + gone within a week, not hidden) — got ${rs.length}`);
const by = (t) => rs.find((r) => r.title.startsWith(t));
ok(by('SE5 - iOS') && by('SE5 - iOS').cls.includes('is-new') && by('SE5 - iOS').age === 'today' && by('SE5 - iOS').marks.join() === 'N,in' && by('SE5 - iOS').pay === '$388–558K', 'iOS: today, highlighted, both source marks, salary');
ok(by('SE6 - Compute Runtime') && by('SE6 - Compute Runtime').age === '1d' && by('SE6 - Compute Runtime').cls.includes('is-new'), '(L6) → SE6; yesterday highlighted');
ok(by('SE5 - TV Product UI') && by('SE5 - TV Product UI').cls.includes('is-gone') && by('SE5 - TV Product UI').age === 'gone 2d', 'gone 2 days ago: red, "gone 2d"');
ok(by('SE5 - Ads Agent') && by('SE5 - Ads Agent').where === 'New York, NY' && by('SE5 - Ads Agent').marks.join() === 'in', 'LinkedIn-only New York role: location + "in" mark');
ok(by('Staff SE6 / TLM') && by('Staff SE6 / TLM').pay === '$600K–1.07M', 'staff role: "$600K–1.07M"');
ok(by('SE5 – Model Development') && by('SE5 – Model Development').cls.includes('is-favorite'), 'favorite marked');
ok(!by('SE5 - Android') && !by('Security SE5'), 'gone > a week and hidden roles are not in the default view');
const fullTitles = await page.$$eval('.nr-role .nr-title', (ts) => ts.map((t) => t.title));
ok(fullTitles.join('|') === roles.filter((x) => !x.hidden && (!x.gone_at || x.role_id.startsWith('5'))).map((x) => x.title).join('|'), 'order kept (newest first, from the API)');
const status = await page.$eval('.nr-status', (s) => ({ cls: s.className, title: s.title, text: s.textContent }));
ok(status.cls.includes('is-failing') && status.title.includes('LinkedIn: status 429') && status.text === '5m ago', 'status: last checked 5m ago, failing LinkedIn flagged in the tooltip');
await page.screenshot({ path: `${out}/roles-default.png`, clip: await (await page.$('.nr-card')).boundingBox() });

// All: hidden and past roles too.
await page.click('.nr-all');
rs = await rows();
ok(rs.length === 8 && by && rs.some((r) => r.title.startsWith('Security SE5') && r.cls.includes('is-hidden')) && rs.some((r) => r.title.startsWith('SE5 - Android') && r.cls.includes('is-gone')), 'all: every role, hidden ones faded, old gone ones red');
await page.screenshot({ path: `${out}/roles-all.png`, clip: await (await page.$('.nr-card')).boundingBox() });
await page.click('.nr-all');

// Favorite + hide.
await page.click('.nr-role:has-text("SE5 - iOS") .nr-star');
await page.hover('.nr-role:has-text("SE5 - Ads Agent")');
await page.click('.nr-role:has-text("SE5 - Ads Agent") .nr-hide');
await page.waitForTimeout(200);
ok(patches.length === 2 && patches[0].method === 'PATCH' && patches[0].url.endsWith('/status/api/jobs/roles/11111111-1111-5111-8111-111111111111') && patches[0].body.favorite === true && patches[1].body.hidden === true, 'star and × send PATCH {favorite} / {hidden} for the role');
rs = await rows();
ok(rs.find((r) => r.title.startsWith('SE5 - iOS')).cls.includes('is-favorite') && !rs.some((r) => r.title.startsWith('SE5 - Ads Agent')), 'the favorite shows, the hidden role leaves the default view');

// Mobile.
const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await m.route('**/admin/api/me', (r) => r.fulfill({ json: { username: 'andrew', roles: [{ website: 'admin', role: 'admin' }] } }));
await m.route('**/status/api/jobs', (r) => r.fulfill({ json: { roles, checks } }));
await m.goto(URL, { waitUntil: 'networkidle' });
await m.waitForSelector('.nr-role');
ok(!(await m.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)), 'mobile: no horizontal overflow');
await m.screenshot({ path: `${out}/roles-mobile.png`, clip: await (await m.$('.nr-card')).boundingBox() });

await browser.close();
console.log(failed ? `\n${failed} FAILURE(S)` : '\nALL OK');
process.exit(failed ? 1 : 0);
