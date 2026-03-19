const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });

  await page.goto('https://andrewcheong.com/.staging/wildfire/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(5000); // Wait longer

  // Check all possible page number locations
  const pageNumInfo = await page.evaluate(() => {
    const results = {
      bottomRight: [],
      bottomCenter: [],
      bottomLeft: [],
      anyWithText: []
    };

    // Check bottom right
    const bottomRight = document.querySelectorAll('.pagedjs_margin-bottom-right');
    results.bottomRight = Array.from(bottomRight).map((m, i) => ({
      index: i,
      text: m.textContent.trim(),
      innerText: m.innerText
    }));

    // Check bottom center
    const bottomCenter = document.querySelectorAll('.pagedjs_margin-bottom-center');
    results.bottomCenter = Array.from(bottomCenter).map((m, i) => ({
      index: i,
      text: m.textContent.trim()
    }));

    // Find any margin boxes with content
    const allMargins = document.querySelectorAll('[class*="pagedjs_margin"]');
    results.anyWithText = Array.from(allMargins).filter(m => m.textContent.trim().length > 0).map(m => ({
      className: m.className,
      text: m.textContent.trim()
    }));

    return results;
  });

  console.log('Bottom right margins:', JSON.stringify(pageNumInfo.bottomRight, null, 2));
  console.log('Bottom center margins:', JSON.stringify(pageNumInfo.bottomCenter, null, 2));
  console.log('Any margins with text:', JSON.stringify(pageNumInfo.anyWithText, null, 2));

  // Scroll down to page 3-4
  await page.evaluate(() => {
    const pages = document.querySelectorAll('.pagedjs_page');
    if (pages[3]) {
      pages[3].scrollIntoView({ block: 'center' });
    }
  });

  await page.waitForTimeout(1000);

  await page.screenshot({
    path: 'browser-testing/reference-page-3.png',
    fullPage: false
  });

  console.log('Screenshot saved to reference-page-3.png');

  await browser.close();
})();
