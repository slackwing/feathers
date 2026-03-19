const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5003');
  await page.waitForTimeout(1000);

  await page.fill('#commit-hash', '3d3f5da');
  await page.click('#load-button');
  await page.waitForTimeout(5000);

  const allText = await page.evaluate(() => document.body.innerText);
  const hasHello = allText.includes('Hello?');
  const hasWaited = allText.includes('waited');

  console.log('Has "Hello?":', hasHello);
  console.log('Has "waited":', hasWaited);

  if (hasWaited) {
    console.log('\nContext around "waited":');
    const lines = allText.split('\n');
    lines.forEach((line, i) => {
      if (line.includes('waited')) {
        console.log('Line', i, ':', line.substring(0, 100));
      }
    });
  }

  await browser.close();
})();
