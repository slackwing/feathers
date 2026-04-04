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
      const noteStyle = window.getComputedStyle(note);

      const colorCircle = note.querySelector('.sticky-note-color-circle');
      const colorCircleRect = colorCircle.getBoundingClientRect();
      const colorCircleStyle = window.getComputedStyle(colorCircle);

      const palette = note.querySelector('.sticky-note-palette');
      const paletteRect = palette.getBoundingClientRect();
      const paletteStyle = window.getComputedStyle(palette);

      // Get all applied CSS rules for palette
      const sheets = Array.from(document.styleSheets);
      let paletteRules = [];
      sheets.forEach(sheet => {
        try {
          const rules = Array.from(sheet.cssRules || []);
          rules.forEach(rule => {
            if (rule.selectorText && rule.selectorText.includes('sticky-note-palette')) {
              paletteRules.push({
                selector: rule.selectorText,
                top: rule.style.top,
                position: rule.style.position
              });
            }
          });
        } catch (e) {
          // Skip CORS stylesheets
        }
      });

      return {
        note: {
          borderBox: { top: noteRect.top, left: noteRect.left, width: noteRect.width, height: noteRect.height },
          padding: noteStyle.padding,
          paddingTop: noteStyle.paddingTop,
          position: noteStyle.position,
          boxSizing: noteStyle.boxSizing
        },
        colorCircle: {
          position: { top: colorCircleRect.top, left: colorCircleRect.left },
          centerY: colorCircleRect.top + colorCircleRect.height / 2,
          cssPosition: colorCircleStyle.position,
          cssTop: colorCircleStyle.top,
          cssRight: colorCircleStyle.right,
          transform: colorCircleStyle.transform
        },
        palette: {
          position: { top: paletteRect.top, left: paletteRect.left },
          cssPosition: paletteStyle.position,
          cssTop: paletteStyle.top,
          cssRight: paletteStyle.right,
          transform: paletteStyle.transform,
          display: paletteStyle.display,
          className: palette.className
        },
        paletteRules: paletteRules,
        calculations: {
          noteTopEdge: noteRect.top,
          colorCircleCenterY: colorCircleRect.top + colorCircleRect.height / 2,
          paletteTop: paletteRect.top,
          paletteRelativeToNote: paletteRect.top - noteRect.top,
          colorCircleRelativeToNote: colorCircleRect.top + colorCircleRect.height / 2 - noteRect.top
        }
      };
    });

    console.log('\n=== COMPREHENSIVE POSITIONING DEBUG ===\n');

    console.log('STICKY NOTE:');
    console.log('  Border box:', debug.note.borderBox);
    console.log('  Padding:', debug.note.padding);
    console.log('  Position:', debug.note.position);
    console.log('  Box-sizing:', debug.note.boxSizing);

    console.log('\nCOLOR PICKER CIRCLE:');
    console.log('  Absolute position:', debug.colorCircle.position);
    console.log('  Center Y:', debug.colorCircle.centerY);
    console.log('  CSS position:', debug.colorCircle.cssPosition);
    console.log('  CSS top:', debug.colorCircle.cssTop);
    console.log('  CSS right:', debug.colorCircle.cssRight);
    console.log('  Transform:', debug.colorCircle.transform);

    console.log('\nPALETTE:');
    console.log('  Absolute position:', debug.palette.position);
    console.log('  CSS position:', debug.palette.cssPosition);
    console.log('  CSS top:', debug.palette.cssTop);
    console.log('  CSS right:', debug.palette.cssRight);
    console.log('  Transform:', debug.palette.transform);
    console.log('  Display:', debug.palette.display);
    console.log('  Class:', debug.palette.className);

    console.log('\nCSS RULES AFFECTING PALETTE:');
    debug.paletteRules.forEach(rule => {
      if (rule.top || rule.position) {
        console.log(`  ${rule.selector}: position=${rule.position}, top=${rule.top}`);
      }
    });

    console.log('\nCALCULATIONS:');
    console.log('  Note top edge:', debug.calculations.noteTopEdge);
    console.log('  Color circle center Y:', debug.calculations.colorCircleCenterY);
    console.log('  Color circle relative to note:', debug.calculations.colorCircleRelativeToNote);
    console.log('  Palette top:', debug.calculations.paletteTop);
    console.log('  Palette relative to note:', debug.calculations.paletteRelativeToNote);
    console.log('\n  ISSUE: Palette CSS says top:19px but renders at', debug.calculations.paletteRelativeToNote + 'px from note top');
    console.log('  DIFFERENCE:', debug.calculations.paletteRelativeToNote - 19, 'px');
    console.log('  Note padding-top:', debug.note.paddingTop);

  } catch (error) {
    console.error('\n✗ Error:', error.message);
  }

  await browser.close();
})();
