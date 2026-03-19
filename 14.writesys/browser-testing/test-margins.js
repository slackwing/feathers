const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const refPage = await browser.newPage();

  await refPage.goto('https://andrewcheong.com/.staging/stories/');
  await refPage.waitForTimeout(3000);

  const margins = await refPage.evaluate(() => {
    const pageContent = document.querySelector('.pagedjs_page_content');
    const page = document.querySelector('.pagedjs_page');

    return {
      pageWidth: page.offsetWidth,
      pageHeight: page.offsetHeight,
      contentWidth: pageContent.offsetWidth,
      contentHeight: pageContent.offsetHeight,
      contentPadding: window.getComputedStyle(pageContent).padding,
      contentMargin: window.getComputedStyle(pageContent).margin,
      pagePadding: window.getComputedStyle(page).padding,
      // Calculate effective margins
      horizontalMargin: (page.offsetWidth - pageContent.offsetWidth) / 2,
      verticalMargin: (page.offsetHeight - pageContent.offsetHeight) / 2,
    };
  });

  console.log('\n=== REFERENCE MARGINS ===');
  console.log(`Page: ${margins.pageWidth}px × ${margins.pageHeight}px`);
  console.log(`Content: ${margins.contentWidth}px × ${margins.contentHeight}px`);
  console.log(`Horizontal margin: ${margins.horizontalMargin}px per side`);
  console.log(`Vertical margin: ${margins.verticalMargin}px per side`);
  console.log(`Content padding: ${margins.contentPadding}`);
  console.log(`Content margin: ${margins.contentMargin}`);
  console.log(`Page padding: ${margins.pagePadding}`);

  // Convert to inches (assuming 96 DPI)
  const hMarginInches = margins.horizontalMargin / 96;
  const vMarginInches = margins.verticalMargin / 96;
  console.log(`\nIn inches (at 96 DPI):`);
  console.log(`Horizontal margin: ${hMarginInches.toFixed(3)}in`);
  console.log(`Vertical margin: ${vMarginInches.toFixed(3)}in`);

  await browser.close();
})();
