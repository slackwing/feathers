const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });

  try {
    console.log('Loading WriteSys...');
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
      const palette = document.querySelector('.sticky-note-palette');
      const paletteRect = palette.getBoundingClientRect();
      const firstWrapper = palette.querySelector('div:first-child');
      const firstWrapperStyle = window.getComputedStyle(firstWrapper);
      const paletteCircles = Array.from(document.querySelectorAll('.sticky-note-palette .color-circle'));

      return {
        noteTop: noteRect.top,
        colorPickerTop: colorCircleRect.top,
        colorPickerCenterY: colorCircleRect.top + colorCircleRect.height / 2,
        paletteTop: paletteRect.top,
        firstWrapperPaddingTop: firstWrapperStyle.paddingTop,
        paletteCircleCenters: paletteCircles.map(c => {
          const r = c.getBoundingClientRect();
          return {
            top: r.top,
            centerY: r.top + r.height / 2,
            bottom: r.bottom
          };
        })
      };
    });

    console.log('\n=== Vertical Position Analysis ===');
    console.log('Note top edge:', positions.noteTop);
    console.log('\nColor picker:');
    console.log('  Top:', positions.colorPickerTop);
    console.log('  Center Y:', positions.colorPickerCenterY);
    console.log('  Relative to note top:', positions.colorPickerCenterY - positions.noteTop);
    console.log('\nPalette container:');
    console.log('  Top:', positions.paletteTop);
    console.log('  Relative to note top:', positions.paletteTop - positions.noteTop);
    console.log('  First wrapper padding-top:', positions.firstWrapperPaddingTop);

    console.log('\nPalette circles:');
    positions.paletteCircleCenters.forEach((c, i) => {
      console.log(`  Circle ${i + 1}:`);
      console.log(`    Top: ${c.top}`);
      console.log(`    Center Y: ${c.centerY}`);
      console.log(`    Relative to note top: ${c.centerY - positions.noteTop}`);
      console.log(`    Distance from color picker center: ${c.centerY - positions.colorPickerCenterY}px`);
    });

    console.log('\n Expected distance between centers: 32px (circle-spacing)');

  } catch (error) {
    console.error('\n✗ Error:', error.message);
  }

  await browser.close();
})();
