const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to the app
    console.log('Navigating to http://localhost:5003...');
  // Login first
  await loginAsTestUser(page);

    await page.goto('http://localhost:5003');
    await page.waitForLoadState('networkidle');

    // Wait for manuscript to load
    console.log('Waiting for manuscript to load...');
    await page.waitForSelector('.sentence', { timeout: 30000 });

    // Find the "but-as-happens-fbad3020" sentence
    console.log('Looking for but-as-happens sentence...');
    const sentence = await page.locator('.sentence[data-sentence-id="but-as-happens-fbad3020"]').first();

    if (await sentence.count() === 0) {
      console.log('ERROR: Could not find sentence with ID but-as-happens-fbad3020');
      await page.screenshot({ path: 'tests/screenshots/debug-not-found.png', fullPage: true });
    } else {
      console.log('Found sentence!');

      // Get the highlight color classes
      const classes = await sentence.getAttribute('class');
      console.log('Sentence classes:', classes);

      // Check for specific color classes
      const hasRed = classes.includes('highlight-red');
      const hasPurple = classes.includes('highlight-purple');
      const hasGreen = classes.includes('highlight-green');
      const hasBlue = classes.includes('highlight-blue');
      const hasYellow = classes.includes('highlight-yellow');

      console.log('Colors found:');
      console.log('  Red:', hasRed);
      console.log('  Purple:', hasPurple);
      console.log('  Green:', hasGreen);
      console.log('  Blue:', hasBlue);
      console.log('  Yellow:', hasYellow);

      // Get computed style
      const backgroundColor = await sentence.evaluate(el => {
        return window.getComputedStyle(el).backgroundColor;
      });
      console.log('Computed background color:', backgroundColor);

      // Check rainbow bar if it exists
      const rainbowBar = await page.locator('.rainbow-bar[data-sentence-id="but-as-happens-fbad3020"]').first();
      if (await rainbowBar.count() > 0) {
        console.log('\nRainbow bar found!');
        const barHTML = await rainbowBar.innerHTML();
        console.log('Rainbow bar HTML:', barHTML);

        // Get all slices
        const slices = await rainbowBar.locator('.rainbow-slice').all();
        console.log(`Number of rainbow slices: ${slices.length}`);

        for (let i = 0; i < slices.length; i++) {
          const sliceClasses = await slices[i].getAttribute('class');
          console.log(`  Slice ${i}:`, sliceClasses);
        }
      } else {
        console.log('\nNo rainbow bar found for this sentence');
      }

      // Scroll to the sentence
      await sentence.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      // Take a screenshot
      await page.screenshot({ path: 'tests/screenshots/debug-sentence.png', fullPage: true });
      console.log('\nScreenshot saved to tests/screenshots/debug-sentence.png');

      // Click on the sentence to show annotations
      console.log('\nClicking sentence to show annotations...');
      await sentence.click();
      await page.waitForTimeout(1000);

      // Check sticky notes
      const stickyNotes = await page.locator('.sticky-note').all();
      console.log(`\nFound ${stickyNotes.length} sticky notes`);

      for (let i = 0; i < stickyNotes.length; i++) {
        const noteClasses = await stickyNotes[i].getAttribute('class');
        const noteText = await stickyNotes[i].locator('.sticky-note-text').textContent();
        console.log(`  Sticky note ${i}:`, noteClasses);
        console.log(`    Text preview:`, noteText?.substring(0, 50));
      }

      await page.screenshot({ path: 'tests/screenshots/debug-sentence-with-notes.png', fullPage: true });
      console.log('Screenshot with notes saved to tests/screenshots/debug-sentence-with-notes.png');
    }

    console.log('\n=== Debug complete ===');
    console.log('Keeping browser open for 60 seconds for manual inspection...');
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({ path: 'tests/screenshots/debug-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
