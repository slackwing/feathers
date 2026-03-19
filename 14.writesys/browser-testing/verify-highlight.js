const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });

  await page.goto('http://localhost:5003');
  await page.waitForTimeout(1000);

  await page.fill('#commit-hash', '3d3f5da');
  await page.click('#load-button');
  await page.waitForTimeout(5000);

  // Apply highlighting
  const highlighted = await page.evaluate(() => {
    const paragraphs = document.querySelectorAll('.pagedjs_page p');
    let count = 0;
    paragraphs.forEach(p => {
      const text = p.textContent.trim();
      if (text.includes('Hello?') || text.startsWith('I waited') || (text.includes('Hey, A') && text.includes('.'))) {
        p.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
        p.style.outline = '2px solid red';
        count++;
      }
    });
    return count;
  });

  console.log('Highlighted paragraphs:', highlighted);

  // Scroll to first highlighted paragraph
  await page.evaluate(() => {
    const highlighted = Array.from(document.querySelectorAll('.pagedjs_page p')).find(p =>
      p.style.backgroundColor === 'rgba(255, 255, 0, 0.3)'
    );
    if (highlighted) {
      highlighted.scrollIntoView({ block: 'center' });
    }
  });

  await page.waitForTimeout(500);

  await page.screenshot({
    path: 'browser-testing/dialogue-justification-check.png',
    fullPage: false
  });

  console.log('Screenshot saved');

  await browser.close();
})();
