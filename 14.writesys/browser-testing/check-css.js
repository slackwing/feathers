const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5003', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  
  // Check computed styles for h1 and p
  const h1Style = await page.evaluate(() => {
    const h1 = document.querySelector('h1');
    if (h1) {
      const style = window.getComputedStyle(h1);
      return {
        display: style.display,
        marginTop: style.marginTop,
        marginBottom: style.marginBottom
      };
    }
    return null;
  });
  
  const pStyle = await page.evaluate(() => {
    const p = document.querySelector('p');
    if (p) {
      const style = window.getComputedStyle(p);
      return {
        display: style.display,
        margin: style.margin,
        textIndent: style.textIndent
      };
    }
    return null;
  });
  
  console.log('H1 computed style:', JSON.stringify(h1Style, null, 2));
  console.log('\nP computed style:', JSON.stringify(pStyle, null, 2));
  
  await browser.close();
})();
