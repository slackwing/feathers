const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:5003');
  await page.waitForTimeout(2000);
  await page.click('#load-button');
  await page.waitForTimeout(5000);

  // Check the DOM structure
  const structure = await page.evaluate(() => {
    const body = document.body;
    const result = {
      bodyChildren: [],
      manuscriptContent: null,
      appContainer: null,
      pagedPages: null,
    };

    // List all top-level body children
    Array.from(body.children).forEach(child => {
      result.bodyChildren.push({
        id: child.id,
        class: child.className,
        tagName: child.tagName,
        offsetTop: child.offsetTop,
        offsetHeight: child.offsetHeight,
      });
    });

    // Check where manuscript-content is
    const manuscriptContent = document.getElementById('manuscript-content');
    if (manuscriptContent) {
      result.manuscriptContent = {
        parent: manuscriptContent.parentElement?.id || manuscriptContent.parentElement?.className,
        offsetTop: manuscriptContent.offsetTop,
        innerHTML: manuscriptContent.innerHTML.substring(0, 100),
      };
    }

    // Check app-container
    const appContainer = document.getElementById('app-container');
    if (appContainer) {
      result.appContainer = {
        offsetTop: appContainer.offsetTop,
        offsetHeight: appContainer.offsetHeight,
        childCount: appContainer.children.length,
        children: Array.from(appContainer.children).map(c => ({
          id: c.id,
          class: c.className,
          tagName: c.tagName,
        })),
      };
    }

    // Check where pagedjs_pages is
    const pagedPages = document.querySelector('.pagedjs_pages');
    if (pagedPages) {
      result.pagedPages = {
        parent: pagedPages.parentElement?.id || pagedPages.parentElement?.className,
        offsetTop: pagedPages.offsetTop,
        paddingTop: window.getComputedStyle(pagedPages).paddingTop,
      };
    }

    return result;
  });

  console.log('\n=== DOM STRUCTURE ===\n');
  console.log('Body children:');
  structure.bodyChildren.forEach(child => {
    console.log(`  - ${child.tagName}#${child.id || 'no-id'}.${child.class || 'no-class'}`);
    console.log(`    offsetTop: ${child.offsetTop}px, height: ${child.offsetHeight}px`);
  });

  if (structure.manuscriptContent) {
    console.log('\nManuscript content:');
    console.log(`  Parent: ${structure.manuscriptContent.parent}`);
    console.log(`  offsetTop: ${structure.manuscriptContent.offsetTop}px`);
  }

  if (structure.appContainer) {
    console.log('\nApp container:');
    console.log(`  offsetTop: ${structure.appContainer.offsetTop}px`);
    console.log(`  height: ${structure.appContainer.offsetHeight}px`);
    console.log(`  Children: ${structure.appContainer.childCount}`);
    structure.appContainer.children.forEach(c => {
      console.log(`    - ${c.tagName}#${c.id || 'no-id'}.${c.class || 'no-class'}`);
    });
  }

  if (structure.pagedPages) {
    console.log('\nPaged.js pages container:');
    console.log(`  Parent: ${structure.pagedPages.parent}`);
    console.log(`  offsetTop: ${structure.pagedPages.offsetTop}px`);
    console.log(`  paddingTop: ${structure.pagedPages.paddingTop}`);
  }

  await browser.close();
})();
