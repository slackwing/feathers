const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5003', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  // Find the span with sentence 182
  const sentence182 = await page.locator('span.sentence[data-sentence-id="i-blinked-then-e7f17437"]').first();
  const paragraph = sentence182.locator('xpath=ancestor::p');
  const paraHTML = await paragraph.innerHTML();
  const paraText = await paragraph.textContent();
  
  console.log('Full paragraph length:', paraText.length);
  console.log('\nFull paragraph text:');
  console.log(paraText);
  console.log('\n\n=== HTML (first 500 chars) ===');
  console.log(paraHTML.substring(0, 500));
  
  await browser.close();
})();
