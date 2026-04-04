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
      const palette = document.querySelector('.sticky-note-palette');

      return {
        inlineStyle: palette.getAttribute('style'),
        styleTop: palette.style.top,
        stylePosition: palette.style.position,
        outerHTML: palette.outerHTML.substring(0, 200)
      };
    });

    console.log('\n=== INLINE STYLE DEBUG ===\n');
    console.log('Inline style attribute:', debug.inlineStyle || 'NONE');
    console.log('style.top:', debug.styleTop || 'NONE');
    console.log('style.position:', debug.stylePosition || 'NONE');
    console.log('\nElement HTML:', debug.outerHTML);

  } catch (error) {
    console.error('\n✗ Error:', error.message);
  }

  await browser.close();
})();
