const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const refPage = await browser.newPage();
  const ourPage = await browser.newPage();

  await refPage.goto('https://andrewcheong.com/.staging/stories/');
  await refPage.waitForTimeout(3000);

  await ourPage.goto('http://localhost:5003');
  await ourPage.waitForTimeout(2000);
  await ourPage.click('#load-button');
  await ourPage.waitForTimeout(5000);

  const refInfo = await refPage.evaluate(() => {
    const page = document.querySelector('.pagedjs_page');
    const pages = document.querySelector('.pagedjs_pages');
    return {
      devicePixelRatio: window.devicePixelRatio,
      pageTransform: page ? window.getComputedStyle(page).transform : null,
      pagesTransform: pages ? window.getComputedStyle(pages).transform : null,
      pageWidth: page ? page.offsetWidth : null,
      pageHeight: page ? page.offsetHeight : null,
      computedPageWidth: page ? window.getComputedStyle(page).width : null,
      computedPageHeight: page ? window.getComputedStyle(page).height : null,
    };
  });

  const ourInfo = await ourPage.evaluate(() => {
    const page = document.querySelector('.pagedjs_page');
    const pages = document.querySelector('.pagedjs_pages');
    return {
      devicePixelRatio: window.devicePixelRatio,
      pageTransform: page ? window.getComputedStyle(page).transform : null,
      pagesTransform: pages ? window.getComputedStyle(pages).transform : null,
      pageWidth: page ? page.offsetWidth : null,
      pageHeight: page ? page.offsetHeight : null,
      computedPageWidth: page ? window.getComputedStyle(page).width : null,
      computedPageHeight: page ? window.getComputedStyle(page).height : null,
    };
  });

  console.log('\n=== REFERENCE ===');
  console.log('DPI:', refInfo.devicePixelRatio);
  console.log('Page transform:', refInfo.pageTransform);
  console.log('Pages transform:', refInfo.pagesTransform);
  console.log('Page size:', refInfo.pageWidth, '×', refInfo.pageHeight);
  console.log('Computed size:', refInfo.computedPageWidth, '×', refInfo.computedPageHeight);

  console.log('\n=== OURS ===');
  console.log('DPI:', ourInfo.devicePixelRatio);
  console.log('Page transform:', ourInfo.pageTransform);
  console.log('Pages transform:', ourInfo.pagesTransform);
  console.log('Page size:', ourInfo.pageWidth, '×', ourInfo.pageHeight);
  console.log('Computed size:', ourInfo.computedPageWidth, '×', ourInfo.computedPageHeight);

  // Try setting exact pixel dimensions via CSS
  console.log('\n=== SOLUTION ===');
  console.log('Reference renders at 6in × 9in as 576px × 864px (96 DPI)');
  console.log('We should apply: .pagedjs_page { width: 576px !important; height: 864px !important; }');

  await browser.close();
})();
