const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Capture console messages
  page.on('console', msg => {
    const type = msg.type();
    console.log(`[${type}] ${msg.text()}`);
  });

  // Capture errors
  page.on('pageerror', error => {
    console.error(`[PAGE ERROR] ${error.message}`);
  });

  // Navigate to page
  console.log('Loading page...');
  await page.goto('http://localhost:5003', { waitUntil: 'networkidle' });

  // Wait for manuscript to render
  await page.waitForTimeout(5000);

  // Check for sentences
  const sentenceCount = await page.locator('.sentence').count();
  console.log(`Found ${sentenceCount} sentences`);

  // Check for duplicate sentence IDs
  const sentenceIds = await page.$$eval('.sentence', spans =>
    spans.map(s => s.dataset.sentenceId)
  );
  const uniqueIds = new Set(sentenceIds);
  if (uniqueIds.size !== sentenceIds.length) {
    console.log(`WARNING: Found ${sentenceIds.length - uniqueIds.size} duplicate sentence IDs`);
    const counts = {};
    sentenceIds.forEach(id => counts[id] = (counts[id] || 0) + 1);
    const duplicates = Object.entries(counts).filter(([id, count]) => count > 1);
    console.log(`Duplicates: ${duplicates.slice(0, 10).map(([id, count]) => `${id}(x${count})`).join(', ')}...`);
  }

  // Check if Paged.js is duplicating content
  const pageCount = await page.locator('.pagedjs_page').count();
  console.log(`Pages: ${pageCount}`);

  // Check for running headers or other duplication
  const runningHeaders = await page.locator('[data-split-from]').count();
  if (runningHeaders > 0) {
    console.log(`Found ${runningHeaders} split elements (page break continuations)`);
  }

  // Take screenshot
  await page.screenshot({ path: 'quick-test-screenshot.png', fullPage: true });
  console.log('Screenshot saved to quick-test-screenshot.png');

  // Check for page structure
  const paragraphs = await page.locator('p').count();
  const headings = await page.locator('h1, h2, h3').count();
  console.log(`Structure: ${paragraphs} paragraphs, ${headings} headings`);

  // Keep browser open for 5 seconds
  await page.waitForTimeout(5000);

  await browser.close();
})();
