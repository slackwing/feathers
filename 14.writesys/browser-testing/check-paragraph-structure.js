const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:5003', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  await page.fill('#commit-hash', '6442a57');
  await page.click('#load-button');
  await page.waitForTimeout(5000);

  const result = await page.evaluate(() => {
    const sentences = Array.from(document.querySelectorAll('.sentence'));
    const target = sentences.find(s => s.textContent.trim().startsWith('I waited a second'));

    if (!target) return { found: false };

    const paragraph = target.closest('p');
    const paragraphText = paragraph ? paragraph.textContent.trim() : 'NO PARAGRAPH';

    return {
      found: true,
      sentenceText: target.textContent.trim(),
      isOwnParagraph: paragraphText === target.textContent.trim(),
      paragraphLength: paragraphText.length,
      paragraphPreview: paragraphText.substring(0, 100),
    };
  });

  console.log('Paragraph structure:');
  console.log(JSON.stringify(result, null, 2));

  // Take screenshot
  await page.evaluate(() => {
    const sentences = Array.from(document.querySelectorAll('.sentence'));
    const target = sentences.find(s => s.textContent.trim().startsWith('I waited a second'));
    if (target) {
      target.scrollIntoView({ block: 'center' });
      target.style.backgroundColor = 'yellow';
    }
  });

  await page.waitForTimeout(500);
  await page.screenshot({ path: 'browser-testing/justification-fixed-check.png' });
  console.log('\nScreenshot saved');

  await browser.close();
})();
