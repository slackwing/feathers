const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });

  await page.goto('http://localhost:5003?v=' + Date.now());
  await page.waitForTimeout(1000);

  await page.fill('#commit-hash', '3d3f5da');
  await page.click('#load-button');
  await page.waitForTimeout(5000);

  // Check page 2 margin box details
  const marginInfo = await page.evaluate(() => {
    const margin = document.querySelectorAll('.pagedjs_margin-bottom-right')[1];
    if (!margin) return null;

    const content = margin.querySelector('.pagedjs_margin-content');
    const bbox = margin.getBoundingClientRect();
    
    return {
      marginHeight: window.getComputedStyle(margin).height,
      marginDisplay: window.getComputedStyle(margin).display,
      marginPosition: window.getComputedStyle(margin).position,
      contentAfter: content ? window.getComputedStyle(content, '::after').content : 'N/A',
      contentAfterDisplay: content ? window.getComputedStyle(content, '::after').display : 'N/A',
      bbox: {
        top: bbox.top,
        bottom: bbox.bottom,
        left: bbox.left,
        right: bbox.right,
        height: bbox.height
      }
    };
  });

  console.log('Page 2 margin box:');
  console.log(JSON.stringify(marginInfo, null, 2));

  // Scroll to show bottom of page 2
  await page.evaluate(() => {
    const pages = document.querySelectorAll('.pagedjs_page');
    if (pages[1]) {
      // Scroll so bottom of page 2 is visible
      pages[1].scrollIntoView({ block: 'end' });
    }
  });

  await page.waitForTimeout(500);

  await page.screenshot({
    path: 'browser-testing/page-bottom.png',
    fullPage: false
  });

  console.log('Screenshot saved showing bottom of page');

  await browser.close();
})();
