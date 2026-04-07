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

    const structure = await page.evaluate(() => {
      const note = document.querySelector('.sticky-note:not(.uncreated-note)');
      const colorCircle = note.querySelector('.sticky-note-color-circle');
      const palette = note.querySelector('.sticky-note-palette');

      return {
        noteHTML: note.outerHTML.substring(0, 500),
        colorCircleParent: colorCircle.parentElement.className,
        paletteParent: palette.parentElement.className,
        areSiblings: colorCircle.parentElement === palette.parentElement,
        noteChildren: Array.from(note.children).map(child => ({
          tag: child.tagName,
          class: child.className,
          id: child.id
        }))
      };
    });

    console.log('\n=== DOM STRUCTURE ===\n');
    console.log('Note HTML:', structure.noteHTML);
    console.log('\nColor circle parent class:', structure.colorCircleParent);
    console.log('Palette parent class:', structure.paletteParent);
    console.log('Are siblings?:', structure.areSiblings);
    console.log('\nNote direct children:');
    structure.noteChildren.forEach((child, i) => {
      console.log(`  ${i + 1}. <${child.tag}> class="${child.class}" id="${child.id}"`);
    });

  } catch (error) {
    console.error('\n✗ Error:', error.message);
  }

  await browser.close();
})();
