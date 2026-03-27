const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5003', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  // Find elements with data-split-from attribute that contain "vertigo"
  const allElements = await page.locator('[data-split-from]').all();
  console.log('Total split elements:', allElements.length);
  
  for (let i = 0; i < allElements.length; i++) {
    const text = await allElements[i].textContent();
    if (text.includes('vertigo')) {
      console.log(`\n=== Split element ${i} contains "vertigo" ===`);
      console.log('Text (first 200 chars):', text.substring(0, 200));
      const html = await allElements[i].innerHTML();
      console.log('\nHTML (first 300 chars):', html.substring(0, 300));
    }
  }
  
  await browser.close();
})();
