#!/usr/bin/env node

/**
 * Segment manuscript using JavaScript segmenter
 *
 * Reads a .manuscript file and outputs sentences to .js.jsonl
 */

const fs = require('fs');
const path = require('path');
const { segment } = require('./segmenter.js');

function main() {
    // Find manuscript file
    const manuscriptDir = path.join(__dirname, '..', 'manuscripts');
    let manuscriptPath;

    try {
        const files = fs.readdirSync(manuscriptDir);
        const manuscriptFiles = files.filter(f => f.endsWith('.manuscript'));

        if (manuscriptFiles.length === 0) {
            console.error('Error: no manuscript file found in manuscripts/');
            process.exit(1);
        }

        manuscriptPath = path.join(manuscriptDir, manuscriptFiles[0]);
    } catch (err) {
        console.error(`Error finding manuscript: ${err.message}`);
        process.exit(1);
    }

    // Extract manuscript name (without .manuscript extension)
    const manuscriptName = path.basename(manuscriptPath, '.manuscript');

    // Read manuscript
    let content;
    try {
        content = fs.readFileSync(manuscriptPath, 'utf-8');
    } catch (err) {
        console.error(`Error reading manuscript: ${err.message}`);
        process.exit(1);
    }

    // Segment
    const sentences = segment(content);

    // Create output directory: segmented/{manuscript-name}/
    const outDir = path.join(__dirname, '..', 'segmented', manuscriptName);
    try {
        fs.mkdirSync(outDir, { recursive: true });
    } catch (err) {
        console.error(`Error creating output directory: ${err.message}`);
        process.exit(1);
    }

    // Write to segmented/{manuscript-name}/{manuscript-name}.js.jsonl
    const outPath = path.join(outDir, `${manuscriptName}.js.jsonl`);
    try {
        const lines = sentences.map(s => JSON.stringify(s)).join('\n') + '\n';
        fs.writeFileSync(outPath, lines, 'utf-8');
    } catch (err) {
        console.error(`Error writing output file: ${err.message}`);
        process.exit(1);
    }

    console.log(`Segmented ${sentences.length} sentences from ${manuscriptPath} to ${outPath}`);
}

if (require.main === module) {
    main();
}
