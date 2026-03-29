const { chromium } = require('playwright');
const { TEST_URL } = require('./test-utils');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Listen for console messages
  page.on('console', msg => console.log('BROWSER:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err));

  try {
    await page.goto(TEST_URL);
    await page.waitForSelector('.pagedjs_page', { timeout: 30000 });
    await page.waitForSelector('.sentence', { timeout: 5000 });

    // Wait longer for Paged.js to fully finish and event handlers to be attached
    await page.waitForTimeout(2000);

    console.log('Page loaded, clicking sentence...');

    const firstSentence = await page.locator('.sentence').first();
    const sentenceId = await firstSentence.getAttribute('data-sentence-id');
    console.log('Sentence ID:', sentenceId);

    await firstSentence.click();
    await page.waitForTimeout(1000);

    // Check what's visible
    const paletteVisible = await page.locator('#color-palette').evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        display: style.display,
        hasVisibleClass: el.classList.contains('visible')
      };
    });

    const noteVisible = await page.locator('#note-container').evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        display: style.display,
        hasVisibleClass: el.classList.contains('visible')
      };
    });

    const tagsVisible = await page.locator('#tags-container').evaluate(el => {
      const style = window.getComputedStyle(el);
      return {
        display: style.display,
        hasVisibleClass: el.classList.contains('visible')
      };
    });

    console.log('Palette:', paletteVisible);
    console.log('Note:', noteVisible);
    console.log('Tags:', tagsVisible);

    await page.screenshot({ path: 'tests/screenshots/debug-note-ui.png', fullPage: true });
    console.log('Screenshot saved to tests/screenshots/debug-note-ui.png');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();
