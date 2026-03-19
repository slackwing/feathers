const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log('Loading http://localhost:5003...');
  await page.goto('http://localhost:5003');

  // Wait for page to load
  await page.waitForTimeout(2000);

  // Click load manuscript
  console.log('Clicking Load Manuscript...');
  await page.click('#load-button');

  // Wait for Paged.js to render
  await page.waitForTimeout(5000);

  // Take screenshot
  console.log('Taking screenshot...');
  await page.screenshot({ path: 'browser-testing/current-state.png', fullPage: true });

  // Check what we have
  const controls = await page.locator('#controls').boundingBox();
  const pagedPages = await page.locator('.pagedjs_pages').count();
  const pagedPage = await page.locator('.pagedjs_page').count();

  console.log('\n=== Current State ===');
  console.log(`Controls visible: ${controls !== null}`);
  if (controls) {
    console.log(`Controls position: top=${controls.y}, left=${controls.x}, width=${controls.width}, height=${controls.height}`);
  }
  console.log(`Paged.js containers (.pagedjs_pages): ${pagedPages}`);
  console.log(`Paged.js pages (.pagedjs_page): ${pagedPage}`);

  // Check if controls are inside or outside Paged.js
  if (pagedPages > 0) {
    const pagedBox = await page.locator('.pagedjs_pages').first().boundingBox();
    if (pagedBox && controls) {
      const controlsInsidePaged = controls.y >= pagedBox.y && controls.y <= (pagedBox.y + pagedBox.height);
      console.log(`Controls inside Paged.js container: ${controlsInsidePaged}`);
    }
  }

  console.log('\nScreenshot saved to browser-testing/current-state.png');

  await browser.close();
})();
