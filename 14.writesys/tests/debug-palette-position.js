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

    const debug = await page.evaluate(() => {
      const note = document.querySelector('.sticky-note:not(.uncreated-note)');
      const noteRect = note.getBoundingClientRect();
      const colorCircle = note.querySelector('.sticky-note-color-circle');
      const colorCircleRect = colorCircle.getBoundingClientRect();
      const palette = note.querySelector('.sticky-note-palette');
      const paletteRect = palette.getBoundingClientRect();
      const wrapper = palette.querySelector('div');
      const wrapperRect = wrapper.getBoundingClientRect();
      const circle = wrapper.querySelector('.color-circle');
      const circleRect = circle.getBoundingClientRect();

      // Get computed styles
      const paletteStyle = window.getComputedStyle(palette);
      const wrapperStyle = window.getComputedStyle(wrapper);
      const circleStyle = window.getComputedStyle(circle);

      return {
        noteRight: noteRect.right,
        colorPickerCenter: colorCircleRect.left + colorCircleRect.width / 2,

        paletteRight: paletteRect.right,
        paletteComputedRight: paletteStyle.right,
        paletteWidth: paletteRect.width,

        wrapperRight: wrapperRect.right,
        wrapperWidth: wrapperRect.width,
        wrapperComputedRight: wrapperStyle.right,

        circleRight: circleRect.right,
        circleCenter: circleRect.left + circleRect.width / 2,
        circleComputedRight: circleStyle.right,
        circleWidth: circleRect.width
      };
    });

    console.log('\n=== Debug Info ===');
    console.log('Note right edge:', debug.noteRight);
    console.log('Color picker center:', debug.colorPickerCenter);
    console.log('\nPalette:');
    console.log('  Right edge (actual):', debug.paletteRight);
    console.log('  Right (computed CSS):', debug.paletteComputedRight);
    console.log('  Width:', debug.paletteWidth);
    console.log('\nWrapper:');
    console.log('  Right edge (actual):', debug.wrapperRight);
    console.log('  Right (computed CSS):', debug.wrapperComputedRight);
    console.log('  Width:', debug.wrapperWidth);
    console.log('\nCircle:');
    console.log('  Right edge (actual):', debug.circleRight);
    console.log('  Center:', debug.circleCenter);
    console.log('  Right (computed CSS):', debug.circleComputedRight);
    console.log('  Width:', debug.circleWidth);
    console.log('\nExpected circle center:', debug.noteRight);
    console.log('Actual offset:', debug.circleCenter - debug.noteRight);

  } catch (error) {
    console.error('\n✗ Error:', error.message);
  }

  await browser.close();
})();
