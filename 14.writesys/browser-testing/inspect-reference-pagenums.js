const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });

  await page.goto('https://andrewcheong.com/.staging/wildfire/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Scroll to page with visible number
  await page.evaluate(() => {
    const pages = document.querySelectorAll('.pagedjs_page');
    if (pages[2]) {
      pages[2].scrollIntoView({ block: 'center' });
    }
  });

  await page.waitForTimeout(1000);

  // Take screenshot
  await page.screenshot({ path: 'browser-testing/reference-pagenum-detail.png' });

  // Inspect the actual element structure
  const numInfo = await page.evaluate(() => {
    const margin = document.querySelector('.pagedjs_margin-bottom-right');
    const content = margin ? margin.querySelector('.pagedjs_margin-content') : null;
    
    return {
      marginHTML: margin ? margin.outerHTML.substring(0, 500) : 'not found',
      contentHTML: content ? content.outerHTML : 'not found',
      marginComputedHeight: margin ? window.getComputedStyle(margin).height : 'N/A',
      marginComputedWidth: margin ? window.getComputedStyle(margin).width : 'N/A',
      contentAfter: content ? window.getComputedStyle(content, '::after').content : 'N/A'
    };
  });

  console.log('Page number structure:');
  console.log(JSON.stringify(numInfo, null, 2));

  await browser.close();
})();
