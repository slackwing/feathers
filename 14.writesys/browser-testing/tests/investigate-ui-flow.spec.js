// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Investigate Actual UI Flow', () => {
  test('trace complete user flow', async ({ page }) => {
    const events = [];

    // Log all console messages
    page.on('console', msg => {
      events.push({ type: 'console', level: msg.type(), text: msg.text() });
    });

    // Log all DOM mutations
    await page.goto('/');

    await page.evaluate(() => {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
              if (node.nodeType === 1) { // Element node
                console.log(`[DOM-ADD] ${node.tagName} ${node.id ? '#' + node.id : ''} ${node.className ? '.' + node.className : ''}`);
              }
            });
          }
          if (mutation.type === 'attributes' && mutation.target.id) {
            console.log(`[DOM-ATTR] #${mutation.target.id} ${mutation.attributeName}="${mutation.target.getAttribute(mutation.attributeName)}"`);
          }
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'data-sentence-id']
      });
    });

    await page.waitForLoadState('networkidle');

    console.log('\n=== INITIAL STATE ===');

    // Check initial button state
    const loadButton = page.locator('#load-button');
    const buttonText = await loadButton.textContent();
    const buttonDisabled = await loadButton.isDisabled();
    console.log(`Load button: "${buttonText}", disabled: ${buttonDisabled}`);

    // Check status element
    const statusElement = page.locator('#status');
    const statusText = await statusElement.textContent();
    console.log(`Status: "${statusText}"`);

    // Check if manuscript container is empty
    const manuscriptContent = await page.evaluate(() => {
      const container = document.getElementById('manuscript-content');
      return {
        innerHTML: container?.innerHTML || 'NOT FOUND',
        childCount: container?.children.length || 0
      };
    });
    console.log(`Manuscript content children: ${manuscriptContent.childCount}`);

    console.log('\n=== CLICKING LOAD BUTTON ===');
    await loadButton.click();

    // Wait a bit and check status updates
    await page.waitForTimeout(100);
    const statusAfterClick = await statusElement.textContent();
    console.log(`Status immediately after click: "${statusAfterClick}"`);

    // Wait for network activity
    const apiResponse = await page.waitForResponse(
      response => response.url().includes('/api/manuscripts/'),
      { timeout: 10000 }
    );
    console.log(`\nAPI Response: ${apiResponse.status()} ${apiResponse.url()}`);

    // Check status after API response
    await page.waitForTimeout(100);
    const statusAfterAPI = await statusElement.textContent();
    console.log(`Status after API: "${statusAfterAPI}"`);

    // Wait for sentences to appear
    try {
      await page.waitForSelector('.sentence', { timeout: 5000 });
      console.log('✓ Sentences appeared');
    } catch (e) {
      console.log('✗ Sentences did not appear within 5s');
    }

    // Check final state
    await page.waitForTimeout(1000);
    const finalStatus = await statusElement.textContent();
    const sentenceCount = await page.locator('.sentence').count();
    console.log(`\nFinal status: "${finalStatus}"`);
    console.log(`Final sentence count: ${sentenceCount}`);

    // Check if sidebar can be opened
    console.log('\n=== TESTING SIDEBAR ===');
    if (sentenceCount > 0) {
      const firstSentence = page.locator('.sentence').first();
      const sentenceText = await firstSentence.textContent();
      console.log(`Clicking first sentence: "${sentenceText.substring(0, 50)}..."`);

      await firstSentence.click();
      await page.waitForTimeout(500);

      const sidebarClasses = await page.locator('#annotation-sidebar').getAttribute('class');
      console.log(`Sidebar classes after click: "${sidebarClasses}"`);

      const sidebarVisible = await page.locator('#annotation-sidebar').isVisible();
      console.log(`Sidebar visible: ${sidebarVisible}`);

      // Check if sidebar has 'visible' class
      const hasVisibleClass = sidebarClasses?.includes('visible');
      console.log(`Has 'visible' class: ${hasVisibleClass}`);
    }

    // Print all events
    console.log(`\n=== TOTAL EVENTS: ${events.length} ===`);
    console.log('Key events:');
    events.filter(e =>
      e.text.includes('Loaded') ||
      e.text.includes('Wrapped') ||
      e.text.includes('Starting') ||
      e.text.includes('[DOM-')
    ).forEach(e => {
      console.log(`  ${e.text}`);
    });

    // Take screenshot
    await page.screenshot({ path: 'playwright-report/ui-flow-investigation.png', fullPage: true });
  });
});
