// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('WriteSys Functional UI Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('complete workflow: load manuscript, select sentence, view sidebar', async ({ page }) => {
    // Step 1: Click load button and wait for completion
    const loadButton = page.locator('#load-button');

    // Set up request/response tracking BEFORE clicking
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/manuscripts/') && response.status() === 200,
      { timeout: 10000 }
    );

    await loadButton.click();

    // Wait for API response
    const response = await responsePromise;
    console.log(`✓ API responded: ${response.status()}`);

    // Wait for sentences to be rendered
    await page.waitForSelector('.sentence', { timeout: 5000 });
    const sentenceCount = await page.locator('.sentence').count();
    console.log(`✓ Rendered ${sentenceCount} sentence spans`);
    expect(sentenceCount).toBeGreaterThan(100);

    // Step 2: Click a sentence
    const firstSentence = page.locator('.sentence').first();
    await firstSentence.click();

    // Wait for sidebar to become visible
    await page.waitForSelector('#annotation-sidebar.visible', { timeout: 5000 });
    console.log('✓ Sidebar opened');

    // Verify sidebar content
    const sidebarVisible = await page.locator('#annotation-sidebar').isVisible();
    expect(sidebarVisible).toBeTruthy();

    console.log('✓ Complete workflow test passed');
  });

  test('load manuscript without errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Setup response promise before clicking
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/manuscripts/'),
      { timeout: 10000 }
    );

    await page.locator('#load-button').click();
    await responsePromise;

    // Wait for sentences
    await page.waitForSelector('.sentence', { timeout: 5000 });

    // Check for errors
    if (consoleErrors.length > 0) {
      console.log('Console errors:', consoleErrors);
    }
    expect(consoleErrors).toHaveLength(0);

    console.log('✓ No console errors during load');
  });

  test('sentence interaction and sidebar', async ({ page }) => {
    // Load manuscript first
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/manuscripts/'),
      { timeout: 10000 }
    );
    await page.locator('#load-button').click();
    await responsePromise;
    await page.waitForSelector('.sentence', { timeout: 5000 });

    // Test sentence interaction
    const firstSentence = page.locator('.sentence').first();

    // Click sentence
    await firstSentence.click();

    // Check sidebar appeared
    const sidebar = page.locator('#annotation-sidebar');
    await expect(sidebar).toHaveClass(/visible/);

    console.log('✓ Sentence click opens sidebar');

    // Close sidebar
    const closeButton = page.locator('#annotation-sidebar .close, #annotation-sidebar button:has-text("×")');
    if (await closeButton.count() > 0) {
      await closeButton.first().click();
      await page.waitForTimeout(500);

      // Check sidebar hidden
      const sidebarClasses = await sidebar.getAttribute('class');
      expect(sidebarClasses).not.toContain('visible');

      console.log('✓ Close button hides sidebar');
    }
  });

  test('create annotation flow (if UI supports it)', async ({ page }) => {
    // Load manuscript
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/manuscripts/'),
      { timeout: 10000 }
    );
    await page.locator('#load-button').click();
    await responsePromise;
    await page.waitForSelector('.sentence', { timeout: 5000 });

    // Click sentence to open sidebar
    await page.locator('.sentence').first().click();
    await page.waitForSelector('#annotation-sidebar.visible', { timeout: 5000 });

    // Look for annotation form or "Add" button
    const addButton = page.locator('#annotation-sidebar button:has-text("Add"), #annotation-sidebar a:has-text("Add")');

    if (await addButton.count() > 0) {
      await addButton.first().click();
      await page.waitForTimeout(500);

      // Check if form appeared
      const form = page.locator('#annotation-form, form');
      if (await form.count() > 0) {
        const formVisible = await form.isVisible();
        console.log(`✓ Annotation form visible: ${formVisible}`);

        // Try to fill form if visible
        if (formVisible) {
          const typeSelect = page.locator('#annotation-type');
          if (await typeSelect.count() > 0) {
            await typeSelect.selectOption('highlight');
            console.log('✓ Selected highlight type');
          }

          const noteInput = page.locator('#annotation-note');
          if (await noteInput.count() > 0 && await noteInput.isVisible()) {
            await noteInput.fill('Test annotation');
            console.log('✓ Filled note field');
          }

          const saveButton = page.locator('button:has-text("Save")');
          if (await saveButton.count() > 0) {
            // Don't actually save in test, just verify button exists
            console.log('✓ Save button found');
          }
        }
      }
    } else {
      console.log('⊘ No add annotation button found (may not be implemented yet)');
    }
  });

  test('verify manuscript rendering quality', async ({ page }) => {
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/manuscripts/'),
      { timeout: 10000 }
    );
    await page.locator('#load-button').click();
    await responsePromise;
    await page.waitForSelector('.sentence', { timeout: 5000 });

    // Check that manuscript has proper structure
    const manuscriptContent = await page.evaluate(() => {
      const container = document.getElementById('manuscript-content');
      return {
        hasParagraphs: container.querySelectorAll('p').length > 0,
        hasHeadings: container.querySelectorAll('h1, h2, h3').length > 0,
        sentenceCount: container.querySelectorAll('.sentence').length,
        allSentencesHaveIds: Array.from(container.querySelectorAll('.sentence')).every(
          s => s.dataset.sentenceId
        )
      };
    });

    console.log(`Manuscript structure:
      - Paragraphs: ${manuscriptContent.hasParagraphs}
      - Headings: ${manuscriptContent.hasHeadings}
      - Sentences: ${manuscriptContent.sentenceCount}
      - All have IDs: ${manuscriptContent.allSentencesHaveIds}`);

    expect(manuscriptContent.sentenceCount).toBeGreaterThan(100);
    expect(manuscriptContent.allSentencesHaveIds).toBeTruthy();

    // Take screenshot for visual verification
    await page.screenshot({ path: 'playwright-report/manuscript-rendered.png', fullPage: true });
    console.log('✓ Screenshot saved');
  });
});
