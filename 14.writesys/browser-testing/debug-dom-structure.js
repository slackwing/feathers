const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:5003');
  await page.waitForTimeout(2000);
  await page.click('#load-button');
  await page.waitForTimeout(5000);

  // Get all Paged.js elements in first page
  const structure = await page.evaluate(() => {
    const results = [];
    const selectors = [
      '.pagedjs_page',
      '.pagedjs_sheet',
      '.pagedjs_pagebox',
      '.pagedjs_margin-top',
      '.pagedjs_margin-bottom',
      '.pagedjs_margin-left',
      '.pagedjs_margin-right',
      '.pagedjs_area',
      '.pagedjs_page_content'
    ];

    selectors.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        results.push({
          selector: sel,
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            w: Math.round(rect.width),
            h: Math.round(rect.height)
          },
          margin: style.margin,
          padding: style.padding,
          display: style.display
        });
      }
    });

    return results;
  });

  structure.forEach(item => {
    console.log(`${item.selector}:`);
    console.log(`  Position: (${item.rect.x}, ${item.rect.y})`);
    console.log(`  Size: ${item.rect.w}×${item.rect.h}`);
    console.log(`  Margin: ${item.margin}`);
    console.log(`  Padding: ${item.padding}`);
    console.log(`  Display: ${item.display}`);
    console.log('');
  });

  await browser.close();
})();
