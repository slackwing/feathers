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
    } else {
      console.log('Found sentence!');

      // Scroll to the sentence
      await sentence.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);

      // Click on the sentence to show annotations
      console.log('Clicking sentence to show annotations...');
      await sentence.click();
      await page.waitForTimeout(1000);

      // Check sticky notes container
      const stickyContainer = await page.locator('#sticky-notes-container');
      const containerVisible = await stickyContainer.isVisible();
      console.log('\nSticky notes container visible:', containerVisible);

      if (containerVisible) {
        // Get container position and dimensions
        const containerBox = await stickyContainer.boundingBox();
        console.log('Container bounding box:', containerBox);

        // Get all sticky notes
        const stickyNotes = await page.locator('.sticky-note').all();
        console.log(`\nFound ${stickyNotes.length} sticky notes`);

        // Check first sticky note
        if (stickyNotes.length > 0) {
          const firstNote = stickyNotes[0];
          const firstBox = await firstNote.boundingBox();
          console.log('\nFirst sticky note bounding box:', firstBox);

          // Check if first note has color circle
          const colorCircle = await firstNote.locator('.sticky-note-color-circle').first();
          const circleBox = await colorCircle.boundingBox();
          console.log('First note color circle bounding box:', circleBox);

          // Check if circle is cut off (top of circle < top of viewport annotation area)
          if (circleBox && firstBox) {
            console.log('Circle top:', circleBox.y);
            console.log('Note top:', firstBox.y);
            console.log('Circle extends above note by:', firstBox.y - circleBox.y, 'px');
          }

          // Hover over first note to show circle
          await firstNote.hover();
          await page.waitForTimeout(500);

          // Screenshot showing first note
          await page.screenshot({ path: 'tests/screenshots/debug-first-sticky-note.png', fullPage: true });
          console.log('\nScreenshot saved to tests/screenshots/debug-first-sticky-note.png');
        }

        // Check trash circle in priority section
        const trashCircle = await page.locator('.note-trash').first();
        if (await trashCircle.count() > 0) {
          const trashBox = await trashCircle.boundingBox();
          console.log('\nTrash circle bounding box:', trashBox);

          // Get P-chip for comparison
          const pChip = await page.locator('.priority-chip').first();
          if (await pChip.count() > 0) {
            const pChipBox = await pChip.boundingBox();
            console.log('Priority chip bounding box:', pChipBox);
            console.log('Height difference (trash vs P-chip):', trashBox?.height, 'vs', pChipBox?.height);
          }
        }
      }
    }

    console.log('\n=== Debug complete ===');
    console.log('Keeping browser open for 60 seconds for manual inspection...');
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({ path: 'tests/screenshots/debug-sticky-error.png', fullPage: true });
  } finally {
    await browser.close();
  }
})();
