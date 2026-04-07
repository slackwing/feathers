const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });

  try {
    console.log('Loading WriteSys...');
  // Login first
  await loginAsTestUser(page);

    await page.goto('http://localhost:5003', { waitUntil: 'networkidle', timeout: 10000 });

    await page.waitForSelector('.sentence', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    // Click first sentence
    const firstSentence = await page.$('.sentence');
    await firstSentence.click();
    await new Promise(r => setTimeout(r, 1000));

    // Create test annotation
    await page.evaluate(() => {
      const annotation = {
        annotation_id: 9991,
        sentence_id: 1,
        color: 'yellow',
        note: 'Test note',
        priority: 'none',
        flagged: false,
        tags: []
      };

      if (window.WriteSysAnnotations) {
        window.WriteSysAnnotations.annotations = [annotation];
        window.WriteSysAnnotations.renderStickyNotes();
      }
    });

    await new Promise(r => setTimeout(r, 500));

    // Hover to show circles and palette
    await page.hover('.sticky-note:not(.uncreated-note)');
    await new Promise(r => setTimeout(r, 300));
    await page.hover('.sticky-note-color-circle');
    await new Promise(r => setTimeout(r, 500));

    const positions = await page.evaluate(() => {
      const note = document.querySelector('.sticky-note:not(.uncreated-note)');
      const noteRect = note.getBoundingClientRect();
      const colorCircle = note.querySelector('.sticky-note-color-circle');
      const colorCircleRect = colorCircle.getBoundingClientRect();
      const palette = note.querySelector('.sticky-note-palette');
      const paletteRect = palette.getBoundingClientRect();
      const paletteStyle = window.getComputedStyle(palette);

      return {
        noteTop: noteRect.top,
        colorPickerTop: colorCircleRect.top,
        colorPickerCenterY: colorCircleRect.top + colorCircleRect.height / 2,
        paletteTop: paletteRect.top,
        paletteComputedTop: paletteStyle.top,
        paletteComputedTransform: paletteStyle.transform,
        // Relative positions
        paletteRelativeToNote: paletteRect.top - noteRect.top,
        colorPickerRelativeToNote: colorCircleRect.top + colorCircleRect.height / 2 - noteRect.top
      };
    });

    console.log('\n=== Sticky Note Position Analysis ===');
    console.log('Note top:', positions.noteTop);
    console.log('\nColor picker:');
    console.log('  Center Y:', positions.colorPickerCenterY);
    console.log('  Relative to note top:', positions.colorPickerRelativeToNote);
    console.log('\nPalette:');
    console.log('  Top (absolute):', positions.paletteTop);
    console.log('  Computed CSS top:', positions.paletteComputedTop);
    console.log('  Computed transform:', positions.paletteComputedTransform);
    console.log('  Relative to note top:', positions.paletteRelativeToNote);
    console.log('\nExpected:');
    console.log('  Palette should have CSS top: 19px');
    console.log('  With transform: translateY(0) when visible');
    console.log('  Should result in palette 19px below note top');

  } catch (error) {
    console.error('\n✗ Error:', error.message);
  }

  await browser.close();
})();
