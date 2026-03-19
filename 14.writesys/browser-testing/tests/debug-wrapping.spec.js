// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Debug Sentence Wrapping', () => {
  test('check manuscript loading step by step', async ({ page }) => {
    const consoleLogs = [];
    const consoleErrors = [];

    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      } else {
        consoleLogs.push(text);
      }
      console.log(`[${msg.type()}] ${text}`);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    console.log('\n=== STEP 1: Page loaded ===');
    console.log(`Console logs so far: ${consoleLogs.length}`);

    // Check if load button exists
    const loadButton = page.locator('#load-button');
    const buttonExists = await loadButton.count();
    console.log(`\n=== STEP 2: Load button exists: ${buttonExists > 0} ===`);

    if (buttonExists > 0) {
      console.log('Clicking load button...');
      await loadButton.click();

      // Wait a bit for API call
      await page.waitForTimeout(3000);

      console.log(`\n=== STEP 3: After clicking load button ===`);
      console.log(`Total console logs: ${consoleLogs.length}`);
      console.log('Recent logs:');
      consoleLogs.slice(-10).forEach(log => console.log(`  ${log}`));

      if (consoleErrors.length > 0) {
        console.log('\nConsole errors:');
        consoleErrors.forEach(err => console.log(`  ERROR: ${err}`));
      }

      // Check for sentences
      const sentenceCount = await page.locator('.sentence').count();
      console.log(`\n=== STEP 4: Sentence count: ${sentenceCount} ===`);

      // Check manuscript content
      const manuscriptContent = await page.evaluate(() => {
        const container = document.getElementById('manuscript-content');
        if (!container) return 'Container not found';
        return {
          childCount: container.children.length,
          innerHTML: container.innerHTML.substring(0, 500),
        };
      });

      console.log(`\n=== STEP 5: Manuscript content ===`);
      console.log(`Child count: ${manuscriptContent.childCount}`);
      console.log(`First 500 chars: ${manuscriptContent.innerHTML}`);
    }

    // Take screenshot
    await page.screenshot({ path: 'playwright-report/debug-wrapping.png', fullPage: true });
    console.log('\n✓ Screenshot saved');
  });
});
