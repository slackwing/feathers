const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:5003');
  await page.waitForTimeout(2000);
  await page.click('#load-button');
  await page.waitForTimeout(5000);

  const gridInfo = await page.evaluate(() => {
    const pagebox = document.querySelector('.pagedjs_pagebox');
    const style = window.getComputedStyle(pagebox);

    return {
      display: style.display,
      gridTemplateColumns: style.gridTemplateColumns,
      gridTemplateRows: style.gridTemplateRows,
    };
  });

  console.log('Pagebox CSS Grid:');
  console.log('  gridTemplateColumns:', gridInfo.gridTemplateColumns);
  console.log('  gridTemplateRows:', gridInfo.gridTemplateRows);
  console.log('');
  console.log('Expected columns: 48px 480px 48px (left margin, content, right margin)');
  console.log('Expected rows: 72px 720px 72px (top margin, content, bottom margin)');

  await browser.close();
})();
