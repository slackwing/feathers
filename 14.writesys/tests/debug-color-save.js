const { chromium } = require('playwright');
const { TEST_URL, cleanupTestAnnotations } = require('./test-utils');

(async () => {
  await cleanupTestAnnotations();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[updateColor]') || text.includes('Note saved') || text.includes('Auto-default')) {
      console.log('BROWSER:', text);
    }
  });

  try {
    await page.goto(TEST_URL);
    await page.waitForSelector('.pagedjs_page', { timeout: 30000 });
    await page.waitForSelector('.sentence', { timeout: 5000 });
    await page.waitForTimeout(2000);

    const firstSentence = await page.locator('.sentence').first();
    const sentenceId = await firstSentence.getAttribute('data-sentence-id');
    console.log('\n1. Clicking sentence...');
    await firstSentence.click();
    await page.waitForTimeout(300);

    const noteInput = await page.locator('#note-input');
    console.log('2. Typing "T" (will auto-default to blue)...');
    await noteInput.type('T');
    await page.waitForTimeout(500);

    console.log('3. Erasing (should undo auto-blue)...');
    await noteInput.fill('');
    await page.waitForTimeout(1500);

    console.log('4. Typing "Test note" (will auto-default to blue again)...');
    await noteInput.type('Test note');
    await page.waitForTimeout(500);

    console.log('5. Clicking yellow circle...');
    await page.locator('.color-circle[data-color="yellow"]').click();
    await page.waitForTimeout(500);

    console.log('6. Typing " more text"...');
    await noteInput.type(' more text');
    await page.waitForTimeout(300);

    console.log('7. Waiting for auto-save (1.5s)...');
    await page.waitForTimeout(1500);

    console.log('8. Reloading page...');
    await page.reload();
    await page.waitForSelector('.pagedjs_page', { timeout: 30000 });
    await page.waitForSelector('.sentence', { timeout: 5000 });
    await page.waitForTimeout(2000);

    console.log('9. Clicking same sentence after reload...');
    await page.locator(`.sentence[data-sentence-id="${sentenceId}"]`).first().click();
    await page.waitForTimeout(500);

    const noteValue = await page.locator('#note-input').inputValue();
    console.log('\n✓ Note after reload:', `"${noteValue}"`);

  } catch (error) {
    console.error('\n✗ Error:', error.message);
  } finally {
    await browser.close();
  }
})();
