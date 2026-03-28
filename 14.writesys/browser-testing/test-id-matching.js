const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Capture all console messages
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    console.log('BROWSER:', text);
    consoleLogs.push(text);
  });

  // Navigate and wait for loading
  await page.goto('http://localhost:5003', { waitUntil: 'networkidle' });

  // Wait for manuscript to auto-load (we set it up to auto-load latest commit)
  console.log('Waiting for auto-load...');
  await page.waitForTimeout(5000);

  // Check the console output
  console.log('\n=== CONSOLE LOG SUMMARY ===');

  const wrappingLogs = consoleLogs.filter(log =>
    log.includes('Sentence wrapping') ||
    log.includes('wrapped') ||
    log.includes('Disparity') ||
    log.includes('DISPARITIES')
  );

  console.log('\nSentence wrapping results:');
  wrappingLogs.forEach(log => console.log('  ' + log));

  // Check how many sentences were wrapped
  const wrappedCount = await page.evaluate(() => {
    return document.querySelectorAll('.sentence').length;
  });

  console.log(`\nTotal .sentence elements in DOM: ${wrappedCount}`);

  // Check for any disparities
  const hasDisparities = consoleLogs.some(log => log.includes('DISPARITIES'));
  if (hasDisparities) {
    console.log('\n⚠️  DISPARITIES FOUND - Check logs above');
  } else {
    console.log('\n✓ No disparities reported');
  }

  await browser.close();
})();
