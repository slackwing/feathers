// @ts-check
/**
 * WriteSys End-to-End Tests (Playwright)
 * Consolidated test suite for UI functionality
 * Run: npx playwright test tests/e2e.spec.js
 */

const { test, expect } = require('@playwright/test');

test.describe('WriteSys E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  // ============================================================================
  // SMOKE TESTS - Basic functionality
  // ============================================================================

  test('API health check', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.database).toBe('connected');

    console.log('✓ API health check passed');
  });

  test('page loads with correct title and elements', async ({ page }) => {
    await expect(page).toHaveTitle('WriteSys - Book Annotation System');
    await expect(page.locator('#controls')).toBeVisible();
    await expect(page.locator('#manuscript-content')).toBeVisible();

    // Sidebar should exist but be hidden until sentence is clicked
    const sidebar = page.locator('#annotation-sidebar');
    await expect(sidebar).toHaveCount(1);
    await expect(sidebar).toHaveClass(/hidden/);

    await expect(page.locator('#migration-info')).toBeVisible();

    const repoInput = page.locator('#repo-path');
    await expect(repoInput).toHaveValue('manuscripts/test-repo');

    const fileInput = page.locator('#file-path');
    await expect(fileInput).toHaveValue('the-wildfire.manuscript');
  });

  test('CSS loads correctly', async ({ page }) => {
    const bodyStyles = await page.evaluate(() => {
      const body = document.body;
      const styles = window.getComputedStyle(body);
      return {
        fontFamily: styles.fontFamily,
        backgroundColor: styles.backgroundColor,
      };
    });

    expect(bodyStyles.fontFamily).toContain('Georgia');
    console.log('✓ CSS loaded - Font: ' + bodyStyles.fontFamily);
  });

  test('JavaScript modules load', async ({ page }) => {
    await page.waitForTimeout(2000);

    const rendererExists = await page.evaluate(() => typeof WriteSysRenderer !== 'undefined');
    expect(rendererExists).toBeTruthy();

    const annotationsExists = await page.evaluate(() => typeof WriteSysAnnotations !== 'undefined');
    expect(annotationsExists).toBeTruthy();

    console.log('✓ JavaScript modules loaded');
  });

  // ============================================================================
  // AUTO-LOAD TESTS - Manuscript auto-loading
  // ============================================================================

  test('auto-loads manuscript on page load', async ({ page }) => {
    await page.waitForSelector('.sentence', { timeout: 10000 });

    // Wait for Paged.js to finish rendering all pages
    await page.waitForTimeout(2000);

    const sentenceCount = await page.locator('.sentence').count();
    // After Paged.js pagination, sentence count varies by browser/viewport
    // Just verify we have a reasonable number (>50)
    expect(sentenceCount).toBeGreaterThan(50);

    const migrationInfo = await page.locator('#migration-info').textContent();
    expect(migrationInfo).not.toBe('Loading...');

    console.log(`✓ Auto-loaded ${sentenceCount} sentences`);
  });

  test('auto-load without console errors', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.waitForSelector('.sentence', { timeout: 10000 });

    if (consoleErrors.length > 0) {
      console.log('Console errors:', consoleErrors);
    }
    expect(consoleErrors).toHaveLength(0);

    console.log('✓ No console errors during auto-load');
  });

  // ============================================================================
  // SENTENCE INTERACTION TESTS
  // ============================================================================

  test('sentence click opens sidebar', async ({ page }) => {
    await page.waitForSelector('.sentence', { timeout: 10000 });

    // Wait a bit for click handlers to be attached
    await page.waitForTimeout(1000);

    const firstSentence = page.locator('.sentence').first();
    await firstSentence.click();

    const sidebar = page.locator('#annotation-sidebar');
    await expect(sidebar).toHaveClass(/visible/);

    console.log('✓ Sentence click opens sidebar');
  });

  test('sentence selection CSS behavior', async ({ page }) => {
    await page.waitForSelector('.sentence', { timeout: 10000 });

    // Wait a bit for click handlers to be attached
    await page.waitForTimeout(1000);

    const firstSentence = page.locator('.sentence').first();
    const secondSentence = page.locator('.sentence').nth(1);

    // Click first sentence
    await firstSentence.click();
    await expect(firstSentence).toHaveClass(/selected/);

    // Hover over selected sentence - should stay highlighted
    await firstSentence.hover();
    await page.waitForTimeout(200);
    const selectedBg = await firstSentence.evaluate(el =>
      window.getComputedStyle(el).backgroundColor
    );
    expect(selectedBg).not.toBe('rgba(0, 0, 0, 0)');
    expect(selectedBg).not.toBe('transparent');

    // Hover over second sentence while first is selected
    await secondSentence.hover();
    await page.waitForTimeout(200);

    // First should still be selected
    await expect(firstSentence).toHaveClass(/selected/);

    console.log('✓ Selection CSS behavior correct');
  });

  test('close sidebar button works', async ({ page }) => {
    await page.waitForSelector('.sentence', { timeout: 10000 });

    // Wait a bit for click handlers to be attached
    await page.waitForTimeout(1000);

    await page.locator('.sentence').first().click();
    await page.waitForSelector('#annotation-sidebar.visible', { timeout: 5000 });

    const closeButton = page.locator('#close-sidebar');
    if (await closeButton.count() > 0) {
      await closeButton.click();
      await page.waitForTimeout(500);

      const sidebar = page.locator('#annotation-sidebar');
      const sidebarClasses = await sidebar.getAttribute('class');
      expect(sidebarClasses).toContain('hidden');

      console.log('✓ Close button hides sidebar');
    }
  });

  // ============================================================================
  // RENDERING QUALITY TESTS
  // ============================================================================

  test('manuscript has proper structure', async ({ page }) => {
    await page.waitForSelector('.sentence', { timeout: 10000 });

    const manuscriptStructure = await page.evaluate(() => {
      // Check in Paged.js container if it exists
      const container = document.querySelector('.pagedjs_pages') || document.getElementById('manuscript-content');
      return {
        hasParagraphs: container.querySelectorAll('p').length > 0,
        hasHeadings: container.querySelectorAll('h1, h2, h3').length > 0,
        sentenceCount: container.querySelectorAll('.sentence').length,
        allSentencesHaveIds: Array.from(container.querySelectorAll('.sentence')).every(
          s => s.dataset.sentenceId
        )
      };
    });

    expect(manuscriptStructure.sentenceCount).toBeGreaterThan(100);
    expect(manuscriptStructure.allSentencesHaveIds).toBeTruthy();

    console.log(`✓ Manuscript structure verified - ${manuscriptStructure.sentenceCount} sentences`);
  });

  test('Paged.js creates pages correctly', async ({ page }) => {
    await page.waitForSelector('.sentence', { timeout: 10000 });
    await page.waitForTimeout(2000); // Wait for Paged.js

    const pageCount = await page.locator('.pagedjs_page').count();
    expect(pageCount).toBeGreaterThan(5);

    const firstPageBg = await page.locator('.pagedjs_page').first().evaluate(
      el => window.getComputedStyle(el).backgroundColor
    );
    expect(firstPageBg).toBe('rgb(255, 255, 255)');

    console.log(`✓ Paged.js created ${pageCount} pages`);
  });

  test('controls are positioned correctly', async ({ page }) => {
    const controlsBox = await page.locator('#controls').boundingBox();
    expect(controlsBox).not.toBeNull();
    expect(controlsBox.y).toBe(0);

    console.log('✓ Controls positioned at top');
  });

  // ============================================================================
  // API TESTS
  // ============================================================================

  test('API migrations endpoint works', async ({ request }) => {
    const latestResponse = await request.get('/api/migrations/latest?manuscript_id=1');
    expect(latestResponse.ok()).toBeTruthy();
    const migration = await latestResponse.json();

    const response = await request.get(
      `/api/migrations/${migration.migration_id}/manuscript?repo=manuscripts/test-repo&file=the-wildfire.manuscript`
    );

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.markdown).toBeDefined();
    expect(data.sentences).toBeDefined();
    expect(data.sentences.length).toBeGreaterThan(200);

    console.log(`✓ API returned ${data.sentences.length} sentences`);
  });

  // ============================================================================
  // ANNOTATION TESTS (if UI supports it)
  // ============================================================================

  test('annotation form exists when sentence clicked', async ({ page }) => {
    await page.waitForSelector('.sentence', { timeout: 10000 });

    // Wait a bit for click handlers to be attached
    await page.waitForTimeout(1000);

    await page.locator('.sentence').first().click();
    await page.waitForSelector('#annotation-sidebar.visible', { timeout: 5000 });

    const addButton = page.locator('#annotation-sidebar button:has-text("Add"), #annotation-sidebar a:has-text("Add")');

    if (await addButton.count() > 0) {
      await addButton.first().click();
      await page.waitForTimeout(500);

      const form = page.locator('#annotation-form');
      if (await form.count() > 0) {
        const formVisible = await form.isVisible();
        console.log(`✓ Annotation form visible: ${formVisible}`);
      }
    } else {
      console.log('⊘ No add annotation button (may not be implemented yet)');
    }
  });
});
