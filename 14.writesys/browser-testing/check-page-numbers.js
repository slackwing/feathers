const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });

  await page.goto('http://localhost:5003');
  await page.waitForTimeout(1000);

  await page.fill('#commit-hash', '3d3f5da');
  await page.click('#load-button');
  await page.waitForTimeout(5000);

  // Check page numbers
  const pageNumbers = await page.evaluate(() => {
    const margins = document.querySelectorAll('.pagedjs_margin-bottom-right');
    return Array.from(margins).map((m, i) => ({
      index: i,
      text: m.textContent.trim(),
      html: m.innerHTML,
      visibility: window.getComputedStyle(m).visibility,
      display: window.getComputedStyle(m).display,
      content: window.getComputedStyle(m).content
    }));
  });

  console.log('Page numbers found:', pageNumbers.length);
  pageNumbers.forEach(pn => {
    console.log(`\nPage ${pn.index}:`);
    console.log(`  Text: "${pn.text}"`);
    console.log(`  HTML: "${pn.html}"`);
    console.log(`  Visibility: ${pn.visibility}`);
    console.log(`  Display: ${pn.display}`);
    console.log(`  Content: ${pn.content}`);
  });

  await browser.close();
})();
