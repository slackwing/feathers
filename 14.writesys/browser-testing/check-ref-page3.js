const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });

  await page.goto('https://andrewcheong.com/.staging/wildfire/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Check page 3 specifically  
  const page3Info = await page.evaluate(() => {
    const margins = document.querySelectorAll('.pagedjs_margin-bottom-right');
    if (margins[2]) {  // Page 3
      const content = margins[2].querySelector('.pagedjs_margin-content');
      return {
        index: 2,
        html: margins[2].outerHTML.substring(0, 500),
        hasContentClass: margins[2].classList.contains('hasContent'),
        contentAfter: content ? window.getComputedStyle(content, '::after').content : 'N/A',
        marginHeight: window.getComputedStyle(margins[2]).height
      };
    }
    return null;
  });

  console.log('Page 3 info:');
  console.log(JSON.stringify(page3Info, null, 2));

  await browser.close();
})();
