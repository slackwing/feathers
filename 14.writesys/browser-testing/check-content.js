const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5003', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  // Get the actual content area
  const content = await page.evaluate(() => {
    const pageArea = document.querySelector('.pagedjs_page_content');
    if (pageArea) {
      return pageArea.innerHTML.substring(0, 1500);
    }
    return 'No page content found';
  });
  
  console.log('=== Page Content (first 1500 chars) ===');
  console.log(content);
  
  await browser.close();
})();
