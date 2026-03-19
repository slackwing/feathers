const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });

  page.on('console', msg => console.log('BROWSER:', msg.text()));

  await page.goto('http://localhost:5003?v=' + Date.now());
  await page.waitForTimeout(1000);

  await page.fill('#commit-hash', '3d3f5da');
  await page.click('#load-button');
  await page.waitForTimeout(5000);

  // Check all stylesheets for @page rules
  const allPageRules = await page.evaluate(() => {
    const rules = [];
    Array.from(document.styleSheets).forEach((sheet, sheetIndex) => {
      try {
        Array.from(sheet.cssRules || []).forEach((rule, ruleIndex) => {
          if (rule.cssText && (rule.cssText.includes('@page') || rule.cssText.includes('margin'))) {
            rules.push({
              sheet: sheetIndex,
              rule: ruleIndex,
              text: rule.cssText
            });
          }
        });
      } catch (e) {
        // CORS
      }
    });
    return rules;
  });

  console.log('All @page rules found:');
  allPageRules.forEach(r => console.log(r.text));

  await browser.close();
})();
