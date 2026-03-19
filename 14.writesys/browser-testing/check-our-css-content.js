const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });

  await page.goto('http://localhost:5003');
  await page.waitForTimeout(1000);

  await page.fill('#commit-hash', '3d3f5da');
  await page.click('#load-button');
  await page.waitForTimeout(5000);

  // Check CSS content property on our site
  const cssContent = await page.evaluate(() => {
    const margins = document.querySelectorAll('.pagedjs_margin-bottom-right');
    return Array.from(margins).slice(0, 5).map((m, i) => {
      const content = m.querySelector('.pagedjs_margin-content');
      return {
        index: i,
        exists: !!content,
        cssContentAfter: content ? window.getComputedStyle(content, '::after').content : 'N/A',
        cssContent: content ? window.getComputedStyle(content).content : 'N/A'
      };
    });
  });

  console.log('Our CSS Content check:');
  console.log(JSON.stringify(cssContent, null, 2));

  await browser.close();
})();
