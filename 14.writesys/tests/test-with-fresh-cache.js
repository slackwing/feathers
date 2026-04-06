const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    // Clear cache by ignoring cache headers
    ignoreHTTPSErrors: true,
  });

  // Clear service workers and cache
  await context.addInitScript(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for (let registration of registrations) {
          registration.unregister();
        }
      });
    }
  });

  const page = await context.newPage();

  // Collect ALL console messages
  const consoleLogs = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(text);
    console.log(`BROWSER: ${text}`);
  });

  try {
    console.log('=== Testing with Fresh Cache ===\n');

    // Force reload without cache
    await page.goto('http://localhost:5003', { waitUntil: 'networkidle' });
    await page.reload({ waitUntil: 'networkidle' });

    await page.waitForSelector('.sentence', { timeout: 30000 });

    const sentence = await page.locator('.sentence[data-sentence-id="but-as-happens-fbad3020"]').first();
    await sentence.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await sentence.click();
    await page.waitForTimeout(1500);

    const barsBefore = await page.locator('.rainbow-bar').count();
    console.log(`\nRainbow bars BEFORE: ${barsBefore}`);

    const coloredNotes = await page.locator('.sticky-note').all();
    const firstNote = coloredNotes[0];
    await firstNote.hover();
    await page.waitForTimeout(500);

    const trash = await firstNote.locator('.note-trash').first();
    console.log('\n=== CLICKING TRASH ===');
    await trash.click();

    console.log('\nWaiting 3 seconds...');
    await page.waitForTimeout(3000);

    const barsAfter = await page.locator('.rainbow-bar').count();
    console.log(`\nRainbow bars AFTER: ${barsAfter}`);

    console.log('\n=== All Console Logs ===');
    consoleLogs.forEach((log, i) => console.log(`${i + 1}. ${log}`));

    console.log('\nKeeping browser open for inspection...');
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();
