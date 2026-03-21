/**
 * Comprehensive WriteSys UI Test Suite
 * Tests that the UI matches the reference design at andrewcheong.com/.staging/stories/
 */

const { chromium } = require('playwright');
const { exit } = require('process');

async function runTests() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

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

  try {
    console.log('=== WriteSys UI Test Suite ===\n');

    // Load the page
    await page.goto('http://localhost:5003');
    await page.waitForTimeout(8000); // Wait for auto-load to complete

    // Test 1: Controls visible on page load
    const controlsVisibleBefore = await page.locator('#controls').isVisible();
    assert(controlsVisibleBefore, 'Controls are visible on page load');

    // Test 2: Commit dropdown populated from database
    const dropdownOptions = await page.evaluate(() => {
      const select = document.getElementById('commit-select');
      return Array.from(select.options).map(opt => opt.value).filter(v => v !== '');
    });
    assert(dropdownOptions.length > 0, `Commit dropdown populated (found ${dropdownOptions.length} commits)`);

    // Test 3: Latest commit auto-selected
    const selectedCommit = await page.evaluate(() => {
      return document.getElementById('commit-select').value;
    });
    assert(selectedCommit === dropdownOptions[0], `Latest commit auto-selected (${selectedCommit})`);

    // Test 4: Manuscript auto-loaded on page load
    const pagesRendered = await page.locator('.pagedjs_page').count();
    assert(pagesRendered > 0, `Manuscript auto-loaded on page load (${pagesRendered} pages)`);

    // Continue with other tests (manuscript already loaded)

    // Test 2: Controls still visible after loading
    const controlsVisibleAfter = await page.locator('#controls').isVisible();
    assert(controlsVisibleAfter, 'Controls remain visible after loading manuscript');

    // Test 3: Controls are fixed at top
    const controlsBox = await page.locator('#controls').boundingBox();
    assert(controlsBox && controlsBox.y === 0, 'Controls are positioned at top (y=0)');

    // Test 4: Paged.js created pages
    const pageCount = await page.locator('.pagedjs_page').count();
    assert(pageCount > 0, `Paged.js created pages (found ${pageCount} pages)`);
    assert(pageCount >= 5, `Paged.js created multiple pages (expected ≥5, got ${pageCount})`);

    // Test 5: Controls are OUTSIDE Paged.js container
    const pagedBox = await page.locator('.pagedjs_pages').boundingBox();
    if (pagedBox && controlsBox) {
      const controlsOutside = (controlsBox.y + controlsBox.height) <= pagedBox.y;
      assert(controlsOutside, 'Controls are outside (above) Paged.js container');
    }

    // Test 6: Pages have white background
    const firstPageBg = await page.locator('.pagedjs_page').first().evaluate(
      el => window.getComputedStyle(el).backgroundColor
    );
    assert(firstPageBg === 'rgb(255, 255, 255)', `Pages have white background (got ${firstPageBg})`);

    // Test 7: Pages have border and shadow
    const firstPageBorder = await page.locator('.pagedjs_page').first().evaluate(
      el => window.getComputedStyle(el).borderWidth
    );
    const firstPageShadow = await page.locator('.pagedjs_page').first().evaluate(
      el => window.getComputedStyle(el).boxShadow
    );
    assert(firstPageBorder !== '0px', `Pages have border (got ${firstPageBorder})`);
    assert(firstPageShadow !== 'none', `Pages have shadow`);

    // Test 8: Paged.js container has gray background
    const pagedBg = await page.locator('.pagedjs_pages').evaluate(
      el => window.getComputedStyle(el).backgroundColor
    );
    assert(pagedBg === 'rgb(245, 245, 245)', `Container has gray background (got ${pagedBg})`);

    // Test 9: Content is justified
    const firstP = await page.locator('.pagedjs_page p').first().evaluate(
      el => window.getComputedStyle(el).textAlign
    );
    assert(firstP === 'justify', `Paragraphs are justified (got ${firstP})`);

    // Test 10: Page has content
    const allParagraphs = await page.locator('.pagedjs_page').first().locator('p').all();
    const hasContent = allParagraphs.some(async (p) => {
      const text = await p.textContent();
      return text && text.length > 50;
    });
    const longParagraph = await page.locator('.pagedjs_page p').evaluateAll(ps =>
      ps.find(p => p.textContent.length > 50)?.textContent.substring(0, 80)
    );
    assert(longParagraph, `Pages have text content (found: "${longParagraph}...")`);

    // Test 11: Sentences are wrapped
    const sentenceCount = await page.locator('.sentence').count();
    assert(sentenceCount > 0, `Sentences are wrapped (found ${sentenceCount} .sentence elements)`);

    // Test 12: Page numbers are rendered (hidden on first page, visible on others)
    const pageNums = await page.evaluate(() => {
      const margins = document.querySelectorAll('.pagedjs_margin-bottom-right');
      const first = margins[0]?.querySelector('.pagedjs_margin-content');
      const second = margins[1]?.querySelector('.pagedjs_margin-content');
      return {
        firstPageContent: first ? window.getComputedStyle(first, '::after').content : 'N/A',
        secondPageContent: second ? window.getComputedStyle(second, '::after').content : 'N/A'
      };
    });
    assert(pageNums.firstPageContent === 'none' && pageNums.secondPageContent === 'counter(page)',
      `Page numbers work correctly (first: ${pageNums.firstPageContent}, second: ${pageNums.secondPageContent})`);

    // Test 13: Annotation sidebar exists
    const sidebar = await page.locator('#annotation-sidebar').count();
    assert(sidebar === 1, 'Annotation sidebar exists');

    // Test 14: Page dimensions match reference (within 5px tolerance)
    const pageBox = await page.locator('.pagedjs_page').first().boundingBox();
    const expectedWidth = 576;  // 6in at 96 DPI
    const expectedHeight = 864; // 9in at 96 DPI
    const widthMatch = Math.abs(pageBox.width - expectedWidth) <= 5;
    const heightMatch = Math.abs(pageBox.height - expectedHeight) <= 5;
    assert(widthMatch && heightMatch, `Page size matches reference (${pageBox.width}×${pageBox.height} vs ${expectedWidth}×${expectedHeight})`);

    // Test 15: Content area dimensions match reference (within 5px tolerance)
    const contentBox = await page.locator('.pagedjs_page_content').first().boundingBox();
    const expectedContentWidth = 480;  // With 0.5in margins
    const expectedContentHeight = 720; // With 0.75in margins
    const contentWidthMatch = Math.abs(contentBox.width - expectedContentWidth) <= 5;
    const contentHeightMatch = Math.abs(contentBox.height - expectedContentHeight) <= 5;
    assert(contentWidthMatch && contentHeightMatch, `Content area matches reference (${contentBox.width}×${contentBox.height} vs ${expectedContentWidth}×${expectedContentHeight})`);

    // Test 16: Short dialogue lines don't have stretched justification
    const dialogueSpacing = await page.evaluate(() => {
      const paragraphs = Array.from(document.querySelectorAll('.pagedjs_page p'));
      const waitedLine = paragraphs.find(p => p.textContent.trim() === 'I waited a second.');
      if (!waitedLine) return { found: false };

      // Check word spacing - should be normal (0px or close to it), not stretched
      const computedWordSpacing = window.getComputedStyle(waitedLine).wordSpacing;
      const wordSpacingPx = parseFloat(computedWordSpacing);

      return {
        found: true,
        wordSpacing: computedWordSpacing,
        isNormal: wordSpacingPx <= 1, // Allow up to 1px variance
        textAlign: window.getComputedStyle(waitedLine).textAlign
      };
    });
    assert(dialogueSpacing.found && dialogueSpacing.isNormal,
      `Short dialogue lines have normal word spacing (found: ${dialogueSpacing.found}, spacing: ${dialogueSpacing.wordSpacing}, expected ≤1px)`);

    // Take screenshot for visual inspection
    await page.screenshot({ path: 'browser-testing/test-complete.png', fullPage: true });

    // Summary
    console.log('\n=== Test Summary ===');
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total: ${passed + failed}`);
    console.log(`\nScreenshot saved to browser-testing/test-complete.png`);

    if (failed > 0) {
      console.log('\n❌ Some tests failed');
      await browser.close();
      exit(1);
    } else {
      console.log('\n✅ All tests passed!');
      await browser.close();
      exit(0);
    }

  } catch (error) {
    console.error('\n❌ Test suite crashed:', error);
    await browser.close();
    exit(1);
  }
}

runTests();
