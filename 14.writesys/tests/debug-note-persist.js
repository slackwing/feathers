const { chromium } = require('playwright');
const { TEST_URL, cleanupTestAnnotations } = require('./test-utils');

(async () => {
  await cleanupTestAnnotations();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Listen for console messages
  page.on('console', msg => console.log('BROWSER:', msg.text()));

  try {
    await page.goto(TEST_URL);
    await page.waitForSelector('.pagedjs_page', { timeout: 30000 });
    await page.waitForSelector('.sentence', { timeout: 5000 });
    await page.waitForTimeout(2000);

    const firstSentence = await page.locator('.sentence').first();
    const sentenceId = await firstSentence.getAttribute('data-sentence-id');
    console.log('Sentence ID:', sentenceId);

    await firstSentence.click();
    await page.waitForTimeout(300);

    // Type note
    const noteInput = await page.locator('#note-input');
    await noteInput.type('Test note');
    await page.waitForTimeout(500);

    // Click yellow to avoid auto-blue complications
    await page.locator('.color-circle[data-color="yellow"]').click();
    await page.waitForTimeout(300);

    // Type more text
    await noteInput.type(' more text');
    console.log('Typed: "Test note more text"');

    // Wait for auto-save
    await page.waitForTimeout(1500);
    console.log('Waited for auto-save...');

    // Check if saved (look for console message)
    await page.waitForTimeout(500);

    // Now reload
    console.log('Reloading page...');
    await page.reload();
    await page.waitForSelector('.pagedjs_page', { timeout: 30000 });
    await page.waitForSelector('.sentence', { timeout: 5000 });
    await page.waitForTimeout(2000);

    // Click the same sentence
    await page.locator(`.sentence[data-sentence-id="${sentenceId}"]`).first().click();
    await page.waitForTimeout(500);

    const noteValue = await page.locator('#note-input').inputValue();
    console.log('Note after reload:', noteValue);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();
