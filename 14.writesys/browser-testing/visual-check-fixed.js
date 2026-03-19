const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:5003');
  await page.waitForTimeout(2000);
  await page.click('#load-button');
  await page.waitForTimeout(5000);

  await page.locator('.pagedjs_page').first().screenshot({ path: 'browser-testing/alignment-fixed.png' });
  console.log('Screenshot saved: browser-testing/alignment-fixed.png');

  // Check page numbers
  const pageNumCount = await page.locator('.pagedjs_margin-bottom-right').count();
  console.log(`Found ${pageNumCount} page number elements`);

  if (pageNumCount > 0) {
    const firstPageNum = await page.locator('.pagedjs_margin-bottom-right').first().evaluate(el => ({
      text: el.textContent.trim(),
      visibility: window.getComputedStyle(el).visibility,
      display: window.getComputedStyle(el).display,
    }));

    console.log('First page number:', JSON.stringify(firstPageNum));
  }

  await browser.close();
})();
