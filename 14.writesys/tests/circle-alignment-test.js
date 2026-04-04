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

    // Hover to show color circle
    await page.hover('.sticky-note:not(.uncreated-note)');
    await new Promise(r => setTimeout(r, 300));

    // Hover over color circle to show palette
    await page.hover('.sticky-note-color-circle');
    await new Promise(r => setTimeout(r, 500));

    // Add debug line on right edge
    await page.evaluate(() => {
      const note = document.querySelector('.sticky-note:not(.uncreated-note)');
      const debugLine = document.createElement('div');
      debugLine.style.position = 'absolute';
      debugLine.style.top = '-10px';
      debugLine.style.right = '0';
      debugLine.style.width = '2px';
      debugLine.style.height = '300px';
      debugLine.style.background = 'red';
      debugLine.style.zIndex = '1000';
      debugLine.style.pointerEvents = 'none';
      note.appendChild(debugLine);
    });

    console.log('Taking circle alignment screenshot...');
    await page.screenshot({
      path: 'tests/screenshots/circle-alignment.png',
      fullPage: false
    });

    console.log('\n✓ Screenshot saved');
    console.log('Red line shows right edge - all circles should be centered on it.');

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    try {
      await page.screenshot({
        path: 'tests/screenshots/circle-alignment-error.png',
        fullPage: true
      });
    } catch (e) {}
  }

  await browser.close();
})();
