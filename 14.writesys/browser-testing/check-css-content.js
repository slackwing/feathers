const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });

  await page.goto('https://andrewcheong.com/.staging/wildfire/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Check CSS content property
  const cssContent = await page.evaluate(() => {
    const margins = document.querySelectorAll('.pagedjs_margin-bottom-right');
    return Array.from(margins).slice(0, 5).map((m, i) => {
      const content = m.querySelector('.pagedjs_margin-content');
      return {
        index: i,
        textContent: m.textContent.trim(),
        innerText: m.innerText.trim(),
        cssContent: window.getComputedStyle(content, '::after').content,
        cssContentBefore: window.getComputedStyle(content, '::before').content,
        contentInnerHTML: content.innerHTML,
        contentComputedContent: window.getComputedStyle(content).content
      };
    });
  });

  console.log('CSS Content check:');
  console.log(JSON.stringify(cssContent, null, 2));

  await browser.close();
})();
