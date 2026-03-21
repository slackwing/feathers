/**
 * Test suite for new issues found
 * Run: node browser-testing/test-new-issues.js
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
    console.log('=== WriteSys New Issues Test ===\n');

    // Load the page
    await page.goto('http://localhost:5003');
    await page.waitForTimeout(8000); // Wait for auto-load

    // Check which commit was auto-loaded
    const loadedCommit = await page.evaluate(() => {
      return document.getElementById('commit-select').value;
    });
    console.log(`\nLoaded commit: ${loadedCommit}\n`);

    // Issue 1: Highlighting should exclude leading punctuation, include trailing
    console.log('\n--- Issue 1: Highlighting Punctuation Boundaries ---');

    const sentenceWithPunctuation = await page.evaluate(() => {
      const sentences = Array.from(document.querySelectorAll('.sentence'));
      // Find a sentence that starts with punctuation
      const match = sentences.find(s => /^[.,;:!?—]/.test(s.textContent.trim()));
      if (!match) return null;

      return {
        text: match.textContent,
        innerHTML: match.innerHTML
      };
    });

    if (sentenceWithPunctuation) {
      console.log(`  Found sentence: "${sentenceWithPunctuation.text.substring(0, 50)}..."`);
      const startsWithPunctuation = /^[.,;:!?—]/.test(sentenceWithPunctuation.text.trim());
      assert(!startsWithPunctuation, `Sentence should not start with punctuation (got: '${sentenceWithPunctuation.text[0]}')`);
    } else {
      console.log('  Note: No sentences starting with punctuation found (this may be expected after fix)');
    }

    // Issue 2: Markdown asterisks should be rendered, not shown literally
    console.log('\n--- Issue 2: Markdown Asterisk Rendering ---');

    const asteriskCheck = await page.evaluate(() => {
      const body = document.body.textContent;
      const hasLiteralAsterisks = body.includes('**—**');

      // Also check for the specific sentence
      const sentences = Array.from(document.querySelectorAll('.sentence'));
      const bedroomSentence = sentences.find(s => s.textContent.includes('going to the bedroom'));

      return {
        hasLiteralAsterisks,
        bedroomText: bedroomSentence ? bedroomSentence.textContent.substring(
          Math.max(0, bedroomSentence.textContent.indexOf('bedroom') - 20),
          bedroomSentence.textContent.indexOf('bedroom') + 40
        ) : null,
        bedroomHTML: bedroomSentence ? bedroomSentence.innerHTML.substring(
          Math.max(0, bedroomSentence.innerHTML.indexOf('bedroom') - 20),
          bedroomSentence.innerHTML.indexOf('bedroom') + 60
        ) : null
      };
    });

    console.log(`  Bedroom sentence text: "${asteriskCheck.bedroomText}"`);
    console.log(`  Bedroom sentence HTML: ${asteriskCheck.bedroomHTML}`);
    assert(!asteriskCheck.hasLiteralAsterisks, `Should not show literal **—** in text (found: ${asteriskCheck.hasLiteralAsterisks})`);

    // Issue 3: "Unless he was still in shock—did it just happen?" should be ONE sentence
    console.log('\n--- Issue 3: Sentence Splitting with Italicized "just" ---');

    const shockSentence = await page.evaluate(() => {
      const sentences = Array.from(document.querySelectorAll('.sentence'));
      const matches = sentences.filter(s =>
        s.textContent.includes('Unless he was still in shock') ||
        s.textContent.includes('did it') && s.textContent.includes('just') && s.textContent.includes('happen')
      );

      return {
        count: matches.length,
        texts: matches.map(s => s.textContent.substring(0, 100))
      };
    });

    console.log(`  Found ${shockSentence.count} sentence spans containing this text:`);
    shockSentence.texts.forEach((t, i) => {
      console.log(`    [${i}]: "${t}..."`);
    });

    // Should be ONE sentence (or possibly split across multiple spans with same ID, but not separate sentences)
    // The ideal is that "Unless he was still in shock—did it just happen?" is all in one span
    const isSingleSentence = shockSentence.count === 1;
    assert(isSingleSentence, `Should be one sentence span (found ${shockSentence.count})`);

    // Take screenshot
    await page.screenshot({ path: 'browser-testing/test-new-issues.png', fullPage: true });

    // Summary
    console.log('\n=== Test Summary ===');
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total: ${passed + failed}`);
    console.log(`\nScreenshot saved to browser-testing/test-new-issues.png`);

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
