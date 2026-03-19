// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('WriteSys Web UI', () => {
  let consoleLogs = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    // Capture console messages
    consoleLogs = [];
    consoleErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else {
        consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
      }
    });

    // Navigate to WriteSys UI
    await page.goto('/');
  });

  test('page loads with correct title and elements', async ({ page }) => {
    // Check title
    await expect(page).toHaveTitle('WriteSys - Book Annotation System');

    // Check key UI elements exist
    await expect(page.locator('#controls')).toBeVisible();
    await expect(page.locator('#manuscript-content')).toBeVisible();
    await expect(page.locator('#annotation-sidebar')).toBeVisible();

    // Check form inputs have default values
    const commitInput = page.locator('#commit-hash');
    await expect(commitInput).toHaveValue('b30bd0f');

    const repoInput = page.locator('#repo-path');
    await expect(repoInput).toHaveValue('manuscripts/test-repo');

    const fileInput = page.locator('#file-path');
    await expect(fileInput).toHaveValue('the-wildfire.md');

    // Take screenshot of initial state
    await page.screenshot({ path: 'playwright-report/01-initial-load.png', fullPage: true });
  });

  test('loads manuscript and wraps sentences', async ({ page }) => {
    // Click load manuscript button
    const loadButton = page.locator('button:has-text("Load Manuscript")');
    await loadButton.click();

    // Wait for status to update
    await page.waitForSelector('#status:has-text("Loading manuscript")', { timeout: 5000 });

    // Wait for manuscript to load (look for sentence spans)
    await page.waitForSelector('.sentence', { timeout: 10000 });

    // Check that sentences were wrapped
    const sentenceCount = await page.locator('.sentence').count();
    expect(sentenceCount).toBeGreaterThan(200); // Should be ~214 for b30bd0f

    // Verify status shows completion
    await page.waitForSelector('#status:has-text("sentences")', { timeout: 5000 });

    // Check console logs for wrapping messages
    const wrappingLogs = consoleLogs.filter(log => log.includes('Wrapped') || log.includes('sentences'));
    expect(wrappingLogs.length).toBeGreaterThan(0);

    // Take screenshot of loaded manuscript
    await page.screenshot({ path: 'playwright-report/02-manuscript-loaded.png', fullPage: true });

    console.log(`\n✓ Loaded ${sentenceCount} sentences`);
    console.log(`✓ Console logs captured: ${consoleLogs.length} messages`);
  });

  test('sentence hover and click interactions', async ({ page }) => {
    // Load manuscript
    await page.locator('button:has-text("Load Manuscript")').click();
    await page.waitForSelector('.sentence', { timeout: 10000 });

    // Get first sentence
    const firstSentence = page.locator('.sentence').first();

    // Hover over sentence (should highlight)
    await firstSentence.hover();

    // Click sentence (should open sidebar)
    await firstSentence.click();

    // Wait for sidebar to be visible
    await expect(page.locator('#annotation-sidebar')).toHaveClass(/visible/);

    // Check that sentence ID is shown in sidebar
    const sentenceIdDisplay = page.locator('#annotation-sidebar .sentence-id');
    await expect(sentenceIdDisplay).toBeVisible();

    // Check that selected sentence has the 'selected' class
    await expect(firstSentence).toHaveClass(/selected/);

    // Take screenshot of selected sentence with sidebar
    await page.screenshot({ path: 'playwright-report/03-sentence-selected.png', fullPage: true });

    console.log('✓ Sentence interaction works correctly');
  });

  test('create highlight annotation', async ({ page }) => {
    // Load manuscript
    await page.locator('button:has-text("Load Manuscript")').click();
    await page.waitForSelector('.sentence', { timeout: 10000 });

    // Click first sentence
    const firstSentence = page.locator('.sentence').first();
    await firstSentence.click();

    // Wait for sidebar
    await page.waitForSelector('#annotation-sidebar.visible', { timeout: 5000 });

    // Click "Add one?" link or "+ Add Annotation" button
    const addButton = page.locator('text=Add one?').or(page.locator('button:has-text("Add Annotation")'));
    await addButton.first().click();

    // Wait for annotation form
    await page.waitForSelector('#annotation-form', { timeout: 5000 });

    // Fill in highlight annotation
    await page.locator('#annotation-type').selectOption('highlight');
    await page.locator('#highlight-color').selectOption('yellow');
    await page.locator('#annotation-note').fill('Great opening line!');

    // Take screenshot before saving
    await page.screenshot({ path: 'playwright-report/04-annotation-form.png', fullPage: true });

    // Click save
    await page.locator('button:has-text("Save")').click();

    // Wait for annotation to appear in list
    await page.waitForSelector('.annotation-item', { timeout: 5000 });

    // Check that sentence now has highlight styling
    await expect(firstSentence).toHaveClass(/annotated-highlight/);

    // Take screenshot after creating annotation
    await page.screenshot({ path: 'playwright-report/05-annotation-created.png', fullPage: true });

    console.log('✓ Highlight annotation created successfully');
  });

  test('create tag annotation', async ({ page }) => {
    // Load manuscript
    await page.locator('button:has-text("Load Manuscript")').click();
    await page.waitForSelector('.sentence', { timeout: 10000 });

    // Click second sentence
    const secondSentence = page.locator('.sentence').nth(1);
    await secondSentence.click();
    await page.waitForSelector('#annotation-sidebar.visible', { timeout: 5000 });

    // Open annotation form
    const addButton = page.locator('text=Add one?').or(page.locator('button:has-text("Add Annotation")'));
    await addButton.first().click();

    // Fill in tag annotation
    await page.locator('#annotation-type').selectOption('tag');
    await page.locator('#tag-value').fill('character');

    // Save
    await page.locator('button:has-text("Save")').click();

    // Wait for annotation to appear
    await page.waitForSelector('.annotation-item', { timeout: 5000 });

    // Check that sentence has tag styling
    await expect(secondSentence).toHaveClass(/annotated-tag/);

    // Take screenshot
    await page.screenshot({ path: 'playwright-report/06-tag-created.png', fullPage: true });

    console.log('✓ Tag annotation created successfully');
  });

  test('create task annotation', async ({ page }) => {
    // Load manuscript
    await page.locator('button:has-text("Load Manuscript")').click();
    await page.waitForSelector('.sentence', { timeout: 10000 });

    // Click third sentence
    const thirdSentence = page.locator('.sentence').nth(2);
    await thirdSentence.click();
    await page.waitForSelector('#annotation-sidebar.visible', { timeout: 5000 });

    // Open annotation form
    const addButton = page.locator('text=Add one?').or(page.locator('button:has-text("Add Annotation")'));
    await addButton.first().click();

    // Fill in task annotation
    await page.locator('#annotation-type').selectOption('task');
    await page.locator('#task-description').fill('Revise this sentence');
    await page.locator('#task-priority').selectOption('P2');

    // Save
    await page.locator('button:has-text("Save")').click();

    // Wait for annotation to appear
    await page.waitForSelector('.annotation-item', { timeout: 5000 });

    // Check that sentence has task styling
    await expect(thirdSentence).toHaveClass(/annotated-task/);

    // Take screenshot
    await page.screenshot({ path: 'playwright-report/07-task-created.png', fullPage: true });

    console.log('✓ Task annotation created successfully');
  });

  test('delete annotation', async ({ page }) => {
    // Load manuscript
    await page.locator('button:has-text("Load Manuscript")').click();
    await page.waitForSelector('.sentence', { timeout: 10000 });

    // Click first sentence (should have annotation from previous test)
    const firstSentence = page.locator('.sentence').first();
    await firstSentence.click();
    await page.waitForSelector('#annotation-sidebar.visible', { timeout: 5000 });

    // Check if annotation exists
    const annotationItem = page.locator('.annotation-item').first();

    if (await annotationItem.isVisible()) {
      // Click delete button
      const deleteButton = annotationItem.locator('button:has-text("Delete")');
      await deleteButton.click();

      // Wait for annotation to be removed
      await page.waitForTimeout(1000);

      // Check that sentence no longer has annotation styling
      const classes = await firstSentence.getAttribute('class');
      expect(classes).not.toContain('annotated-highlight');

      console.log('✓ Annotation deleted successfully');
    } else {
      console.log('⊘ No annotation to delete (tests may not be running in sequence)');
    }

    // Take screenshot
    await page.screenshot({ path: 'playwright-report/08-annotation-deleted.png', fullPage: true });
  });

  test('close sidebar', async ({ page }) => {
    // Load manuscript
    await page.locator('button:has-text("Load Manuscript")').click();
    await page.waitForSelector('.sentence', { timeout: 10000 });

    // Click sentence to open sidebar
    await page.locator('.sentence').first().click();
    await expect(page.locator('#annotation-sidebar')).toHaveClass(/visible/);

    // Click close button
    const closeButton = page.locator('#annotation-sidebar .close');
    await closeButton.click();

    // Sidebar should be hidden
    await expect(page.locator('#annotation-sidebar')).not.toHaveClass(/visible/);

    console.log('✓ Sidebar closes correctly');
  });

  test('no JavaScript errors during full workflow', async ({ page }) => {
    // Load manuscript
    await page.locator('button:has-text("Load Manuscript")').click();
    await page.waitForSelector('.sentence', { timeout: 10000 });

    // Click a sentence
    await page.locator('.sentence').first().click();
    await page.waitForSelector('#annotation-sidebar.visible', { timeout: 5000 });

    // Check for JavaScript errors
    if (consoleErrors.length > 0) {
      console.error('JavaScript errors detected:');
      consoleErrors.forEach(err => console.error(`  - ${err}`));
    }

    expect(consoleErrors.length).toBe(0);

    console.log('✓ No JavaScript errors detected');
    console.log(`✓ Total console messages: ${consoleLogs.length}`);
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Log console output for failed tests
    if (testInfo.status !== testInfo.expectedStatus) {
      console.log('\nConsole logs for failed test:');
      consoleLogs.slice(-20).forEach(log => console.log(log));

      if (consoleErrors.length > 0) {
        console.log('\nConsole errors:');
        consoleErrors.forEach(err => console.log(`ERROR: ${err}`));
      }
    }
  });
});
