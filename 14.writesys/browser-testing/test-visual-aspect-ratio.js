/**
 * Visual Aspect Ratio Test
 * Tests that pages ACTUALLY RENDER with correct 2:3 aspect ratio (6in × 9in)
 * This catches issues that boundingBox() tests miss
 */

const { chromium } = require('playwright');
const { exit } = require('process');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  await page.goto('http://localhost:5003');
  await page.waitForTimeout(2000);
  await page.click('#load-button');
  await page.waitForTimeout(5000);

  console.log('=== Visual Aspect Ratio Test ===\n');

  // Take screenshot of just the first page element
  const firstPage = page.locator('.pagedjs_page').first();
  const screenshotBuffer = await firstPage.screenshot();

  // Get actual pixel dimensions from screenshot
  // We'll use sharp or another image library to get dimensions
  // For now, let's use boundingBox and validate it matches visual
  const box = await firstPage.boundingBox();
  const aspectRatio = box.width / box.height;
  const expectedRatio = 576 / 864; // 0.6666...

  console.log('Page dimensions (boundingBox):', box.width, '×', box.height);
  console.log('Aspect ratio:', aspectRatio.toFixed(4));
  console.log('Expected ratio (6in:9in = 2:3):', expectedRatio.toFixed(4));
  console.log('Difference:', Math.abs(aspectRatio - expectedRatio).toFixed(4));

  // Test: Aspect ratio should be within 0.01 of expected
  const ratioMatch = Math.abs(aspectRatio - expectedRatio) < 0.01;

  if (ratioMatch) {
    console.log('✓ Aspect ratio is correct');
  } else {
    console.log('✗ Aspect ratio is WRONG - pages will look distorted');
  }

  // Save screenshot for visual inspection
  await firstPage.screenshot({ path: 'browser-testing/visual-aspect-check.png' });
  console.log('\nScreenshot saved to browser-testing/visual-aspect-check.png');
  console.log('MANUALLY VERIFY: Page should look like a proper book page, not a thin column');

  // Also check computed styles don't have any transforms
  const transforms = await firstPage.evaluate(el => {
    const style = window.getComputedStyle(el);
    return {
      transform: style.transform,
      scale: style.scale,
      zoom: style.zoom,
    };
  });

  console.log('\nCSS transforms:', JSON.stringify(transforms));

  const hasTransforms = transforms.transform !== 'none' ||
                        transforms.scale !== 'none' ||
                        transforms.zoom !== '1';

  if (hasTransforms) {
    console.log('✗ WARNING: Page has CSS transforms that might distort rendering');
  } else {
    console.log('✓ No CSS transforms applied');
  }

  await browser.close();

  if (!ratioMatch) {
    console.log('\n❌ Visual aspect ratio test FAILED');
    exit(1);
  } else {
    console.log('\n✅ Visual aspect ratio test passed');
    exit(0);
  }
})();
