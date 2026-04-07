const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Collect console messages
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    if (text.includes('[refreshRainbowBars]') || text.includes('rainbow')) {
      console.log(`CONSOLE: ${text}`);
    }
  });

  try {
    console.log('=== Debugging Rainbow Bars Refresh ===\n');

  // Login first
  await loginAsTestUser(page);

    await page.goto('http://localhost:5003');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.sentence', { timeout: 30000 });

    const sentence = await page.locator('.sentence[data-sentence-id="but-as-happens-fbad3020"]').first();
    await sentence.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await sentence.click();
    await page.waitForTimeout(1000);

    const barsBefore = await page.locator('.rainbow-bar').count();
    console.log(`\nRainbow bars BEFORE: ${barsBefore}`);

    const coloredNotes = await page.locator('.sticky-note').all();
    const firstNote = coloredNotes[0];
    await firstNote.hover();
    await page.waitForTimeout(500);

    const trash = await firstNote.locator('.note-trash').first();
    console.log('\nDeleting annotation...');
    await trash.click();

    // Wait and watch for console logs
    console.log('\nWaiting 3 seconds for refresh...');
    await page.waitForTimeout(3000);

    const barsAfter = await page.locator('.rainbow-bar').count();
    console.log(`\nRainbow bars AFTER: ${barsAfter}`);

    console.log('\n=== Console logs with "refresh" or "rainbow" ===');
    const relevantLogs = consoleLogs.filter(log =>
      log.toLowerCase().includes('refresh') || log.toLowerCase().includes('rainbow')
    );
    relevantLogs.forEach(log => console.log(`  ${log}`));

    if (relevantLogs.length === 0) {
      console.log('  (none found - refreshRainbowBars() may not be called)');
    }

    console.log('\n Keeping browser open for 30 seconds...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();
