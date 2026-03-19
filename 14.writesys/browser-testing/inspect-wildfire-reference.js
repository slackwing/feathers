const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('https://andrewcheong.com/.staging/wildfire/');
  await page.waitForTimeout(3000);

  const info = await page.evaluate(() => {
    // Find "I waited a second" in the reference
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null
    );

    let node;
    let targetNode = null;
    while (node = walker.nextNode()) {
      if (node.textContent.includes('I waited a second')) {
        targetNode = node;
        break;
      }
    }

    if (!targetNode) {
      return { found: false };
    }

    const parent = targetNode.parentElement;
    const paragraph = parent.closest('p');

    const paragraphStyle = window.getComputedStyle(paragraph);
    const parentStyle = window.getComputedStyle(parent);

    return {
      found: true,
      text: targetNode.textContent.trim(),
      parentTag: parent.tagName,
      paragraphTag: paragraph.tagName,
      paragraphStyles: {
        textAlign: paragraphStyle.textAlign,
        textAlignLast: paragraphStyle.textAlignLast,
        hyphens: paragraphStyle.hyphens,
      },
      parentStyles: {
        display: parentStyle.display,
        wordSpacing: parentStyle.wordSpacing,
      }
    };
  });

  console.log('Reference site (wildfire):');
  console.log(JSON.stringify(info, null, 2));

  // Take screenshot of the problematic area
  await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    let node;
    while (node = walker.nextNode()) {
      if (node.textContent.includes('I waited a second')) {
        node.parentElement.scrollIntoView({ block: 'center' });
        node.parentElement.style.backgroundColor = 'yellow';
        break;
      }
    }
  });

  await page.waitForTimeout(500);
  await page.screenshot({ path: 'browser-testing/reference-wildfire-justification.png' });
  console.log('\nScreenshot saved to reference-wildfire-justification.png');

  await browser.close();
})();
