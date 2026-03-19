const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:5003');
  await page.waitForTimeout(2000);
  await page.click('#load-button');
  await page.waitForTimeout(5000);

  console.log('\n=== PAGE NUMBER INVESTIGATION ===\n');

  // Check all margin areas on first page
  const marginAreas = await page.evaluate(() => {
    const firstPage = document.querySelector('.pagedjs_page');
    if (!firstPage) return null;

    const areas = {
      bottomLeft: firstPage.querySelector('.pagedjs_margin-bottom-left'),
      bottomCenter: firstPage.querySelector('.pagedjs_margin-bottom-center'),
      bottomRight: firstPage.querySelector('.pagedjs_margin-bottom-right'),
      bottomLeftContent: null,
      bottomCenterContent: null,
      bottomRightContent: null,
    };

    if (areas.bottomLeft) {
      areas.bottomLeftContent = areas.bottomLeft.textContent;
    }
    if (areas.bottomCenter) {
      areas.bottomCenterContent = areas.bottomCenter.textContent;
    }
    if (areas.bottomRight) {
      areas.bottomRightContent = areas.bottomRight.textContent;
      areas.bottomRightStyles = {
        display: window.getComputedStyle(areas.bottomRight).display,
        visibility: window.getComputedStyle(areas.bottomRight).visibility,
        fontSize: window.getComputedStyle(areas.bottomRight).fontSize,
        color: window.getComputedStyle(areas.bottomRight).color,
      };
    }

    return areas;
  });

  if (marginAreas) {
    console.log('Bottom margin areas:');
    console.log(`  Left: ${marginAreas.bottomLeft ? `exists, content="${marginAreas.bottomLeftContent}"` : 'not found'}`);
    console.log(`  Center: ${marginAreas.bottomCenter ? `exists, content="${marginAreas.bottomCenterContent}"` : 'not found'}`);
    console.log(`  Right: ${marginAreas.bottomRight ? `exists, content="${marginAreas.bottomRightContent}"` : 'not found'}`);

    if (marginAreas.bottomRight) {
      console.log('  Right area styles:', marginAreas.bottomRightStyles);
    }
  } else {
    console.log('No .pagedjs_page found');
  }

  // Check @page rules in CSS
  const pageRules = await page.evaluate(() => {
    const rules = [];
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules || sheet.rules) {
          if (rule.type === CSSRule.PAGE_RULE) {
            rules.push({
              selectorText: rule.selectorText,
              cssText: rule.cssText,
            });
          }
        }
      } catch (e) {
        // CORS or other issue
      }
    }
    return rules;
  });

  console.log('\n@page rules found:', pageRules.length);
  pageRules.forEach((rule, i) => {
    console.log(`  ${i + 1}. ${rule.selectorText}`);
    console.log(`     ${rule.cssText.substring(0, 100)}...`);
  });

  await browser.close();
})();
