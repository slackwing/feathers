/**
 * Compare WriteSys rendering against reference site
 * Reference: https://andrewcheong.com/.staging/stories/
 */

const { chromium } = require('playwright');

async function compareToReference() {
  const browser = await chromium.launch();

  // Load both pages
  const referencePage = await browser.newPage();
  const ourPage = await browser.newPage();

  await referencePage.goto('https://andrewcheong.com/.staging/stories/');
  await referencePage.waitForTimeout(3000); // Wait for Paged.js

  await ourPage.goto('http://localhost:5003');
  await ourPage.waitForTimeout(2000);
  await ourPage.click('#load-button');
  await ourPage.waitForTimeout(5000); // Wait for Paged.js

  console.log('\n=== COMPARING TO REFERENCE ===\n');

  // Compare page dimensions
  const refPageBox = await referencePage.locator('.pagedjs_page').first().boundingBox();
  const ourPageBox = await ourPage.locator('.pagedjs_page').first().boundingBox();

  console.log('Page Dimensions:');
  console.log(`  Reference: ${refPageBox.width}px × ${refPageBox.height}px`);
  console.log(`  Ours:      ${ourPageBox.width}px × ${ourPageBox.height}px`);
  console.log(`  Match: ${refPageBox.width === ourPageBox.width && refPageBox.height === ourPageBox.height ? '✓' : '✗'}`);

  // Compare typography
  const refTypography = await referencePage.locator('.pagedjs_page p').first().evaluate(el => ({
    fontSize: window.getComputedStyle(el).fontSize,
    lineHeight: window.getComputedStyle(el).lineHeight,
    fontFamily: window.getComputedStyle(el).fontFamily,
    textAlign: window.getComputedStyle(el).textAlign,
    textIndent: window.getComputedStyle(el).textIndent,
  }));

  const ourTypography = await ourPage.locator('.pagedjs_page p').first().evaluate(el => ({
    fontSize: window.getComputedStyle(el).fontSize,
    lineHeight: window.getComputedStyle(el).lineHeight,
    fontFamily: window.getComputedStyle(el).fontFamily,
    textAlign: window.getComputedStyle(el).textAlign,
    textIndent: window.getComputedStyle(el).textIndent,
  }));

  console.log('\nTypography:');
  console.log(`  Font Size:   Ref=${refTypography.fontSize} Ours=${ourTypography.fontSize} ${refTypography.fontSize === ourTypography.fontSize ? '✓' : '✗'}`);
  console.log(`  Line Height: Ref=${refTypography.lineHeight} Ours=${ourTypography.lineHeight} ${refTypography.lineHeight === ourTypography.lineHeight ? '✓' : '✗'}`);
  console.log(`  Font Family: Ref=${refTypography.fontFamily.substring(0, 20)}...`);
  console.log(`               Ours=${ourTypography.fontFamily.substring(0, 20)}...`);
  console.log(`  Text Align:  Ref=${refTypography.textAlign} Ours=${ourTypography.textAlign} ${refTypography.textAlign === ourTypography.textAlign ? '✓' : '✗'}`);
  console.log(`  Text Indent: Ref=${refTypography.textIndent} Ours=${ourTypography.textIndent} ${refTypography.textIndent === ourTypography.textIndent ? '✓' : '✗'}`);

  // Compare page area (content box inside page)
  const refPageArea = await referencePage.locator('.pagedjs_page .pagedjs_page_content').first().boundingBox();
  const ourPageArea = await ourPage.locator('.pagedjs_page .pagedjs_page_content').first().boundingBox();

  console.log('\nPage Content Area:');
  console.log(`  Reference: ${refPageArea.width}px × ${refPageArea.height}px`);
  console.log(`  Ours:      ${ourPageArea.width}px × ${ourPageArea.height}px`);

  // Check @page size settings
  const refPageSize = await referencePage.evaluate(() => {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules || sheet.rules) {
          if (rule.type === CSSRule.PAGE_RULE && rule.selectorText === '') {
            return rule.style.cssText;
          }
        }
      } catch (e) {}
    }
    return null;
  });

  const ourPageSize = await ourPage.evaluate(() => {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules || sheet.rules) {
          if (rule.type === CSSRule.PAGE_RULE && rule.selectorText === '') {
            return rule.style.cssText;
          }
        }
      } catch (e) {}
    }
    return null;
  });

  console.log('\n@page CSS Rules:');
  console.log(`  Reference: ${refPageSize}`);
  console.log(`  Ours:      ${ourPageSize}`);

  // Take comparison screenshots
  await referencePage.locator('.pagedjs_page').first().screenshot({
    path: 'browser-testing/reference-page.png'
  });
  await ourPage.locator('.pagedjs_page').first().screenshot({
    path: 'browser-testing/our-page.png'
  });

  console.log('\n✓ Screenshots saved:');
  console.log('  - browser-testing/reference-page.png');
  console.log('  - browser-testing/our-page.png');

  await browser.close();
}

compareToReference().catch(console.error);
