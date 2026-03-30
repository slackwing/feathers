const { chromium } = require('playwright');
const { TEST_URL, cleanupTestAnnotations } = require('./test-utils');

(async () => {
  console.log('=== Measuring Element Spacing ===\n');

  await cleanupTestAnnotations();

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(TEST_URL);
    await page.waitForSelector('.pagedjs_page', { timeout: 30000 });
    await page.waitForSelector('.sentence', { timeout: 5000 });
    await page.waitForTimeout(2000);

    // Click a sentence and create annotation
    const firstSentence = await page.locator('.sentence').first();
    await firstSentence.click();
    await page.waitForTimeout(300);

    const yellowCircle = await page.locator('.color-circle[data-color="yellow"]');
    await yellowCircle.click();
    await page.waitForTimeout(500);

    // Measure positions BEFORE trash runs away
    console.log('BEFORE trash runs away:');

    const orangeCircle = await page.locator('.color-circle[data-color="orange"]');
    const trashIcon = await page.locator('#trash-icon');

    const orangeBox = await orangeCircle.boundingBox();
    const trashBox = await trashIcon.boundingBox();

    console.log(`  Orange circle: x=${orangeBox.x.toFixed(1)}, width=${orangeBox.width}`);
    console.log(`  Trash: x=${trashBox.x.toFixed(1)}, width=${trashBox.width}`);

    const gapOrangeToTrash = trashBox.x - (orangeBox.x + orangeBox.width);
    console.log(`  Gap orange->trash: ${gapOrangeToTrash.toFixed(1)}px`);

    // Now click trash to make it run away
    await trashIcon.click();
    await page.waitForTimeout(500);

    console.log('\nAFTER trash runs away:');

    const orangeBox2 = await orangeCircle.boundingBox();
    const cancelX = await page.locator('#cancel-delete');
    const cancelBox2 = await cancelX.boundingBox();
    const trashBox2 = await trashIcon.boundingBox();

    console.log(`  Orange circle: x=${orangeBox2.x.toFixed(1)}, width=${orangeBox2.width}`);
    console.log(`  Cancel X: x=${cancelBox2.x.toFixed(1)}, width=${cancelBox2.width}`);
    console.log(`  Trash: x=${trashBox2.x.toFixed(1)}, width=${trashBox2.width}`);

    const gapOrangeToX2 = cancelBox2.x - (orangeBox2.x + orangeBox2.width);
    const gapXToTrash2 = trashBox2.x - (cancelBox2.x + cancelBox2.width);

    console.log(`  Gap orange->X: ${gapOrangeToX2.toFixed(1)}px`);
    console.log(`  Gap X->trash: ${gapXToTrash2.toFixed(1)}px`);

    const trashMovement = trashBox2.x - trashBox.x;
    console.log(`\nTrash moved: ${trashMovement.toFixed(1)}px to the right`);
    console.log(`Expected: 24px, Actual: ${trashMovement.toFixed(1)}px`);

    await cleanupTestAnnotations();

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
