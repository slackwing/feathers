// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('WriteSys with Paged.js Enabled', () => {
  test('load page with Paged.js (production mode)', async ({ page, browserName }) => {
    const consoleErrors = [];
    const consoleWarnings = [];
    const jsErrors = [];

    // Capture all console messages
    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error') {
        consoleErrors.push(text);
        console.log(`[${browserName}] ERROR: ${text}`);
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(text);
      }
    });

    // Capture page errors
    page.on('pageerror', error => {
      jsErrors.push(error.message);
      console.log(`[${browserName}] PAGE ERROR: ${error.message}`);
      console.log(`Stack: ${error.stack}`);
    });

    // Override webdriver detection to force Paged.js to load
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });

    console.log(`\n=== Testing with Paged.js in ${browserName} ===`);

    // Track CSS requests
    const cssRequests = [];
    page.on('response', response => {
      if (response.url().includes('.css')) {
        cssRequests.push({
          url: response.url(),
          status: response.status()
        });
      }
    });

    // Navigate to page
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });

    console.log(`CSS Requests:`, JSON.stringify(cssRequests, null, 2));

    // Wait for Paged.js to load and initialize
    await page.waitForTimeout(5000);

    // Check what CSS is being processed
    const cssInfo = await page.evaluate(() => {
      const stylesheets = [];
      for (const sheet of document.styleSheets) {
        try {
          stylesheets.push({
            href: sheet.href || 'inline',
            rulesCount: sheet.cssRules ? sheet.cssRules.length : 0
          });
        } catch (e) {
          stylesheets.push({ href: sheet.href || 'inline', error: e.message });
        }
      }
      return {
        stylesheetCount: document.styleSheets.length,
        stylesheets: stylesheets
      };
    });
    console.log(`CSS Info:`, JSON.stringify(cssInfo, null, 2));

    // Check if Paged.js loaded
    const pagedJsLoaded = await page.evaluate(() => {
      return typeof window.PagedPolyfill !== 'undefined';
    });
    console.log(`Paged.js loaded: ${pagedJsLoaded}`);

    // Check for the specific Paged.js structure
    const pagedStructure = await page.evaluate(() => {
      return {
        hasPagedContainer: !!document.querySelector('.pagedjs_pages'),
        hasPagedPages: document.querySelectorAll('.pagedjs_page').length,
        bodyChildren: document.body.children.length,
      };
    });
    console.log(`Paged structure:`, pagedStructure);

    // Click load manuscript
    const loadButton = page.locator('#load-button');
    if (await loadButton.count() > 0) {
      const responsePromise = page.waitForResponse(
        response => response.url().includes('/api/manuscripts/'),
        { timeout: 10000 }
      );

      await loadButton.click();
      await responsePromise;

      // Wait for rendering
      await page.waitForTimeout(5000);

      // Check final state
      const finalState = await page.evaluate(() => {
        return {
          sentenceCount: document.querySelectorAll('.sentence').length,
          pagedPages: document.querySelectorAll('.pagedjs_page').length,
        };
      });
      console.log(`Final state:`, finalState);
    }

    // Take screenshot
    await page.screenshot({
      path: `playwright-report/with-pagedjs-${browserName}.png`,
      fullPage: true
    });

    // Report findings
    console.log(`\n=== ${browserName} Results ===`);
    console.log(`Console errors: ${consoleErrors.length}`);
    console.log(`JS errors: ${jsErrors.length}`);

    if (consoleErrors.length > 0) {
      console.log('\nConsole Errors:');
      consoleErrors.forEach(err => console.log(`  - ${err}`));
    }

    if (jsErrors.length > 0) {
      console.log('\nJavaScript Errors:');
      jsErrors.forEach(err => console.log(`  - ${err}`));
    }

    // The test should NOT fail - we want to SEE the errors, not block on them
    // This way we can diagnose what's happening
    console.log(`\n✓ ${browserName} test completed (errors logged above)`);
  });

  test('reproduce Firefox Paged.js CSS error', async ({ page, browserName }) => {
    test.skip(browserName !== 'firefox', 'Firefox-specific test');

    const pagedJsErrors = [];

    page.on('pageerror', error => {
      if (error.message.includes("item doesn't belong to list") ||
          error.message.includes('paged') ||
          error.message.includes('CSS')) {
        pagedJsErrors.push({
          message: error.message,
          stack: error.stack
        });
        console.log(`\n🔴 FOUND THE ERROR!`);
        console.log(`Message: ${error.message}`);
        console.log(`Stack: ${error.stack}`);
      }
    });

    // Force Paged.js to load
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });

    console.log('\n=== Attempting to reproduce Firefox Paged.js error ===');

    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for Paged.js to process
    await page.waitForTimeout(8000);

    console.log(`\nPaged.js errors found: ${pagedJsErrors.length}`);

    if (pagedJsErrors.length > 0) {
      console.log('\n✓ Successfully reproduced the error!');
      pagedJsErrors.forEach((err, i) => {
        console.log(`\nError ${i + 1}:`);
        console.log(`  Message: ${err.message}`);
        console.log(`  Stack: ${err.stack.substring(0, 500)}...`);
      });

      // Take screenshot at moment of error
      await page.screenshot({
        path: 'playwright-report/firefox-pagedjs-error.png',
        fullPage: true
      });
    } else {
      console.log('⚠️  Could not reproduce the error in this run');
    }
  });
});
