/**
 * CSS Loading Test
 * Catches browser caching issues where old CSS is loaded
 * This test was created after discovering cached teal background issue
 */

const { chromium } = require('playwright');
const { exit } = require('process');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:5003');
  await page.waitForTimeout(2000);

  console.log('=== CSS Loading Test ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✓ ${message}`);
      passed++;
    } else {
      console.log(`✗ ${message}`);
      failed++;
    }
  }

  // Test 1: Body background should be gray (#f5f5f5), NOT teal/cyan
  const bodyBg = await page.evaluate(() => {
    return window.getComputedStyle(document.body).backgroundColor;
  });
  const isGray = bodyBg === 'rgb(245, 245, 245)';
  const isTeal = bodyBg.includes('128') || bodyBg.includes('cyan') || bodyBg.includes('teal');

  assert(isGray && !isTeal, `Body background is gray (got ${bodyBg})`);
  if (isTeal) {
    console.log('  ⚠️  CACHE ISSUE: Browser is loading OLD CSS! Hard refresh needed.');
  }

  // Load manuscript
  await page.click('#load-button');
  await page.waitForTimeout(5000);

  // Test 2: Pages should be paginated (multiple .pagedjs_page elements)
  const pageCount = await page.locator('.pagedjs_page').count();
  assert(pageCount > 1, `Pages are paginated (found ${pageCount} pages, not single continuous page)`);

  // Test 3: Container background should be gray
  const containerBg = await page.locator('.pagedjs_pages').evaluate(el => {
    return window.getComputedStyle(el).backgroundColor;
  });
  assert(containerBg === 'rgb(245, 245, 245)', `Container background is gray (got ${containerBg})`);

  // Test 4: Pages should have white background, not transparent
  const pageBg = await page.locator('.pagedjs_page').first().evaluate(el => {
    return window.getComputedStyle(el).backgroundColor;
  });
  assert(pageBg === 'rgb(255, 255, 255)', `Pages have white background (got ${pageBg})`);

  // Test 5: Check CSS version in HTML
  const cssVersion = await page.evaluate(() => {
    const link = document.querySelector('link[href*="book.css"]');
    return link ? link.href : 'NOT FOUND';
  });
  console.log(`\nCSS URL: ${cssVersion}`);
  const hasVersion = cssVersion.includes('?v=');
  assert(hasVersion, 'CSS has cache-busting version parameter');

  // Summary
  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  await browser.close();

  if (failed > 0) {
    console.log('\n❌ CSS Loading Test FAILED');
    console.log('If you see teal background or single continuous page:');
    console.log('1. Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R)');
    console.log('2. Clear browser cache');
    console.log('3. Try incognito/private window');
    exit(1);
  } else {
    console.log('\n✅ CSS Loading Test passed');
    exit(0);
  }
})();
