const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 1400 } });

  // Listen for console messages
  page.on('console', msg => console.log('BROWSER:', msg.text()));

  await page.goto('http://localhost:5003?nocache=' + Date.now(), { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  await page.fill('#commit-hash', '3d3f5da');
  await page.click('#load-button');
  await page.waitForTimeout(5000);

  // Check if the pageStyles variable contains the new CSS
  const pageStylesCheck = await page.evaluate(() => {
    // Try to get the actual applied styles
    const styleSheets = Array.from(document.styleSheets);
    const pageRules = [];
    
    styleSheets.forEach(sheet => {
      try {
        const rules = Array.from(sheet.cssRules || []);
        rules.forEach(rule => {
          if (rule.cssText && rule.cssText.includes('@page')) {
            pageRules.push(rule.cssText);
          }
        });
      } catch (e) {
        // Cross-origin stylesheets
      }
    });
    
    return { pageRules };
  });

  console.log('Applied @page rules:', JSON.stringify(pageStylesCheck, null, 2));

  await browser.close();
})();
