const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.text().includes('Wrapped HTML sample')) {
      console.log(msg.text());
    }
  });
  
  await page.goto('http://localhost:5003', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  // Get a sample paragraph HTML
  const paraHTML = await page.evaluate(() => {
    const p = document.querySelectorAll('p')[3]; // Get 4th paragraph
    return p ? p.outerHTML : 'No paragraph found';
  });
  
  console.log('=== Sample paragraph HTML ===');
  console.log(paraHTML.substring(0, 800));
  
  await browser.close();
})();
