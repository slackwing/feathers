const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });

  await page.goto('http://localhost:5003');
  await page.waitForTimeout(1000);

  await page.fill('#commit-hash', '3d3f5da');
  await page.click('#load-button');
  await page.waitForTimeout(5000);

  // Scroll to the dialogue section
  await page.evaluate(() => {
    const paragraphs = Array.from(document.querySelectorAll('.pagedjs_page p'));
    const target = paragraphs.find(p => p.textContent.includes('Hello?'));
    if (target) {
      target.scrollIntoView({ block: 'center' });
    }
  });

  await page.waitForTimeout(500);

  await page.screenshot({
    path: 'browser-testing/justification-final.png',
    fullPage: false
  });

  console.log('Final screenshot saved to justification-final.png');
  console.log('Short dialogue lines should have normal word spacing, not stretched');

  await browser.close();
})();
