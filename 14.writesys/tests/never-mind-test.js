const { chromium } = require('playwright');
const { TEST_URL, cleanupTestAnnotations } = require('./test-utils');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });

  let failed = false;

  try {
    // Clean up test manuscript data
    await cleanupTestAnnotations();

    console.log('Loading WriteSys (test.manuscript)...');
    await page.goto(TEST_URL, { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForSelector('.sentence', { timeout: 15000 });
    await new Promise(r => setTimeout(r, 2000));

    console.log('\n=== TEST 1: Basic "Never Mind" - Type and delete ===');

    // Click first sentence
    const firstSentence = await page.$('.sentence');
    await firstSentence.click();
    await new Promise(r => setTimeout(r, 500));

    // Verify grey uncreated note appears
    const greyNote = await page.$('.uncreated-note');
    if (!greyNote) {
      console.log('✗ FAIL: No grey uncreated note found');
      failed = true;
    } else {
      console.log('✓ Grey uncreated note appears');
    }

    // Type text in the note
    console.log('Typing "test" in grey note...');
    await page.type('.uncreated-note textarea', 'test');
    await new Promise(r => setTimeout(r, 500));

    // Check if note turned yellow and was created in database
    const afterTyping = await page.evaluate(() => {
      const note = document.querySelector('.sticky-note:not(.first-uncreated)');
      const hasYellowBg = note && window.getComputedStyle(note).backgroundColor === 'rgb(255, 253, 208)'; // yellow
      const textarea = note ? note.querySelector('textarea') : null;
      const textValue = textarea ? textarea.value : '';

      return {
        noteExists: !!note,
        isYellow: hasYellowBg,
        textValue: textValue,
        annotationCount: window.WriteSysAnnotations ? window.WriteSysAnnotations.annotations.length : 0
      };
    });

    console.log(`Note created: ${afterTyping.noteExists}, Yellow: ${afterTyping.isYellow}, Text: "${afterTyping.textValue}", Annotations: ${afterTyping.annotationCount}`);

    if (!afterTyping.noteExists || !afterTyping.isYellow) {
      console.log('✗ FAIL: Note did not turn yellow after typing');
      failed = true;
    } else if (afterTyping.annotationCount !== 1) {
      console.log('✗ FAIL: Annotation not created in database (expected 1, got ' + afterTyping.annotationCount + ')');
      failed = true;
    } else {
      console.log('✓ Note turned yellow and created in database');
    }

    // Delete all text (never mind)
    console.log('Deleting all text (never mind)...');
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await new Promise(r => setTimeout(r, 500));

    // Check if note reverted to grey and was deleted from database
    const afterDelete = await page.evaluate(() => {
      const yellowNote = document.querySelector('.sticky-note[style*="rgb(255, 253, 208)"]');
      const greyNote = document.querySelector('.uncreated-note');
      const textarea = greyNote ? greyNote.querySelector('textarea') : null;

      return {
        hasYellowNote: !!yellowNote,
        hasGreyNote: !!greyNote,
        textValue: textarea ? textarea.value : '',
        annotationCount: window.WriteSysAnnotations ? window.WriteSysAnnotations.annotations.length : 0,
        sentenceHighlight: document.querySelector('.sentence.selected') ? 'selected' : 'none'
      };
    });

    console.log(`Yellow note exists: ${afterDelete.hasYellowNote}, Grey note exists: ${afterDelete.hasGreyNote}, Text: "${afterDelete.textValue}", Annotations: ${afterDelete.annotationCount}, Sentence: ${afterDelete.sentenceHighlight}`);

    if (afterDelete.hasYellowNote) {
      console.log('✗ FAIL: Yellow note still exists after delete (should revert to grey)');
      failed = true;
    } else if (!afterDelete.hasGreyNote) {
      console.log('✗ FAIL: Grey uncreated note missing after delete');
      failed = true;
    } else if (afterDelete.annotationCount !== 0) {
      console.log('✗ FAIL: Annotation not deleted from database (expected 0, got ' + afterDelete.annotationCount + ')');
      failed = true;
    } else if (afterDelete.sentenceHighlight !== 'selected') {
      console.log('✗ FAIL: Sentence highlighting removed (should stay selected as grey)');
      failed = true;
    } else {
      console.log('✓ Note reverted to grey and deleted from database');
    }

    // Screenshot after never mind
    await page.screenshot({
      path: 'tests/screenshots/never-mind-1.png',
      fullPage: false
    });

    console.log('\n=== TEST 2: Type, change color, delete - Should NOT revert ===');

    // Unselect sentence first
    await page.click('body');
    await new Promise(r => setTimeout(r, 500));

    // Click sentence again
    await firstSentence.click();
    await new Promise(r => setTimeout(r, 500));

    // Type text
    console.log('Typing "committed" in grey note...');
    await page.type('.uncreated-note textarea', 'committed');
    await new Promise(r => setTimeout(r, 500));

    // Click green color to commit
    console.log('Clicking green color (commits the note)...');
    await page.click('.sticky-note-palette .color-circle[data-color="green"]');
    await new Promise(r => setTimeout(r, 500));

    // Try to delete all text
    console.log('Deleting all text (should NOT revert)...');
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await new Promise(r => setTimeout(r, 500));

    const afterCommittedDelete = await page.evaluate(() => {
      const greenNote = document.querySelector('.sticky-note[style*="rgb(212, 237, 218)"]'); // green
      const textarea = greenNote ? greenNote.querySelector('textarea') : null;

      return {
        hasGreenNote: !!greenNote,
        textValue: textarea ? textarea.value : '',
        annotationCount: window.WriteSysAnnotations ? window.WriteSysAnnotations.annotations.length : 0
      };
    });

    console.log(`Green note exists: ${afterCommittedDelete.hasGreenNote}, Text: "${afterCommittedDelete.textValue}", Annotations: ${afterCommittedDelete.annotationCount}`);

    if (!afterCommittedDelete.hasGreenNote) {
      console.log('✗ FAIL: Green note disappeared (should remain because it was committed)');
      failed = true;
    } else if (afterCommittedDelete.annotationCount !== 1) {
      console.log('✗ FAIL: Annotation was deleted (should remain because note was committed)');
      failed = true;
    } else {
      console.log('✓ Committed note remains even with empty text (correct)');
    }

    await page.screenshot({
      path: 'tests/screenshots/never-mind-2.png',
      fullPage: false
    });

    console.log('\n=== TEST 3: Type, click tag, delete - Should NOT revert ===');

    // Unselect sentence
    await page.click('body');
    await new Promise(r => setTimeout(r, 500));

    // Get second sentence
    const sentences = await page.$$('.sentence');
    if (sentences.length > 1) {
      await sentences[1].click();
      await new Promise(r => setTimeout(r, 500));

      // Type text
      console.log('Typing "tag test" in grey note...');
      await page.type('.uncreated-note textarea', 'tag test');
      await new Promise(r => setTimeout(r, 500));

      // Click a priority chip to commit
      console.log('Clicking P1 chip (commits the note)...');
      const p1Chip = await page.$('.priority-chip');
      if (p1Chip) {
        await p1Chip.click();
        await new Promise(r => setTimeout(r, 500));
      }

      // Delete text
      console.log('Deleting all text (should NOT revert)...');
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Backspace');
      await new Promise(r => setTimeout(r, 500));

      const afterTagDelete = await page.evaluate(() => {
        const notes = window.WriteSysAnnotations ? window.WriteSysAnnotations.annotations : [];
        const lastNote = notes[notes.length - 1];

        return {
          annotationCount: notes.length,
          hasPriority: lastNote ? lastNote.priority !== 'none' : false
        };
      });

      if (afterTagDelete.annotationCount < 2) {
        console.log('✗ FAIL: Annotation deleted after clicking tag (should remain)');
        failed = true;
      } else {
        console.log('✓ Note committed by tag click remains after delete');
      }
    }

    console.log('\n=== TEST 4: Type, switch sentence, original should be committed ===');

    // Unselect
    await page.click('body');
    await new Promise(r => setTimeout(r, 500));

    if (sentences.length > 2) {
      // Click third sentence
      await sentences[2].click();
      await new Promise(r => setTimeout(r, 500));

      // Type text
      console.log('Typing "switch test" in grey note...');
      await page.type('.uncreated-note textarea', 'switch test');
      await new Promise(r => setTimeout(r, 500));

      const beforeSwitch = await page.evaluate(() => {
        return window.WriteSysAnnotations ? window.WriteSysAnnotations.annotations.length : 0;
      });

      // Switch to different sentence (should commit)
      console.log('Switching to different sentence (commits the note)...');
      await sentences[0].click();
      await new Promise(r => setTimeout(r, 500));

      const afterSwitch = await page.evaluate(() => {
        return window.WriteSysAnnotations ? window.WriteSysAnnotations.annotations.length : 0;
      });

      if (afterSwitch <= beforeSwitch) {
        console.log('✗ FAIL: Annotation not committed when switching sentences');
        failed = true;
      } else {
        console.log('✓ Switching sentences commits the note');
      }
    }

    if (failed) {
      console.log('\n✗ NEVER MIND TEST FAILED');
      process.exit(1);
    } else {
      console.log('\n✓ ALL NEVER MIND TESTS PASSED');
    }

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    try {
      await page.screenshot({
        path: 'tests/screenshots/never-mind-error.png',
        fullPage: true
      });
    } catch (e) {}
    process.exit(1);
  }

  await browser.close();
})();
