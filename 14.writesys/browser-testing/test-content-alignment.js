/**
 * Content Alignment Test
 * Tests that content is properly aligned within page boundaries
 * Created after discovering content was offset from page background (issue #alignment-2026-03-19)
 */

const { chromium } = require('playwright');
const { exit } = require('process');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:5003');
  await page.waitForTimeout(2000);
  await page.click('#load-button');
  await page.waitForTimeout(5000);

  console.log('=== Content Alignment Test ===\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✓ ${message}`);
      passed++;
    } else {
      console.log(`✗ ${message}`);
      failed++;
    }
  }

  const alignment = await page.evaluate(() => {
    const sheet = document.querySelector('.pagedjs_sheet');
    const area = document.querySelector('.pagedjs_area');
    const content = document.querySelector('.pagedjs_page_content');

    const sheetRect = sheet.getBoundingClientRect();
    const areaRect = area.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();

    return {
      sheet: { x: Math.round(sheetRect.x), y: Math.round(sheetRect.y) },
      area: { x: Math.round(areaRect.x), y: Math.round(areaRect.y) },
      content: { x: Math.round(contentRect.x), y: Math.round(contentRect.y) },
    };
  });

  // Expected offsets from sheet
  const expectedOffsetX = 48;  // 0.5in left margin
  const expectedOffsetY = 72;  // 0.75in top margin

  const actualOffsetX = alignment.area.x - alignment.sheet.x;
  const actualOffsetY = alignment.area.y - alignment.sheet.y;

  console.log(`Sheet at: (${alignment.sheet.x}, ${alignment.sheet.y})`);
  console.log(`Area at: (${alignment.area.x}, ${alignment.area.y})`);
  console.log(`Content at: (${alignment.content.x}, ${alignment.content.y})`);
  console.log(`\nExpected offset: (${expectedOffsetX}, ${expectedOffsetY})`);
  console.log(`Actual offset: (${actualOffsetX}, ${actualOffsetY})`);

  // Test: Area should be offset by margin amounts (within 2px tolerance)
  const xAligned = Math.abs(actualOffsetX - expectedOffsetX) <= 2;
  const yAligned = Math.abs(actualOffsetY - expectedOffsetY) <= 2;

  assert(xAligned, `Content horizontally aligned (offset ${actualOffsetX}px, expected ${expectedOffsetX}px)`);
  assert(yAligned, `Content vertically aligned (offset ${actualOffsetY}px, expected ${expectedOffsetY}px)`);

  // Test: Content should be at same position as area
  const contentAlignedX = alignment.content.x === alignment.area.x;
  const contentAlignedY = alignment.content.y === alignment.area.y;

  assert(contentAlignedX && contentAlignedY, `Content fills area exactly (both at ${alignment.area.x}, ${alignment.area.y})`);

  // Summary
  console.log('\n=== Test Summary ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  await browser.close();

  if (failed > 0) {
    console.log('\n❌ Content alignment test FAILED');
    console.log('Content is misaligned with page background!');
    exit(1);
  } else {
    console.log('\n✅ Content alignment test passed');
    exit(0);
  }
})();
