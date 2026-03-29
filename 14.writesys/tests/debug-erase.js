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

    // Type first character to trigger auto-blue
    const noteInput = await page.locator('#note-input');
    await noteInput.type('T');
    await page.waitForTimeout(500);

    let hasBlue = await page.locator(`.sentence[data-sentence-id="${sentenceId}"].highlight-blue`).count();
    console.log('After typing "T", has blue:', hasBlue);

    // Erase the note
    console.log('Erasing note...');
    await noteInput.fill('');
    await page.waitForTimeout(1500);

    hasBlue = await page.locator(`.sentence[data-sentence-id="${sentenceId}"].highlight-blue`).count();
    console.log('After erasing, has blue:', hasBlue);

    // Check classes on sentence
    const classes = await page.locator(`.sentence[data-sentence-id="${sentenceId}"]`).first().evaluate(el => el.className);
    console.log('Sentence classes:', classes);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();
