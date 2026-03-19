const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage({ viewport: { width: 1280, height: 1400 } });

  // Clear cache
  await context.clearCookies();

  await page.goto('http://localhost:5003', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  await page.fill('#commit-hash', '3d3f5da');
  await page.click('#load-button');
  await page.waitForTimeout(5000);

  // Check CSS content property
  const cssContent = await page.evaluate(() => {
    const margins = document.querySelectorAll('.pagedjs_margin-bottom-right');
    return Array.from(margins).slice(0, 5).map((m, i) => {
      const content = m.querySelector('.pagedjs_margin-content');
      return {
        index: i,
        cssContentAfter: content ? window.getComputedStyle(content, '::after').content : 'N/A'
      };
    });
  });

  console.log('Page numbers (no cache):');
  console.log(JSON.stringify(cssContent, null, 2));

  // Take screenshot
  await page.evaluate(() => {
    const pages = document.querySelectorAll('.pagedjs_page');
    if (pages[1]) {
      pages[1].scrollIntoView({ block: 'center' });
    }
  });

  await page.waitForTimeout(500);
  await page.screenshot({ path: 'browser-testing/page-numbers-test.png' });
  console.log('Screenshot saved');

  await browser.close();
})();
