const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const refPage = await browser.newPage();
  const ourPage = await browser.newPage();

  await refPage.goto('https://andrewcheong.com/.staging/stories/');
  await refPage.waitForTimeout(3000);

  await ourPage.goto('http://localhost:5003');
  await ourPage.waitForTimeout(2000);
  await ourPage.click('#load-button');
  await ourPage.waitForTimeout(5000);

  const refInfo = await refPage.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const pagedScript = scripts.find(s => s.src.includes('paged'));
    const styles = Array.from(document.querySelectorAll('style'));

    return {
      pagedSrc: pagedScript ? pagedScript.src : null,
      pagedVersion: typeof Paged !== 'undefined' ? (Paged.version || 'unknown') : 'not loaded',
      inlineStyles: styles.length,
      lastInlineStyle: styles[styles.length - 1] ? styles[styles.length - 1].textContent.substring(0, 200) : null,
    };
  });

  const ourInfo = await ourPage.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const pagedScript = scripts.find(s => s.src.includes('paged'));
    const styles = Array.from(document.querySelectorAll('style'));

    return {
      pagedSrc: pagedScript ? pagedScript.src : null,
      pagedVersion: typeof Paged !== 'undefined' ? (Paged.version || 'unknown') : 'not loaded',
      inlineStyles: styles.length,
      lastInlineStyle: styles[styles.length - 1] ? styles[styles.length - 1].textContent.substring(0, 200) : null,
    };
  });

  console.log('\n=== REFERENCE ===');
  console.log('Paged.js source:', refInfo.pagedSrc);
  console.log('Paged.js version:', refInfo.pagedVersion);
  console.log('Inline styles:', refInfo.inlineStyles);
  console.log('Last inline style:', refInfo.lastInlineStyle);

  console.log('\n=== OURS ===');
  console.log('Paged.js source:', ourInfo.pagedSrc);
  console.log('Paged.js version:', ourInfo.pagedVersion);
  console.log('Inline styles:', ourInfo.inlineStyles);
  console.log('Last inline style:', ourInfo.lastInlineStyle);

  await browser.close();
})();
