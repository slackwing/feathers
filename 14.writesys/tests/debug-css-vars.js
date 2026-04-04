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

    const vars = await page.evaluate(() => {
      const palette = document.querySelector('.sticky-note-palette');
      const style = window.getComputedStyle(palette);
      const rootStyle = window.getComputedStyle(document.documentElement);

      return {
        circleSize: rootStyle.getPropertyValue('--circle-size'),
        circleBorder: rootStyle.getPropertyValue('--circle-border'),
        circleTotal: rootStyle.getPropertyValue('--circle-total'),
        circleRadius: rootStyle.getPropertyValue('--circle-radius'),
        circleGap: rootStyle.getPropertyValue('--circle-gap'),
        circleSpacing: rootStyle.getPropertyValue('--circle-spacing'),
        paletteTop: style.top
      };
    });

    console.log('\n=== CSS Variable Values ===');
    console.log('--circle-size:', vars.circleSize);
    console.log('--circle-border:', vars.circleBorder);
    console.log('--circle-total:', vars.circleTotal);
    console.log('--circle-radius:', vars.circleRadius);
    console.log('--circle-gap:', vars.circleGap);
    console.log('--circle-spacing:', vars.circleSpacing);
    console.log('\nPalette computed top:', vars.paletteTop);
    console.log('Expected: calc(--circle-spacing - --circle-radius)');

  } catch (error) {
    console.error('\n✗ Error:', error.message);
  }

  await browser.close();
})();
