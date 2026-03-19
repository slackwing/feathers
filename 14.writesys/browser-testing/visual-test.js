const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 1400 } });
  const page = await context.newPage();

  await page.goto('http://localhost:5003?v=' + Date.now());
  await page.waitForTimeout(1000);

  await page.fill('#commit-hash', '3d3f5da');
  await page.click('#load-button');
  await page.waitForTimeout(5000);

  // Scroll to page 2
  await page.evaluate(() => {
    const pages = document.querySelectorAll('.pagedjs_page');
    if (pages[1]) {
      pages[1].scrollIntoView({ block: 'center' });
    }
  });

  await page.waitForTimeout(500);

  await page.screenshot({
    path: 'browser-testing/page-numbers-visual.png',
    fullPage: false
  });

  console.log('Screenshot saved to page-numbers-visual.png');

  await browser.close();
})();
