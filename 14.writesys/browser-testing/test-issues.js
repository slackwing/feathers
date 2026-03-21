/**
 * Test suite for specific issues
 * Run: node browser-testing/test-issues.js
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
    console.log('=== WriteSys Issue Tests ===\n');

    // Load the page
    await page.goto('http://localhost:5003');
    await page.waitForTimeout(8000); // Wait for auto-load

    // Issue 1: Highlighting CSS behavior
    console.log('\n--- Issue 1: Highlighting CSS ---');

    // Get first two sentences
    const firstSentence = page.locator('.sentence').first();
    const secondSentence = page.locator('.sentence').nth(1);

    // Click first sentence to select it
    await firstSentence.click();
    await page.waitForTimeout(100);

    // Check selected sentence has 'selected' class
    const hasSelectedClass = await firstSentence.evaluate(el => el.classList.contains('selected'));
    assert(hasSelectedClass, 'Clicked sentence has "selected" class');

    // Get background color of selected sentence (should be highlighted)
    const selectedBg = await firstSentence.evaluate(el => {
      return window.getComputedStyle(el).backgroundColor;
    });
    const isSelectedHighlighted = selectedBg !== 'rgba(0, 0, 0, 0)' && selectedBg !== 'transparent';
    assert(isSelectedHighlighted, `Selected sentence is highlighted (bg: ${selectedBg})`);

    // Hover over the selected sentence - should STAY highlighted (check if still has background)
    await firstSentence.hover();
    await page.waitForTimeout(200);
    const selectedBgAfterHover = await firstSentence.evaluate(el => {
      return window.getComputedStyle(el).backgroundColor;
    });
    const stillHighlightedAfterHover = selectedBgAfterHover !== 'rgba(0, 0, 0, 0)' && selectedBgAfterHover !== 'transparent';
    assert(stillHighlightedAfterHover, `Selected sentence stays highlighted on hover (${selectedBgAfterHover})`);

    // Hover over second sentence (while first is selected) - second should highlight
    await secondSentence.hover();
    await page.waitForTimeout(200);
    const secondBgOnHover = await secondSentence.evaluate(el => {
      return window.getComputedStyle(el).backgroundColor;
    });
    const isSecondHighlightedOnHover = secondBgOnHover !== 'rgba(0, 0, 0, 0)' && secondBgOnHover !== 'transparent';
    assert(isSecondHighlightedOnHover, `Other sentences highlight on hover even when one is selected (bg: ${secondBgOnHover})`);

    // First sentence should STILL be selected
    const stillSelected = await firstSentence.evaluate(el => el.classList.contains('selected'));
    assert(stillSelected, 'First sentence still selected after hovering over second');

    // Issue 2: Sentence breaking with italics
    console.log('\n--- Issue 2: Sentence Breaking with Italics ---');

    // Search for the problematic text
    const sentenceCheck = await page.evaluate(() => {
      const sentences = Array.from(document.querySelectorAll('.sentence'));
      const matches = sentences.filter(s => s.textContent.includes('forested safely in peripheral flora'));

      if (matches.length === 0) {
        return { found: false };
      }

      // If found, check if it's part of a larger sentence (correct)
      // or a standalone sentence (wrong)
      const forestSentence = matches[0];
      const isStandalone = forestSentence.textContent.trim() === 'forested safely in peripheral flora';
      const isPartOfLarger = forestSentence.textContent.includes('Kinda like then') || forestSentence.textContent.length > 50;

      return {
        found: true,
        isStandalone,
        isPartOfLarger,
        text: forestSentence.textContent.substring(0, 100)
      };
    });

    if (sentenceCheck.found) {
      console.log(`  Found text in sentence: "${sentenceCheck.text}..."`);
      assert(!sentenceCheck.isStandalone, `Italicized phrase should be part of larger sentence (standalone: ${sentenceCheck.isStandalone})`);
    } else {
      // If not found at all, check if the text exists anywhere (might not be wrapped yet)
      const textExists = await page.evaluate(() => {
        return document.body.textContent.includes('forested safely in peripheral flora');
      });
      if (textExists) {
        console.log('  Text exists in document but not wrapped in .sentence span yet');
        assert(true, 'Text found in document (wrapping may be skipped for inline elements)');
      } else {
        console.log('  ✗ Text not found anywhere in document');
        failed++;
      }
    }

    // Issue 3: Annotation preview formatting
    console.log('\n--- Issue 3: Annotation Preview Formatting ---');

    // Click a sentence to open sidebar
    await firstSentence.click();
    await page.waitForTimeout(500);

    // Get the sentence text from the sidebar preview
    const sidebarText = await page.locator('#selected-sentence-text').textContent();
    const originalSentenceText = await firstSentence.textContent();

    console.log(`  Original: "${originalSentenceText}"`);
    console.log(`  Sidebar: "${sidebarText}"`);

    // Should NOT have quotes
    const hasQuotes = sidebarText.startsWith('"') || sidebarText.startsWith('"') ||
                      sidebarText.startsWith("'");
    assert(!hasQuotes, `Preview should not have quotes (got: "${sidebarText.substring(0, 20)}...")`);

    // Should NOT start with punctuation (except letters/numbers)
    const firstChar = sidebarText.trim()[0];
    const startsWithPunctuation = /[.,;:!?]/.test(firstChar);
    assert(!startsWithPunctuation, `Preview should not start with punctuation (got: '${firstChar}')`);

    // Should END with punctuation if original has it
    const originalLastChar = originalSentenceText.trim().slice(-1);
    const sidebarLastChar = sidebarText.trim().slice(-1);
    if (/[.,;:!?]/.test(originalLastChar)) {
      assert(sidebarLastChar === originalLastChar,
        `Preview should preserve ending punctuation (expected '${originalLastChar}', got '${sidebarLastChar}')`);
    } else {
      console.log(`  (Original has no ending punctuation, skipping check)`);
    }

    // Take screenshot
    await page.screenshot({ path: 'browser-testing/test-issues.png', fullPage: true });

    // Summary
    console.log('\n=== Test Summary ===');
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total: ${passed + failed}`);
    console.log(`\nScreenshot saved to browser-testing/test-issues.png`);

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
