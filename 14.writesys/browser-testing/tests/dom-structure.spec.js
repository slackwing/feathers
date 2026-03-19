// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('DOM Structure Tests', () => {
  test('dump actual DOM after page load', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000); // Wait for Paged.js

    // Get all elements in body
    const bodyStructure = await page.evaluate(() => {
      const body = document.body;
      const childrenInfo = [];

      for (let i = 0; i < body.children.length; i++) {
        const child = body.children[i];
        childrenInfo.push({
          tagName: child.tagName,
          id: child.id,
          className: child.className,
          childCount: child.children.length,
        });
      }

      return {
        bodyChildCount: body.children.length,
        children: childrenInfo,
      };
    });

    console.log('\n=== BODY CHILDREN ===');
    console.log(`Total direct children: ${bodyStructure.bodyChildCount}`);
    bodyStructure.children.forEach((child, i) => {
      console.log(`${i + 1}. <${child.tagName}> id="${child.id}" class="${child.className}" (${child.childCount} children)`);
    });

    // Check if Paged.js created its structure
    const pagedStructure = await page.evaluate(() => {
      const pagedContainer = document.querySelector('.pagedjs_pages');
      return {
        pagedContainerExists: !!pagedContainer,
        pagedPages: document.querySelectorAll('.pagedjs_page').length,
      };
    });

    console.log('\n=== PAGED.JS STRUCTURE ===');
    console.log(`Paged container exists: ${pagedStructure.pagedContainerExists}`);
    console.log(`Paged pages: ${pagedStructure.pagedPages}`);

    // Look for controls element anywhere in DOM
    const controlsSearch = await page.evaluate(() => {
      // Try multiple ways to find controls
      const byId = document.getElementById('controls');
      const bySelector = document.querySelector('#controls');
      const allControls = document.querySelectorAll('[id="controls"]');

      return {
        getElementById: !!byId,
        querySelector: !!bySelector,
        querySelectorAll: allControls.length,
        bodyHTML: document.body.innerHTML.substring(0, 500),
      };
    });

    console.log('\n=== CONTROLS SEARCH ===');
    console.log(`getElementById('controls'): ${controlsSearch.getElementById}`);
    console.log(`querySelector('#controls'): ${controlsSearch.querySelector}`);
    console.log(`querySelectorAll('[id="controls"]'): ${controlsSearch.querySelectorAll}`);
    console.log(`\nFirst 500 chars of body HTML:`);
    console.log(controlsSearch.bodyHTML);
  });
});
