const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('https://andrewcheong.com/.staging/stories/');
  await page.waitForTimeout(3000);

  const info = await page.evaluate(() => {
    const pagebox = document.querySelector('.pagedjs_pagebox');
    if (!pagebox) return null;

    const pageboxStyle = window.getComputedStyle(pagebox);

    const page = document.querySelector('.pagedjs_page');
    const pageStyle = window.getComputedStyle(page);

    const area = document.querySelector('.pagedjs_area');
    const areaRect = area.getBoundingClientRect();
    const pageRect = page.getBoundingClientRect();

    return {
      pagedjs_page: {
        width: pageStyle.width,
        height: pageStyle.height,
        position: { x: Math.round(pageRect.x), y: Math.round(pageRect.y) }
      },
      pagedjs_pagebox: {
        width: pageboxStyle.width,
        height: pageboxStyle.height,
        gridTemplateColumns: pageboxStyle.gridTemplateColumns,
        gridTemplateRows: pageboxStyle.gridTemplateRows,
      },
      pagedjs_area: {
        position: { x: Math.round(areaRect.x), y: Math.round(areaRect.y) },
        size: { w: Math.round(areaRect.width), h: Math.round(areaRect.height) }
      }
    };
  });

  console.log('Reference site Paged.js structure:');
  console.log(JSON.stringify(info, null, 2));

  await browser.close();
})();
