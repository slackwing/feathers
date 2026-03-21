const marked = require('marked');

const text = 'Kinda like then, I\'m finding out that—in the uninteresting details of life, memories go to hide and survive—*forested safely in peripheral flora*—so maybe I\'m walking here, walking there, walking along the brushes, hoping to find the pieces I need, to tell this story.';

console.log('Input text:');
console.log(text);
console.log('\nParsed HTML:');
const html = marked.parse(text);
console.log(html);

// Count words in the plain text
const words = text.match(/[a-zA-Z0-9]+/g);
console.log('\nWord count in plain text:', words ? words.length : 0);
