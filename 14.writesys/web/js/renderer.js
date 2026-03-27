// WriteSys Renderer
// Simplified version using JS segmenter for accurate sentence boundaries

const WriteSysRenderer = {
  apiBaseUrl: 'http://localhost:5003/api',
  currentManuscript: null,
  currentSentences: [],
  currentAnnotations: [],
  sentenceMap: {}, // Maps sentence ID -> full sentence text (for split sentences)
  currentSelectedSentenceId: null, // Currently selected sentence ID

  /**
   * Initialize the renderer
   */
  async init() {
    // Set up event listeners
    document.getElementById('load-button').addEventListener('click', () => this.loadManuscript());

    // Load on Enter key in inputs
    ['repo-path', 'file-path'].forEach(id => {
      document.getElementById(id).addEventListener('keypress', (e) => {
        if (e.key === 'Enter') this.loadManuscript();
      });
    });

    // Load commits on select change
    document.getElementById('commit-select').addEventListener('change', () => {
      if (document.getElementById('commit-select').value) {
        this.loadManuscript();
      }
    });

    console.log('WriteSys Renderer initialized');

    // Load commits and auto-load latest
    await this.loadCommits();
  },

  /**
   * Load commits from API and populate dropdown
   */
  async loadCommits() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/commits?manuscript_id=4`);
      const data = await response.json();

      const select = document.getElementById('commit-select');
      select.innerHTML = ''; // Clear loading message

      if (data.commits && data.commits.length > 0) {
        data.commits.forEach(commit => {
          const option = document.createElement('option');
          option.value = commit.commit_hash;

          // Format: short hash (date - sentences)
          const shortHash = commit.commit_hash.substring(0, 7);
          const date = new Date(commit.processed_at).toLocaleDateString();
          option.textContent = `${shortHash} (${date} - ${commit.sentence_count} sentences)`;
          select.appendChild(option);
        });

        // Auto-select and load the latest commit (first in list)
        select.value = data.commits[0].commit_hash;
        await this.loadManuscript();
      } else {
        select.innerHTML = '<option value="">No commits found</option>';
      }
    } catch (error) {
      console.error('Failed to load commits:', error);
      document.getElementById('commit-select').innerHTML = '<option value="">Error loading commits</option>';
    }
  },

  /**
   * Load manuscript from API
   */
  async loadManuscript() {
    const commitHash = document.getElementById('commit-select').value.trim();
    const repoPath = document.getElementById('repo-path').value.trim();
    const filePath = document.getElementById('file-path').value.trim();

    if (!commitHash || !repoPath || !filePath) {
      this.showStatus('Error: Missing required fields', 'error');
      return;
    }

    try {
      this.showStatus('Loading manuscript...');

      // Fetch manuscript data from API
      const url = `${this.apiBaseUrl}/manuscripts/${commitHash}?repo=${encodeURIComponent(repoPath)}&file=${encodeURIComponent(filePath)}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      this.currentManuscript = data.markdown;
      this.currentSentences = data.sentences;
      this.currentAnnotations = data.annotations;

      // Build sentence map (ID -> full text) for annotation sidebar
      this.sentenceMap = {};
      this.currentSentences.forEach(s => {
        this.sentenceMap[s.id] = s.text;
      });

      console.log(`Loaded ${this.currentSentences.length} sentences from server`);

      // Render the manuscript
      await this.renderManuscript();

      this.showStatus(`Loaded ${this.currentSentences.length} sentences`);
      document.getElementById('sentence-count').textContent = `${this.currentSentences.length} sentences`;

    } catch (error) {
      console.error('Failed to load manuscript:', error);
      this.showStatus(`Error: ${error.message}`, 'error');
    }
  },

  /**
   * Render manuscript and wrap sentences
   */
  async renderManuscript() {
    const container = document.getElementById('manuscript-content');

    // Parse .manuscript format to HTML
    const html = this.parseManuscript(this.currentManuscript);

    // Create a temporary container to wrap sentences BEFORE pagination
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = html;

    // Apply smartquotes to convert straight quotes to curly
    if (typeof smartquotes !== 'undefined') {
      smartquotes.element(tempContainer);
    }

    // Wrap sentences in the unpaginated HTML
    console.log('Wrapping sentences before pagination...');
    this.wrapSentences(tempContainer);

    // Get the wrapped HTML
    const wrappedHtml = tempContainer.innerHTML;

    // Debug: check HTML structure
    console.log('Wrapped HTML sample (first 500 chars):', wrappedHtml.substring(0, 500));
    console.log('Wrapped HTML has <p> tags:', wrappedHtml.includes('<p>'));
    console.log('Wrapped HTML has <h1> tags:', wrappedHtml.includes('<h1>'));

    // If Paged.js is available, use it for pagination
    if (typeof Paged !== 'undefined') {
      console.log('Using Paged.js for pagination');

      const paged = new Paged.Previewer();
      const appContainer = document.getElementById('app-container');

      // Pass wrapped HTML to Paged.js - it will handle splitting/duplicating sentence spans
      await paged.preview(wrappedHtml, ['/css/book.css'], appContainer);

      // Hide the original manuscript-content div (Paged.js created its own)
      const originalContent = document.getElementById('manuscript-content');
      if (originalContent) {
        originalContent.style.display = 'none';
      }

      // Setup hover on the paginated content
      this.setupSentenceHover();

      // Apply responsive scaling
      this.applyResponsiveScaling();

      // Listen for window resize
      window.addEventListener("resize", () => this.applyResponsiveScaling());
    } else {
      // Fallback if Paged.js not available
      container.innerHTML = wrappedHtml;
      this.setupSentenceHover();
    }
  },

  /**
   * Apply or remove mobile scaling based on viewport width
   */
  applyResponsiveScaling() {
    const pagesContainer = document.querySelector(".pagedjs_pages");
    if (!pagesContainer) return;

    if (window.innerWidth <= 768) {
      const pageWidth = 600; // 6in = ~600px at 96dpi
      const viewportWidth = window.innerWidth;
      const scale = (viewportWidth * 0.7) / pageWidth; // 70% to leave room for borders
      pagesContainer.style.transform = `scale(${scale})`;
      pagesContainer.style.transformOrigin = "top center";
      pagesContainer.style.padding = "1em";
      pagesContainer.style.background = "transparent";
      document.body.style.background = "white";
    } else {
      // Reset to desktop view
      pagesContainer.style.transform = "";
      pagesContainer.style.transformOrigin = "";
      pagesContainer.style.padding = "2em";
      pagesContainer.style.background = "#f5f5f5";
      document.body.style.background = "";
    }
  },

  /**
   * Parse .manuscript format to HTML
   * Format rules:
   * - Lines starting with # are headings
   * - Lines starting with \t are NEW indented paragraphs (each line is its own paragraph)
   * - Lines without \t after headings are regular paragraphs (multiple lines can be joined)
   * - Blank lines separate paragraphs
   * - *text* becomes <em>
   */
  parseManuscript(text) {
    const lines = text.split('\n');
    const html = [];
    let paragraphLines = [];

    const flushParagraph = () => {
      if (paragraphLines.length > 0) {
        const content = paragraphLines.join(' ');
        const hasIndent = paragraphLines[0].startsWith('\t');
        const cleaned = content.replace(/^\t/, '');
        const withFormatting = this.applyInlineFormatting(cleaned);

        if (hasIndent) {
          html.push(`<p class="indented">${withFormatting}</p>`);
        } else {
          html.push(`<p>${withFormatting}</p>`);
        }
        paragraphLines = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Blank line - flush paragraph
      if (line.trim() === '') {
        flushParagraph();
        continue;
      }

      // Heading
      if (line.startsWith('#')) {
        flushParagraph();
        const level = line.match(/^#+/)[0].length;
        const text = line.replace(/^#+\s*/, '');
        html.push(`<h${level}>${this.applyInlineFormatting(text)}</h${level}>`);
        continue;
      }

      // Line starting with tab - each is its own indented paragraph
      if (line.startsWith('\t')) {
        flushParagraph(); // Flush any accumulated non-indented paragraph
        const cleaned = line.substring(1); // Remove the tab
        const withFormatting = this.applyInlineFormatting(cleaned);
        html.push(`<p class="indented">${withFormatting}</p>`);
        continue;
      }

      // Regular paragraph content (accumulate until blank line or special line)
      paragraphLines.push(line);
    }

    // Flush any remaining paragraph
    flushParagraph();

    return html.join('\n');
  },

  /**
   * Apply inline formatting (*italic*)
   */
  applyInlineFormatting(text) {
    // Replace *text* with <em>text</em>
    return text.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  },

  /**
   * Get unwrapped text from container
   * (skips already-wrapped .sentence spans to avoid double-wrapping)
   */
  getUnwrappedText(container) {
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          let parent = node.parentElement;
          while (parent && parent !== container) {
            if (parent.classList && parent.classList.contains('sentence')) {
              return NodeFilter.FILTER_REJECT;
            }
            parent = parent.parentElement;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let text = '';
    let node = walker.nextNode();
    while (node) {
      text += node.textContent;
      node = walker.nextNode();
    }
    return text;
  },

  /**
   * Wrap sentences - segment the MARKDOWN using JS segmenter
   * Then "zipper" match with server sentences using first 3 words
   */
  wrapSentences(container) {
    console.log('Starting sentence wrapping...');
    console.log(`Server provided ${this.currentSentences.length} sentences`);

    // Segment the ORIGINAL MARKDOWN using the JS segmenter
    // This ensures we match the server's segmentation
    const rawSegments = segment(this.currentManuscript);

    // Apply the same cleaning that the Go server does (cleanSentenceBoundaries)
    // This removes leading punctuation and filters out empty sentences
    const segments = rawSegments.map(s => this.cleanSentenceBoundaries(s)).filter(s => s !== '');
    console.log(`JS segmenter found ${segments.length} segments in markdown (after cleaning)`);

    // Zipper through both lists in order
    let wrapped = 0;
    let mismatches = [];

    const maxLength = Math.max(segments.length, this.currentSentences.length);

    for (let i = 0; i < maxLength; i++) {
      const segment = segments[i];
      const serverSentence = this.currentSentences[i];

      if (!segment && !serverSentence) {
        break; // Both lists exhausted
      }

      if (!segment) {
        console.error(`ERROR: Server has sentence ${i} but JS segmenter doesn't: "${this.stripMarkdown(serverSentence.text).substring(0, 50)}..."`);
        mismatches.push({ index: i, reason: 'missing-segment', serverText: serverSentence.text });
        continue;
      }

      if (!serverSentence) {
        console.error(`ERROR: JS segmenter has segment ${i} but server doesn't: "${segment.substring(0, 50)}..."`);
        mismatches.push({ index: i, reason: 'missing-server', segmentText: segment });
        continue;
      }

      // Strip markdown from both for comparison
      const segmentClean = this.stripMarkdown(segment);
      const serverClean = this.stripMarkdown(serverSentence.text);

      // Get first 3 words from both
      const segmentWords = this.extractWords(segmentClean).slice(0, 3);
      const serverWords = this.extractWords(serverClean).slice(0, 3);

      // Check if first 3 words match
      const wordsMatch = segmentWords.length === serverWords.length &&
                         segmentWords.every((word, idx) => word.toLowerCase() === serverWords[idx].toLowerCase());

      if (!wordsMatch) {
        console.error(`ERROR: Mismatch at index ${i}:`);
        console.error(`  JS segment: "${segmentClean.substring(0, 50)}..." (words: ${segmentWords.join(', ')})`);
        console.error(`  Server text: "${serverClean.substring(0, 50)}..." (words: ${serverWords.join(', ')})`);
        mismatches.push({
          index: i,
          reason: 'word-mismatch',
          segmentWords,
          serverWords,
          segmentText: segment,
          serverText: serverSentence.text
        });
        continue;
      }

      // Words match! Find and wrap this segment
      // Recalculate fullText from unwrapped nodes only (to avoid offset drift)
      const fullText = this.getUnwrappedText(container);

      // Normalize quotes to match rendered text (smartquotes converts them)
      const segmentNormalized = this.normalizeQuotes(segmentClean);
      let segmentIndex = fullText.indexOf(segmentNormalized);

      // If not found, try fallback: search for first N words
      // This helps with sentences split across page breaks
      if (segmentIndex === -1) {
        const words = segmentNormalized.split(/\s+/);

        // Try with decreasing word counts: 10, 7, 5, 3
        const wordCounts = [10, 7, 5, 3];
        let foundPartial = false;

        for (const count of wordCounts) {
          if (words.length >= count) {
            const partial = words.slice(0, count).join(' ');
            const partialIndex = fullText.indexOf(partial);
            if (partialIndex !== -1) {
              console.log(`Partial match for segment ${i} using first ${count} words`);
              // Only wrap the partial match we found
              this.wrapTextRange(container, partialIndex, partialIndex + partial.length, serverSentence.id);
              wrapped++;
              foundPartial = true;
              break;
            }
          }
        }

        if (foundPartial) {
          continue;
        }

        // Could not find this sentence
        console.warn(`Could not find segment ${i}: "${segmentNormalized.substring(0, 50)}..."`);
        mismatches.push({ index: i, reason: 'not-in-dom', segmentText: segment });
        continue;
      }

      // Check if there's a space before this sentence that we need to preserve
      // If segmentIndex > 0 and the previous char is a space, we should NOT include it in the wrap
      // because it belongs between sentences

      // Wrap this text range with the server's sentence ID
      this.wrapTextRange(container, segmentIndex, segmentIndex + segmentNormalized.length, serverSentence.id);
      wrapped++;
    }

    console.log(`Sentence wrapping complete: ${wrapped} wrapped, ${mismatches.length} mismatches`);
    if (mismatches.length > 0) {
      console.error(`TOTAL MISMATCHES: ${mismatches.length}`);
      console.log('Mismatch summary:', mismatches.map(m => `${m.index}: ${m.reason}`).join(', '));
    }
  },

  /**
   * Extract words from text (alphanumeric sequences)
   */
  extractWords(text) {
    const wordPattern = /[a-zA-Z0-9]+/g;
    const matches = text.match(wordPattern);
    return matches || [];
  },

  /**
   * Clean sentence boundaries - same as Go code cleanSentenceBoundaries()
   * Removes leading punctuation but keeps trailing punctuation
   */
  cleanSentenceBoundaries(text) {
    let trimmed = text.trim();

    // Remove leading punctuation (except quotes)
    while (trimmed.length > 0) {
      const firstChar = trimmed[0];

      // Keep quotes at start
      if (firstChar === '"' || firstChar === "'" ||
          firstChar === '\u201c' || firstChar === '\u201d' ||
          firstChar === '\u2018' || firstChar === '\u2019' ||
          firstChar === '\u201e') {
        break;
      }

      // Remove sentence-joining punctuation
      if (firstChar === '.' || firstChar === ',' || firstChar === ';' ||
          firstChar === ':' || firstChar === '!' || firstChar === '?' ||
          firstChar === '—' || firstChar === '-') {
        trimmed = trimmed.substring(1).trimStart();
      } else {
        break;
      }
    }

    return trimmed;
  },

  /**
   * Get text content with proper spacing between block elements
   * This ensures headings, paragraphs, etc. don't concatenate
   * Uses double newlines for segmenter compatibility
   */
  getTextWithBlockSpacing(element) {
    const blockElements = ['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'SECTION', 'ARTICLE'];
    const parts = [];

    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (text.trim()) {
          parts.push(text);
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName;

        // Walk children
        for (let child of node.childNodes) {
          walk(child);
        }

        // Add double newline after block elements (required by segmenter)
        if (blockElements.includes(tagName) && parts.length > 0) {
          const last = parts[parts.length - 1];
          if (last && !last.endsWith('\n\n')) {
            // Ensure we have exactly two newlines
            if (last.endsWith('\n')) {
              parts.push('\n');
            } else {
              parts.push('\n\n');
            }
          }
        }
      }
    };

    walk(element);
    return parts.join('');
  },

  /**
   * Strip markdown syntax from text
   */
  stripMarkdown(text) {
    return text
      .replace(/^#{1,6}\s+/gm, '')  // Remove heading markers
      .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove bold markers
      .replace(/\*([^*]+)\*/g, '$1');  // Remove italic markers
  },

  /**
   * Normalize quotes for searching (straight to curly)
   * The browser/smartquotes converts straight quotes to curly
   * Uses smartquotes.string() to match exactly what appears in DOM
   */
  normalizeQuotes(text) {
    // Use smartquotes library to convert the same way the DOM does
    if (typeof smartquotes !== 'undefined' && smartquotes.string) {
      return smartquotes.string(text);
    }
    // Fallback: simple conversion (not context-aware)
    return text
      .replace(/"/g, '"')
      .replace(/'/g, "'");
  },

  /**
   * Normalize text for comparison (same as Go code)
   */
  normalizeText(text) {
    // First strip markdown syntax
    let cleaned = text
      .replace(/^#{1,6}\s+/g, '')  // Remove heading markers
      .replace(/\*([^*]+)\*/g, '$1')  // Remove italic markers
      .replace(/\*\*([^*]+)\*\*/g, '$1');  // Remove bold markers

    // Then convert to lowercase, remove punctuation, normalize whitespace
    return cleaned
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  /**
   * Wrap a range of text in the DOM with a sentence span
   */
  wrapTextRange(container, startOffset, endOffset, sentenceId) {
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          let parent = node.parentElement;
          while (parent && parent !== container) {
            // Skip text nodes already inside a .sentence span
            if (parent.classList && parent.classList.contains('sentence')) {
              return NodeFilter.FILTER_REJECT;
            }
            parent = parent.parentElement;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let currentOffset = 0;
    let currentNode = walker.nextNode();
    const nodesToWrap = [];

    while (currentNode) {
      const nodeLength = currentNode.textContent.length;
      const nodeStart = currentOffset;
      const nodeEnd = currentOffset + nodeLength;

      // Check if this text node intersects with our target range
      if (nodeEnd > startOffset && nodeStart < endOffset) {
        const wrapStart = Math.max(0, startOffset - nodeStart);
        const wrapEnd = Math.min(nodeLength, endOffset - nodeStart);

        nodesToWrap.push({
          node: currentNode,
          start: wrapStart,
          end: wrapEnd,
          sentenceId: sentenceId
        });
      }

      currentOffset = nodeEnd;
      if (currentOffset >= endOffset) break;

      currentNode = walker.nextNode();
    }

    // Perform the wrapping (reverse order to avoid offset issues)
    nodesToWrap.reverse().forEach(({ node, start, end, sentenceId }) => {
      const before = node.textContent.substring(0, start);
      const content = node.textContent.substring(start, end);
      const after = node.textContent.substring(end);

      const span = document.createElement('span');
      span.className = 'sentence';
      span.dataset.sentenceId = sentenceId;
      span.textContent = content;

      const parent = node.parentNode;
      if (before) parent.insertBefore(document.createTextNode(before), node);
      parent.insertBefore(span, node);
      if (after) parent.insertBefore(document.createTextNode(after), node);
      parent.removeChild(node);
    });
  },

  /**
   * Set up hover effects for sentences
   * When hovering over a sentence, highlight ALL fragments (including on other pages)
   */
  setupSentenceHover() {
    document.querySelectorAll('.sentence').forEach(span => {
      span.addEventListener('mouseenter', () => {
        const sentenceId = span.dataset.sentenceId;
        // Highlight all fragments with this sentence ID
        document.querySelectorAll(`.sentence[data-sentence-id="${sentenceId}"]`).forEach(fragment => {
          fragment.classList.add('hover');
        });
      });

      span.addEventListener('mouseleave', () => {
        const sentenceId = span.dataset.sentenceId;
        // Remove highlight from all fragments with this sentence ID
        document.querySelectorAll(`.sentence[data-sentence-id="${sentenceId}"]`).forEach(fragment => {
          fragment.classList.remove('hover');
        });
      });

      span.addEventListener('click', () => {
        const sentenceId = span.dataset.sentenceId;

        // Clear previous selection
        if (this.currentSelectedSentenceId) {
          document.querySelectorAll(`.sentence[data-sentence-id="${this.currentSelectedSentenceId}"]`).forEach(fragment => {
            fragment.classList.remove('selected');
          });
        }

        // Highlight all fragments of the clicked sentence
        document.querySelectorAll(`.sentence[data-sentence-id="${sentenceId}"]`).forEach(fragment => {
          fragment.classList.add('selected');
        });

        // Update current selection
        this.currentSelectedSentenceId = sentenceId;

        if (window.WriteSysAnnotations) {
          // Use full sentence text from map (not the clicked fragment)
          const fullText = this.sentenceMap[sentenceId] || span.textContent;
          window.WriteSysAnnotations.showAnnotationsForSentence(sentenceId, fullText);
        }
      });
    });
  },

  /**
   * Show status message
   */
  showStatus(message, type = 'info') {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = type;
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => WriteSysRenderer.init());
} else {
  WriteSysRenderer.init();
}
