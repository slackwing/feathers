const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('https://andrewcheong.com/.staging/stories/');
  await page.waitForTimeout(3000);

  const cssRules = await page.evaluate(() => {
    const rules = [];

    // Search through all stylesheets for @page rules
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules || []) {
          if (rule.cssText && rule.cssText.includes('@page')) {
            rules.push(rule.cssText);
          }
        }
      } catch (e) {
        // CORS might block some stylesheets
      }
    }

    return rules;
  });

  console.log('Reference site @page rules:');
  cssRules.forEach((rule, i) => {
    console.log(`\n${i + 1}. ${rule}`);
  });

  await browser.close();
})();
