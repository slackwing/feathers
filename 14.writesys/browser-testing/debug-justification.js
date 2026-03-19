const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:5003');
  await page.waitForTimeout(2000);
  await page.click('#load-button');
  await page.waitForTimeout(5000);

  // Find the problematic line
  const lineInfo = await page.evaluate(() => {
    // Search for 'I waited a second'
    const sentences = Array.from(document.querySelectorAll('.sentence'));
    const target = sentences.find(s => s.textContent.includes('I waited a second'));

    if (!target) return { found: false };

    const parent = target.parentElement;
    const style = window.getComputedStyle(parent);
    const targetStyle = window.getComputedStyle(target);

    return {
      found: true,
      text: target.textContent.trim(),
      parentTag: parent.tagName,
      sentenceTag: target.tagName,
      parentStyle: {
        textAlign: style.textAlign,
        width: style.width,
      },
      sentenceStyle: {
        display: targetStyle.display,
        whiteSpace: targetStyle.whiteSpace,
        wordSpacing: targetStyle.wordSpacing,
      },
      html: target.outerHTML.substring(0, 300),
    };
  });

  console.log('Line with justification issue:');
  console.log(JSON.stringify(lineInfo, null, 2));

  // Check reference site
  const refPage = await browser.newPage();
  await refPage.goto('https://andrewcheong.com/.staging/stories/');
  await refPage.waitForTimeout(3000);

  const refJustify = await refPage.evaluate(() => {
    const p = document.querySelector('.pagedjs_page p');
    return p ? window.getComputedStyle(p).textAlign : 'NOT FOUND';
  });

  console.log('\nReference site paragraph text-align:', refJustify);

  await browser.close();
})();
