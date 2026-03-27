const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Wrapped HTML sample')) {
      console.log(text);
    }
  });
  
  await page.goto('http://localhost:5003', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  // Get a sample of the rendered HTML
  const sample = await page.evaluate(() => {
    const pagedContent = document.querySelector('.pagedjs_pages');
    if (pagedContent) {
      return pagedContent.innerHTML.substring(0, 1000);
    }
    return 'No paged content found';
  });
  
  console.log('=== Rendered HTML (first 1000 chars) ===');
  console.log(sample);
  
  await browser.close();
})();
