const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('https://andrewcheong.com/.staging/stories/');
  await page.waitForTimeout(3000);

  // Get ALL CSS rules, especially @page
  const cssInfo = await page.evaluate(() => {
    const results = {
      pageRules: [],
      bodyStyles: {},
      pageStyles: {},
      pageContentStyles: {},
    };

    // Get all @page rules
    for (const sheet of document.styleSheets) {
      try {
        const href = sheet.href || 'inline';
        for (const rule of sheet.cssRules || sheet.rules) {
          if (rule.type === CSSRule.PAGE_RULE) {
            results.pageRules.push({
              selector: rule.selectorText,
              cssText: rule.cssText,
              source: href.includes('book.css') ? 'book.css' : href,
            });
          }
        }
      } catch (e) {
        // CORS
      }
    }

    // Get computed styles
    const body = document.body;
    const bodyStyle = window.getComputedStyle(body);
    results.bodyStyles = {
      fontSize: bodyStyle.fontSize,
      fontFamily: bodyStyle.fontFamily,
      lineHeight: bodyStyle.lineHeight,
    };

    const pagedPage = document.querySelector('.pagedjs_page');
    if (pagedPage) {
      const pageStyle = window.getComputedStyle(pagedPage);
      results.pageStyles = {
        width: pageStyle.width,
        height: pageStyle.height,
        padding: pageStyle.padding,
        boxSizing: pageStyle.boxSizing,
      };
    }

    const pageContent = document.querySelector('.pagedjs_page_content');
    if (pageContent) {
      const contentStyle = window.getComputedStyle(pageContent);
      results.pageContentStyles = {
        width: contentStyle.width,
        height: contentStyle.height,
        padding: contentStyle.padding,
        margin: contentStyle.margin,
      };
    }

    return results;
  });

  console.log('\n=== REFERENCE SITE CSS ===\n');

  console.log('@page rules:');
  cssInfo.pageRules.forEach((rule, i) => {
    console.log(`  ${i + 1}. ${rule.selector || '(default)'} from ${rule.source}`);
    console.log(`     ${rule.cssText}`);
  });

  console.log('\nBody styles:');
  Object.entries(cssInfo.bodyStyles).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });

  console.log('\n.pagedjs_page styles:');
  Object.entries(cssInfo.pageStyles).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });

  console.log('\n.pagedjs_page_content styles:');
  Object.entries(cssInfo.pageContentStyles).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });

  await browser.close();
})();
