const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:5003');
  await page.waitForTimeout(2000);
  await page.click('#load-button');
  await page.waitForTimeout(5000);

  // Debug failure 1: Controls position
  const controlsBox = await page.locator('#controls').boundingBox();
  const pagedBox = await page.locator('.pagedjs_pages').boundingBox();

  console.log('=== Debug Failure 1: Controls Position ===');
  console.log(`Controls: y=${controlsBox.y}, height=${controlsBox.height}, bottom=${controlsBox.y + controlsBox.height}`);
  console.log(`Paged.js: y=${pagedBox.y}, height=${pagedBox.height}`);
  console.log(`Controls bottom (${controlsBox.y + controlsBox.height}) <= Paged start (${pagedBox.y})? ${(controlsBox.y + controlsBox.height) <= pagedBox.y}`);
  console.log(`Gap: ${pagedBox.y - (controlsBox.y + controlsBox.height)}px`);

  // Debug failure 2: Page content
  console.log('\n=== Debug Failure 2: Page Content ===');
  const firstPage = page.locator('.pagedjs_page').first();
  const firstP = firstPage.locator('p').first();

  const pExists = await firstP.count();
  console.log(`First <p> exists: ${pExists > 0}`);

  if (pExists > 0) {
    const text = await firstP.textContent();
    const innerText = await firstP.innerText();
    const innerHTML = await firstP.innerHTML();

    console.log(`textContent: "${text?.substring(0, 100)}"`);
    console.log(`innerText: "${innerText?.substring(0, 100)}"`);
    console.log(`innerHTML: "${innerHTML?.substring(0, 100)}"`);
    console.log(`Length: ${text?.length || 0}`);
  }

  // Check ALL paragraphs
  const allPs = await firstPage.locator('p').all();
  console.log(`\nTotal <p> elements on first page: ${allPs.length}`);

  for (let i = 0; i < Math.min(3, allPs.length); i++) {
    const text = await allPs[i].textContent();
    console.log(`  p[${i}]: length=${text?.length || 0}, text="${text?.substring(0, 50)}..."`);
  }

  await browser.close();
})();
