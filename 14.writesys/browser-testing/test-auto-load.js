const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });

  await page.goto('http://localhost:5003');
  
  // Wait for commits to load and page to render
  await page.waitForTimeout(8000);

  // Check if dropdown was populated
  const options = await page.evaluate(() => {
    const select = document.getElementById('commit-select');
    return Array.from(select.options).map(opt => ({
      value: opt.value,
      text: opt.textContent
    }));
  });

  console.log('Dropdown options:');
  options.forEach((opt, i) => console.log(`  ${i}: ${opt.text}`));

  // Check if manuscript was auto-loaded
  const manuscriptLoaded = await page.evaluate(() => {
    const pages = document.querySelectorAll('.pagedjs_page');
    const sentenceCount = document.getElementById('sentence-count').textContent;
    return {
      pageCount: pages.length,
      sentenceCountText: sentenceCount
    };
  });

  console.log('\nManuscript auto-load status:');
  console.log(`  Pages rendered: ${manuscriptLoaded.pageCount}`);
  console.log(`  Sentence count: ${manuscriptLoaded.sentenceCountText}`);

  // Take screenshot
  await page.screenshot({ path: 'browser-testing/auto-load-test.png' });

  if (manuscriptLoaded.pageCount > 0) {
    console.log('\n✅ Auto-load working! Manuscript rendered on page load.');
  } else {
    console.log('\n❌ Auto-load failed. No pages rendered.');
  }

  await browser.close();
})();
