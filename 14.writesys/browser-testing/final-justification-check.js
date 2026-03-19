const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });

  await page.goto('http://localhost:5003');
  await page.waitForTimeout(1000);

  // Load commit 6442a57
  await page.fill('#commit-hash', '6442a57');
  await page.click('#load-button');
  await page.waitForTimeout(5000);

  // Scroll down to find the dialogue section
  await page.evaluate(() => {
    // Scroll to page 2 or 3 where dialogue appears
    const pages = document.querySelectorAll('.pagedjs_page');
    if (pages[1]) {
      pages[1].scrollIntoView({ block: 'start' });
    }
  });

  await page.waitForTimeout(500);

  // Take screenshot of dialogue section
  await page.screenshot({
    path: 'browser-testing/justification-final.png',
    fullPage: false
  });

  console.log('Screenshot saved to justification-final.png');
  console.log('Check for short dialogue lines like "I waited a second" - they should NOT be stretched across the full line width');

  await browser.close();
})();
