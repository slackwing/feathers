// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Diagnostic Tests', () => {
  test('check what HTML playwright receives', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Get the raw HTML content
    const htmlContent = await page.content();
    console.log('\n=== HTML LENGTH ===');
    console.log(`Total characters: ${htmlContent.length}`);

    // Check if essential elements exist in the HTML string
    console.log('\n=== HTML CONTENT CHECK ===');
    console.log(`Contains <!DOCTYPE html>: ${htmlContent.includes('<!DOCTYPE html>')}`);
    console.log(`Contains #controls: ${htmlContent.includes('id="controls"')}`);
    console.log(`Contains #manuscript-content: ${htmlContent.includes('id="manuscript-content"')}`);
    console.log(`Contains WriteSys title: ${htmlContent.includes('WriteSys - Book Annotation System')}`);

    // Check for script tags
    console.log('\n=== SCRIPT TAGS ===');
    const scriptMatches = htmlContent.match(/<script[^>]*>/g) || [];
    console.log(`Script tags found: ${scriptMatches.length}`);
    scriptMatches.forEach((script, i) => {
      console.log(`  ${i + 1}. ${script}`);
    });

    // Check for link tags
    console.log('\n=== LINK TAGS ===');
    const linkMatches = htmlContent.match(/<link[^>]*>/g) || [];
    console.log(`Link tags found: ${linkMatches.length}`);
    linkMatches.forEach((link, i) => {
      console.log(`  ${i + 1}. ${link}`);
    });

    // Get computed styles on body
    const bodyStyles = await page.evaluate(() => {
      const body = document.body;
      if (!body) return { error: 'body not found' };
      const styles = window.getComputedStyle(body);
      return {
        display: styles.display,
        visibility: styles.visibility,
        opacity: styles.opacity,
        overflow: styles.overflow,
        height: styles.height,
      };
    });
    console.log('\n=== BODY STYLES ===');
    console.log(JSON.stringify(bodyStyles, null, 2));

    // Check if controls element exists
    const controlsInfo = await page.evaluate(() => {
      const controls = document.getElementById('controls');
      if (!controls) return { exists: false };
      const styles = window.getComputedStyle(controls);
      const rect = controls.getBoundingClientRect();
      return {
        exists: true,
        display: styles.display,
        visibility: styles.visibility,
        position: styles.position,
        zIndex: styles.zIndex,
        rect: {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        },
      };
    });
    console.log('\n=== #CONTROLS INFO ===');
    console.log(JSON.stringify(controlsInfo, null, 2));

    // Check for console errors
    const consoleMessages = [];
    page.on('console', msg => consoleMessages.push(msg.text()));

    // Wait a bit for any async scripts
    await page.waitForTimeout(2000);

    console.log('\n=== CONSOLE MESSAGES ===');
    console.log(`Total messages: ${consoleMessages.length}`);
    if (consoleMessages.length > 0) {
      console.log('Recent messages:');
      consoleMessages.slice(-10).forEach(msg => console.log(`  - ${msg}`));
    }

    // Take screenshot
    await page.screenshot({ path: 'playwright-report/diagnostic.png', fullPage: true });
    console.log('\n✓ Screenshot saved to playwright-report/diagnostic.png');
  });

  test('check network requests', async ({ page }) => {
    const requests = [];
    const responses = [];

    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
      });
    });

    page.on('response', response => {
      responses.push({
        url: response.url(),
        status: response.status(),
        contentType: response.headers()['content-type'],
      });
    });

    await page.goto('/', { waitUntil: 'networkidle' });

    console.log('\n=== NETWORK REQUESTS ===');
    console.log(`Total requests: ${requests.length}`);
    requests.forEach((req, i) => {
      const resp = responses[i];
      console.log(`${i + 1}. ${req.method} ${req.url}`);
      if (resp) {
        console.log(`   → ${resp.status} ${resp.contentType}`);
      }
    });
  });
});
