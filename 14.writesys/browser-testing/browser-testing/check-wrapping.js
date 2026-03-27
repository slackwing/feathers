const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5003', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  // Find the span with sentence 182
  const sentence182 = await page.locator('span.sentence[data-sentence-id="i-blinked-then-e7f17437"]').first();
  const text182 = await sentence182.textContent();
  console.log('Sentence 182 wrapped text:');
  console.log(text182);
  console.log('\nLength:', text182.length);
  
  // Check if it contains "vertigo"
  console.log('Contains "vertigo":', text182.includes('vertigo'));
  
  // Get the full paragraph text to see what's there
  const paragraph = sentence182.locator('xpath=ancestor::p');
  const paraText = await paragraph.textContent();
  console.log('\nFull paragraph text (first 300 chars):');
  console.log(paraText.substring(0, 300));
  console.log('...');
  console.log('\nParagraph contains "A vertigo":', paraText.includes('A vertigo'));
  
  await browser.close();
})();
