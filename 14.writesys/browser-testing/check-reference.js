const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });

  await page.goto('https://andrewcheong.com/.staging/wildfire/');
  await page.waitForTimeout(3000);

  // Scroll to see multiple pages
  await page.evaluate(() => {
    const pages = document.querySelectorAll('.pagedjs_page');
    if (pages[1]) {
      pages[1].scrollIntoView({ block: 'center' });
    }
  });

  await page.waitForTimeout(500);

  await page.screenshot({
    path: 'browser-testing/reference-site.png',
    fullPage: false
  });

  // Check for page numbers
  const pageNumInfo = await page.evaluate(() => {
    const margins = document.querySelectorAll('.pagedjs_margin-bottom-right');
    if (margins.length > 0) {
      return Array.from(margins).slice(0, 3).map((m, i) => ({
        index: i,
        text: m.textContent.trim(),
        html: m.innerHTML
      }));
    }
    return null;
  });

  console.log('Page number elements:', pageNumInfo);
  console.log('Screenshot saved to reference-site.png');

  await browser.close();
})();
