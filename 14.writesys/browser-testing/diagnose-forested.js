/**
 * Diagnostic script to check the "forested safely in peripheral flora" sentence
 */

const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:5003');
  await page.waitForTimeout(8000); // Wait for auto-load

  // Find all sentences containing "forested"
  const result = await page.evaluate(() => {
    const sentences = Array.from(document.querySelectorAll('.sentence'));
    const matches = sentences.map((s, i) => ({
      index: i,
      text: s.textContent,
      id: s.dataset.sentenceId,
      hasForested: s.textContent.includes('forested')
    })).filter(s => s.hasForested);

    // Also find sentences around it
    const allData = matches.map(match => {
      const prevSentences = sentences.slice(Math.max(0, match.index - 2), match.index)
        .map(s => s.textContent);
      const nextSentences = sentences.slice(match.index + 1, match.index + 3)
        .map(s => s.textContent);

      return {
        ...match,
        prevSentences,
        nextSentences
      };
    });

    return allData;
  });

  console.log('=== Sentences containing "forested" ===\n');

  result.forEach(match => {
    console.log(`Sentence #${match.index}:`);
    console.log(`ID: ${match.id}`);
    console.log(`Text: "${match.text}"`);
    console.log(`\nPrevious sentences:`);
    match.prevSentences.forEach((s, i) => console.log(`  [${i}]: "${s.substring(0, 80)}..."`));
    console.log(`\nNext sentences:`);
    match.nextSentences.forEach((s, i) => console.log(`  [${i}]: "${s.substring(0, 80)}..."`));
    console.log('\n' + '='.repeat(80) + '\n');
  });

  // Check word counts
  const wordCounts = await page.evaluate(() => {
    const sentences = Array.from(document.querySelectorAll('.sentence'));
    return sentences.map((s, i) => ({
      index: i,
      wordCount: s.textContent.match(/[a-zA-Z0-9]+/g)?.length || 0,
      text: s.textContent.substring(0, 60)
    })).filter(s => s.text.includes('forested') || s.index >= 50 && s.index <= 60);
  });

  console.log('Word counts for sentences around index 50-60:');
  wordCounts.forEach(s => {
    console.log(`  [${s.index}] ${s.wordCount} words: "${s.text}..."`);
  });

  await browser.close();
})();
