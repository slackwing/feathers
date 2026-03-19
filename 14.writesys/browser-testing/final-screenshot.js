const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });

  await page.goto('http://localhost:5003');
  await page.waitForTimeout(2000);
  await page.click('#load-button');
  await page.waitForTimeout(5000);

  await page.screenshot({ path: 'browser-testing/final-fixed-layout.png', fullPage: false });
  console.log('Screenshot saved: browser-testing/final-fixed-layout.png');

  await browser.close();
})();
