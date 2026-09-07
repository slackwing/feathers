const { chromium } = require('playwright');
const { TEST_URL, cleanupTestAnnotations } = require('./test-utils');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });

  try {
    // Clean up test manuscript data
    await cleanupTestAnnotations();

    console.log('Loading WriteSys (test.manuscript)...');
  // Login first
  await loginAsTestUser(page);

    await page.goto(TEST_URL, { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForSelector('.sentence', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    console.log('\n=== SIMPLE TEST: Type one character then delete ===');

    // Click first sentence
    const firstSentence = await page.$('.sentence');
    await firstSentence.click();
    await new Promise(r => setTimeout(r, 1000));

    console.log('Grey note visible');
    await page.screenshot({ path: 'tests/screenshots/nvm-1-grey.png' });

    // Type one character
    console.log('Typing "t"...');
    await page.type('.uncreated-note textarea', 't', { delay: 100 });
    await new Promise(r => setTimeout(r, 2000));

    const afterType = await page.evaluate(() => {
      const annotations = window.WriteSysAnnotations ? window.WriteSysAnnotations.annotations : [];
      const note = document.querySelector('.sticky-note:not(.uncreated-note)');
      return {
        annotationCount: annotations.length,
        annotations: annotations,
        hasYellowNote: !!note,
        noteHTML: note ? note.outerHTML.substring(0, 200) : 'none'
      };
    });

    console.log('After typing:', JSON.stringify(afterType, null, 2));
    await page.screenshot({ path: 'tests/screenshots/nvm-2-typed.png' });

    // Delete the character
    console.log('Deleting...');
    await page.keyboard.press('Backspace');
    await new Promise(r => setTimeout(r, 2000));

    const afterDelete = await page.evaluate(() => {
      const annotations = window.WriteSysAnnotations ? window.WriteSysAnnotations.annotations : [];
      const yellowNote = document.querySelector('.sticky-note:not(.uncreated-note)');
      const greyNote = document.querySelector('.uncreated-note');
      return {
        annotationCount: annotations.length,
        hasYellowNote: !!yellowNote,
        hasGreyNote: !!greyNote
      };
    });

    console.log('After delete:', JSON.stringify(afterDelete, null, 2));
    await page.screenshot({ path: 'tests/screenshots/nvm-3-deleted.png' });

    if (afterDelete.annotationCount === 0 && !afterDelete.hasYellowNote && afterDelete.hasGreyNote) {
      console.log('\n✓ SUCCESS: Never mind worked!');
    } else {
      console.log('\n✗ FAIL: Never mind did not work');
      console.log('Expected: 0 annotations, no yellow note, grey note present');
      console.log('Got:', afterDelete);
    }

    console.log('\nCheck the screenshots in tests/screenshots/nvm-*.png');
    await new Promise(r => setTimeout(r, 5000));

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    await page.screenshot({ path: 'tests/screenshots/nvm-error.png', fullPage: true });
  }

  await browser.close();
})();
