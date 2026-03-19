const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5003');
  await page.waitForTimeout(1000);

  await page.fill('#commit-hash', '3d3f5da');
  await page.click('#load-button');
  await page.waitForTimeout(5000);

  const paragraphs = await page.evaluate(() => {
    const paras = document.querySelectorAll('.pagedjs_page p');
    const result = [];
    paras.forEach((p, i) => {
      const text = p.textContent.trim();
      if (text.includes('Hello') || text.includes('waited') || text.includes('Hey, A')) {
        result.push({
          index: i,
          text: text.substring(0, 100),
          exactMatch: text === '"Hello?"' || text === 'I waited a second.' || text === '"Hey, A—."'
        });
      }
    });
    return result;
  });

  console.log('Found paragraphs with dialogue:');
  paragraphs.forEach(p => {
    console.log(`\nParagraph ${p.index}:`);
    console.log(`  Text: "${p.text}"`);
    console.log(`  Exact match: ${p.exactMatch}`);
  });

  await browser.close();
})();
