const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });

  await page.goto('http://localhost:5003');
  await page.waitForTimeout(1000);

  await page.fill('#commit-hash', '3d3f5da');
  await page.click('#load-button');
  await page.waitForTimeout(5000);

  // Search for "Hello?" which comes right before "I waited a second"
  await page.evaluate(() => {
    const allText = document.body.innerText;
    if (allText.includes('Hello?')) {
      // Use TreeWalker to find the text node
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null
      );

      let node;
      while (node = walker.nextNode()) {
        if (node.textContent.includes('Hello?')) {
          node.parentElement.scrollIntoView({ block: 'center' });
          break;
        }
      }
    }
  });

  await page.waitForTimeout(500);

  // Highlight the dialogue paragraphs
  await page.evaluate(() => {
    const paragraphs = document.querySelectorAll('.pagedjs_page p');
    paragraphs.forEach(p => {
      const text = p.textContent.trim();
      // Short dialogue lines - match flexibly
      if (text.includes('Hello?') || text.startsWith('I waited') || (text.includes('Hey, A') && text.includes('.'))) {
        p.style.backgroundColor = 'rgba(255, 255, 0, 0.3)';
        p.style.outline = '2px solid red';
      }
    });
  });

  await page.waitForTimeout(300);

  await page.screenshot({
    path: 'browser-testing/dialogue-justification-check.png',
    fullPage: false
  });

  console.log('Screenshot saved to dialogue-justification-check.png');
  console.log('Yellow highlighted paragraphs should NOT have stretched word spacing');

  await browser.close();
})();
