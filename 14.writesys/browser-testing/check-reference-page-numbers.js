const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('https://andrewcheong.com/.staging/stories/');
  await page.waitForTimeout(3000);

  const pageNumbers = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('.pagedjs_page').forEach((pageEl, i) => {
      const bottomRight = pageEl.querySelector('.pagedjs_margin-bottom-right');
      if (bottomRight) {
        const content = bottomRight.querySelector('.pagedjs_margin-content');
        results.push({
          page: i + 1,
          text: bottomRight.textContent.trim(),
          innerHTML: content ? content.innerHTML.trim() : 'NO CONTENT DIV',
          hasContent: bottomRight.textContent.trim().length > 0
        });
      }
    });
    return results;
  });

  console.log('Reference site page numbers:');
  pageNumbers.slice(0, 5).forEach(pn => {
    console.log(`  Page ${pn.page}: "${pn.text}" (HTML: "${pn.innerHTML}")`);
  });

  await browser.close();
})();
