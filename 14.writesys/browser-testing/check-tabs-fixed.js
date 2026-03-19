const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Force reload
  await page.goto('http://localhost:5003', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Change commit hash to 79aaaf6
  await page.fill('#commit-hash', '79aaaf6');
  await page.click('#load-button');
  await page.waitForTimeout(5000);

  // Find "I waited a second"
  const result = await page.evaluate(() => {
    const sentences = Array.from(document.querySelectorAll('.sentence'));
    const target = sentences.find(s => s.textContent.trim().startsWith('I waited a second'));

    if (!target) {
      // Try searching all text
      const allText = document.body.textContent;
      return {
        found: false,
        searchResult: allText.includes('I waited a second') ? 'Found in body text' : 'Not found at all',
        sentenceCount: sentences.length
      };
    }

    return {
      found: true,
      html: target.outerHTML,
      text: target.textContent,
      hasTab: target.textContent.includes('\t')
    };
  });

  console.log(JSON.stringify(result, null, 2));

  await browser.close();
})();
