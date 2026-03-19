const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log('Loading http://localhost:5003...');
  await page.goto('http://localhost:5003');
  await page.waitForTimeout(2000);

  console.log('Clicking Load Manuscript...');
  await page.click('#load-button');
  await page.waitForTimeout(5000);

  console.log('\n=== DETAILED ANALYSIS ===\n');

  // 1. Check controls
  const controlsVisible = await page.locator('#controls').isVisible();
  const controlsBox = await page.locator('#controls').boundingBox();
  console.log(`✓ Controls visible: ${controlsVisible}`);
  console.log(`  Position: top=${controlsBox?.y || 'N/A'}`);

  // 2. Check Paged.js structure
  const pagedPagesCount = await page.locator('.pagedjs_pages').count();
  const pagedPageCount = await page.locator('.pagedjs_page').count();
  console.log(`\n✓ Paged.js structure:`);
  console.log(`  .pagedjs_pages containers: ${pagedPagesCount}`);
  console.log(`  .pagedjs_page elements: ${pagedPageCount}`);

  // 3. Check first page content
  if (pagedPageCount > 0) {
    const firstPage = page.locator('.pagedjs_page').first();
    const firstPageBox = await firstPage.boundingBox();
    const firstPageBg = await firstPage.evaluate(el => window.getComputedStyle(el).backgroundColor);
    const firstPageShadow = await firstPage.evaluate(el => window.getComputedStyle(el).boxShadow);

    console.log(`\n✓ First page styling:`);
    console.log(`  Size: ${firstPageBox?.width}px × ${firstPageBox?.height}px`);
    console.log(`  Background: ${firstPageBg}`);
    console.log(`  Box shadow: ${firstPageShadow}`);

    // Check for actual text content
    const textContent = await firstPage.locator('p').first().textContent();
    console.log(`  First paragraph: "${textContent?.substring(0, 80)}..."`);

    // Check for page number
    const pageArea = await firstPage.locator('.pagedjs_margin-bottom-right').textContent().catch(() => null);
    console.log(`  Page number area: "${pageArea || 'not found'}"`);
  }

  // 4. Check if controls overlap with pages
  const pagedBox = await page.locator('.pagedjs_pages').boundingBox();
  if (pagedBox && controlsBox) {
    const overlap = controlsBox.y + controlsBox.height > pagedBox.y && controlsBox.y < pagedBox.y;
    console.log(`\n✓ Layout check:`);
    console.log(`  Controls end at: ${controlsBox.y + controlsBox.height}px`);
    console.log(`  Pages start at: ${pagedBox.y}px`);
    console.log(`  Overlap: ${overlap ? 'YES (BAD)' : 'NO (GOOD)'}`);
  }

  // 5. Take comparison screenshots
  await page.screenshot({ path: 'browser-testing/full-page.png', fullPage: true });

  // Screenshot just the first page
  if (pagedPageCount > 0) {
    await page.locator('.pagedjs_page').first().screenshot({ path: 'browser-testing/first-page.png' });
  }

  console.log('\n✓ Screenshots saved:');
  console.log('  - browser-testing/full-page.png');
  console.log('  - browser-testing/first-page.png');

  await browser.close();
})();
