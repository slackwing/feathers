// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('WriteSys Smoke Tests', () => {
  test('API health check', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.database).toBe('connected');

    console.log('✓ API health check passed');
  });

  test('UI page loads', async ({ page }) => {
    await page.goto('/');

    // Check title
    await expect(page).toHaveTitle('WriteSys - Book Annotation System');

    // Wait for page to fully load
    await page.waitForLoadState('networkidle');

    // Check essential elements exist in DOM (not necessarily visible due to Paged.js)
    const controls = page.locator('#controls');
    const manuscriptContent = page.locator('#manuscript-content');

    // Check elements are attached to DOM
    await expect(controls).toBeAttached();
    await expect(manuscriptContent).toBeAttached();

    // Try to check visibility, but don't fail if Paged.js hides them
    const controlsVisible = await controls.isVisible().catch(() => false);
    const contentVisible = await manuscriptContent.isVisible().catch(() => false);

    console.log('✓ UI page loads correctly');
    console.log(`  - Controls attached: true, visible: ${controlsVisible}`);
    console.log(`  - Content attached: true, visible: ${contentVisible}`);
  });

  test('CSS loads', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check that book.css is loaded by verifying styles on body
    const bodyStyles = await page.evaluate(() => {
      const body = document.body;
      const styles = window.getComputedStyle(body);
      return {
        fontFamily: styles.fontFamily,
        backgroundColor: styles.backgroundColor,
      };
    });

    // Body should have serif font from book.css
    expect(bodyStyles.fontFamily).toContain('Baskerville');

    console.log('✓ CSS loaded successfully');
    console.log(`  - Font: ${bodyStyles.fontFamily}`);
    console.log(`  - Background: ${bodyStyles.backgroundColor}`);
  });

  test('JavaScript modules load', async ({ page }) => {
    const consoleLogs = [];

    page.on('console', msg => {
      consoleLogs.push(msg.text());
    });

    await page.goto('/');

    // Wait a moment for scripts to load
    await page.waitForTimeout(2000);

    // Check that renderer.js loaded (creates WriteSysRenderer)
    const rendererExists = await page.evaluate(() => typeof WriteSysRenderer !== 'undefined');
    expect(rendererExists).toBeTruthy();

    // Check that annotations.js loaded (creates WriteSysAnnotations)
    const annotationsExists = await page.evaluate(() => typeof WriteSysAnnotations !== 'undefined');
    expect(annotationsExists).toBeTruthy();

    console.log('✓ JavaScript modules loaded');
    console.log(`✓ Console messages: ${consoleLogs.length}`);
  });

  test('API manuscript endpoint works', async ({ request }) => {
    const response = await request.get(
      '/api/manuscripts/b30bd0f?repo=manuscripts/test-repo&file=the-wildfire.md'
    );

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.markdown).toBeDefined();
    expect(data.sentences).toBeDefined();
    expect(data.sentences.length).toBeGreaterThan(200);

    console.log(`✓ API returned ${data.sentences.length} sentences`);
    console.log(`✓ Markdown length: ${data.markdown.length} chars`);
  });
});
