const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5003', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  // Get visible text from first page
  const text = await page.evaluate(() => {
    const pageContent = document.querySelector('.pagedjs_page_content');
    if (pageContent) {
      return pageContent.textContent.substring(0, 500);
    }
    return 'No content';
  });
  
  console.log('=== Visible text (first 500 chars) ===');
  console.log(text);
  console.log('\n=== Checking paragraph count ===');
  
  const paragraphs = await page.locator('p').count();
  const headings = await page.locator('h1, h2, h3').count();
  
  console.log(`Paragraphs: ${paragraphs}`);
  console.log(`Headings: ${headings}`);
  
  await browser.close();
})();
