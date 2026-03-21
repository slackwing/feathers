/**
 * Check the HTML structure for the problematic sentence
 */

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:5003');
  await page.waitForTimeout(8000); // Wait for auto-load

  // Get the HTML structure around the "forested" text
  const result = await page.evaluate(() => {
    // Find the sentence span containing "forested"
    const sentences = Array.from(document.querySelectorAll('.sentence'));
    const forestedSentence = sentences.find(s => s.textContent.includes('forested'));

    if (!forestedSentence) return { error: 'Sentence not found' };

    // Get parent element and its HTML
    const parent = forestedSentence.parentElement;

    // Find all sentences with the same ID
    const sameId = sentences.filter(s => s.dataset.sentenceId === forestedSentence.dataset.sentenceId);

    return {
      sentenceId: forestedSentence.dataset.sentenceId,
      sentenceCount: sameId.length,
      sentences: sameId.map(s => ({
        text: s.textContent,
        outerHTML: s.outerHTML.substring(0, 200),
        previousSibling: s.previousSibling?.textContent?.substring(0, 50) || s.previousSibling?.tagName || 'null',
        nextSibling: s.nextSibling?.textContent?.substring(0, 50) || s.nextSibling?.tagName || 'null',
        parentTag: s.parentElement?.tagName
      })),
      parentHTML: parent.innerHTML.substring(
        Math.max(0, parent.innerHTML.indexOf('forested') - 200),
        parent.innerHTML.indexOf('forested') + 200
      )
    };
  });

  console.log('=== HTML Structure Analysis ===\n');
  console.log(`Sentence ID: ${result.sentenceId}`);
  console.log(`Number of .sentence spans with this ID: ${result.sentenceCount}`);
  console.log('\nEach span:');
  result.sentences.forEach((s, i) => {
    console.log(`\n[${i}]:`);
    console.log(`  Text: "${s.text}"`);
    console.log(`  Parent: <${s.parentTag}>`);
    console.log(`  Prev sibling: ${s.previousSibling}`);
    console.log(`  Next sibling: ${s.nextSibling}`);
    console.log(`  HTML: ${s.outerHTML}...`);
  });

  console.log('\nParent HTML context:');
  console.log(result.parentHTML);

  await browser.close();
})();
