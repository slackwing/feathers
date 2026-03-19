const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:5003');
  await page.waitForTimeout(2000);
  await page.click('#load-button');
  await page.waitForTimeout(5000);

  const info = await page.evaluate(() => {
    const pageContent = document.querySelector('.pagedjs_page_content');
    const pagedPage = document.querySelector('.pagedjs_page');

    return {
      pageWidth: pagedPage.offsetWidth,
      pageHeight: pagedPage.offsetHeight,
      contentWidth: pageContent.offsetWidth,
      contentHeight: pageContent.offsetHeight,
      contentStyles: {
        width: window.getComputedStyle(pageContent).width,
        height: window.getComputedStyle(pageContent).height,
        padding: window.getComputedStyle(pageContent).padding,
        margin: window.getComputedStyle(pageContent).margin,
        boxSizing: window.getComputedStyle(pageContent).boxSizing,
      },
    };
  });

  console.log('Page:', info.pageWidth, '×', info.pageHeight);
  console.log('Content:', info.contentWidth, '×', info.contentHeight);
  console.log('Content styles:', JSON.stringify(info.contentStyles, null, 2));

  const expected = {
    pageWidth: 576,
    pageHeight: 864,
    contentWidth: 480,  // Should be 576 - 2*48 (0.5in margins)
    contentHeight: 720,  // Should be 864 - 2*72 (0.75in margins)
  };

  console.log('\nExpected:');
  console.log('Content:', expected.contentWidth, '×', expected.contentHeight);
  console.log('Match:', info.contentWidth === expected.contentWidth && info.contentHeight === expected.contentHeight ? '✓' : '✗');

  await browser.close();
})();
