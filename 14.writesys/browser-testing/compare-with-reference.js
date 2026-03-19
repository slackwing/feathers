const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('https://andrewcheong.com/.staging/wildfire/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  const refStyles = await page.evaluate(() => {
    const rules = [];
    Array.from(document.styleSheets).forEach((sheet) => {
      try {
        Array.from(sheet.cssRules || []).forEach((rule) => {
          if (rule.cssText && rule.cssText.includes('@page')) {
            rules.push(rule.cssText);
          }
        });
      } catch (e) {}
    });
    return rules;
  });

  console.log('Reference @page rules:');
  refStyles.forEach(r => console.log(r));

  await browser.close();
})();
