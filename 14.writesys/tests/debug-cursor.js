const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('=== Debugging Cursor Issue ===\n');

  // Login first
  await loginAsTestUser(page);

    await page.goto('http://localhost:5003');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.sentence', { timeout: 30000 });

    const sentence = await page.locator('.sentence[data-sentence-id="but-as-happens-fbad3020"]').first();
    await sentence.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await sentence.click();
    await page.waitForTimeout(1000);

    const stickyNotes = await page.locator('.sticky-note').all();
    console.log(`Found ${stickyNotes.length} sticky notes`);

    if (stickyNotes.length > 0) {
      const firstNote = stickyNotes[0];
      await firstNote.hover();
      await page.waitForTimeout(500);

      const colorCircle = await firstNote.locator('.sticky-note-color-circle').first();

      // Get all info about the circle
      const circleInfo = await colorCircle.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          classes: el.className,
          cursor: styles.cursor,
          display: styles.display,
          opacity: styles.opacity,
          visibility: styles.visibility,
          pointerEvents: styles.pointerEvents,
          allCursorRules: Array.from(document.styleSheets)
            .flatMap(sheet => {
              try {
                return Array.from(sheet.cssRules || []);
              } catch (e) {
                return [];
              }
            })
            .filter(rule => rule.selectorText && rule.selectorText.includes('color-circle'))
            .map(rule => ({
              selector: rule.selectorText,
              cursor: rule.style.cursor
            }))
        };
      });

      console.log('\n=== Color Circle Info ===');
      console.log('Classes:', circleInfo.classes);
      console.log('Computed cursor:', circleInfo.cursor);
      console.log('Display:', circleInfo.display);
      console.log('Opacity:', circleInfo.opacity);
      console.log('Visibility:', circleInfo.visibility);
      console.log('Pointer Events:', circleInfo.pointerEvents);

      console.log('\n=== CSS Rules with cursor ===');
      circleInfo.allCursorRules.forEach(rule => {
        if (rule.cursor) {
          console.log(`${rule.selector}: cursor: ${rule.cursor}`);
        }
      });

      // Check if important is working
      const hasImportant = await page.evaluate(() => {
        const styleSheets = Array.from(document.styleSheets);
        for (const sheet of styleSheets) {
          try {
            const rules = Array.from(sheet.cssRules || []);
            for (const rule of rules) {
              if (rule.selectorText && rule.selectorText.includes('.sticky-note-color-circle.color-')) {
                const cursorValue = rule.style.getPropertyValue('cursor');
                const cursorPriority = rule.style.getPropertyPriority('cursor');
                return {
                  selector: rule.selectorText,
                  value: cursorValue,
                  priority: cursorPriority,
                  fullText: rule.cssText
                };
              }
            }
          } catch (e) {
            // Skip CORS errors
          }
        }
        return null;
      });

      console.log('\n=== CSS Rule Details ===');
      console.log(JSON.stringify(hasImportant, null, 2));

      await page.screenshot({
        path: 'tests/screenshots/debug-cursor-detail.png',
        fullPage: true
      });
      console.log('\nScreenshot: tests/screenshots/debug-cursor-detail.png');
    }

    console.log('\nKeeping browser open for 60 seconds...');
    await page.waitForTimeout(60000);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
})();
