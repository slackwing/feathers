// WriteSys Renderer
// Handles manuscript loading, markdown rendering, and sentence wrapping

const WriteSysRenderer = {
  apiBaseUrl: 'http://localhost:5003/api',
  currentManuscript: null,
  currentSentences: [],
  currentAnnotations: [],

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
      const response = await fetch(`${this.apiBaseUrl}/commits?manuscript_id=3`);
      const data = await response.json();

      const select = document.getElementById('commit-select');
      select.innerHTML = ''; // Clear loading message

      if (data.commits && data.commits.length > 0) {
        data.commits.forEach(commit => {
          const option = document.createElement('option');
          option.value = commit.commit_hash;

          // Format: hash (date - sentences)
          const date = new Date(commit.processed_at).toLocaleDateString();
          option.textContent = `${commit.commit_hash} (${date} - ${commit.sentence_count} sentences)`;
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
   * Load manuscript from API
   */
  async loadManuscript() {
    // Wait for Paged.js to be ready (if enabled)
    if (window.PAGEDJS_LOADING) {
      this.showStatus('Waiting for Paged.js...', 'loading');
      await this.waitForPagedJS();
    }

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

      console.log(`Loaded ${this.currentSentences.length} sentences`);

      // Render the manuscript
      this.renderManuscript();

      this.showStatus(`Loaded ${this.currentSentences.length} sentences`);
      document.getElementById('sentence-count').textContent = `${this.currentSentences.length} sentences`;

    } catch (error) {
      console.error('Failed to load manuscript:', error);
      this.showStatus(`Error: ${error.message}`, 'error');
    }
  },

  /**
   * Render markdown and wrap sentences
   */
  async renderManuscript() {
    const container = document.getElementById('manuscript-content');

    // Parse markdown to HTML using marked.js
    const html = marked.parse(this.currentManuscript);

    // Insert the HTML directly
    container.innerHTML = html;

    // If Paged.js is available, manually run it
    if (typeof Paged !== 'undefined') {
      console.log('Paged.js will handle pagination');

      const paged = new Paged.Previewer();
      const appContainer = document.getElementById('app-container');

      // Pass book.css explicitly so Paged.js uses its @page rules
      await paged.preview(html, ['/css/book.css'], appContainer);

      // Hide the original manuscript-content div (Paged.js created its own)
      const originalContent = document.getElementById('manuscript-content');
      if (originalContent) {
        originalContent.style.display = 'none';
      }

      // Listen for window resize
      window.addEventListener("resize", () => this.applyResponsiveScaling());
    } else {
      // Fallback if Paged.js not available
      smartquotes();
      this.wrapSentences(container);
    }
  },

  /**
   * Wrap sentences in <span> tags using word-count based algorithm
   */
  wrapSentences(container) {
    console.log('Starting sentence wrapping...');

    let sentenceIndex = 0;
    let wordCountInCurrentSentence = 0;
    let targetWordCount = this.currentSentences[0]?.wordCount || 0;

    // Walk all text nodes in the container
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    );

    const nodesToWrap = [];
    let currentNode = walker.nextNode();

    while (currentNode) {
      // Skip empty text nodes
      if (currentNode.textContent.trim() === '') {
        currentNode = walker.nextNode();
        continue;
      }

      // Extract words from this text node
      const words = this.extractWords(currentNode.textContent);
      let nodeStart = 0;

      for (let i = 0; i < words.length; i++) {
        wordCountInCurrentSentence++;

        // Check if we've reached the target word count for this sentence
        if (wordCountInCurrentSentence >= targetWordCount) {
          // Mark the boundary
          const wordEnd = words[i].index + words[i].word.length;

          nodesToWrap.push({
            node: currentNode,
            start: nodeStart,
            end: wordEnd,
            sentenceIndex: sentenceIndex,
            sentenceId: this.currentSentences[sentenceIndex].id
          });

          // Move to next sentence
          sentenceIndex++;
          if (sentenceIndex < this.currentSentences.length) {
            targetWordCount = this.currentSentences[sentenceIndex].wordCount;
            wordCountInCurrentSentence = 0;
            nodeStart = wordEnd;
          } else {
            // No more sentences
            break;
          }
        }
      }

      // If we have leftover content in this node that's part of current sentence
      if (nodeStart < currentNode.textContent.length && sentenceIndex < this.currentSentences.length) {
        nodesToWrap.push({
          node: currentNode,
          start: nodeStart,
          end: currentNode.textContent.length,
          sentenceIndex: sentenceIndex,
          sentenceId: this.currentSentences[sentenceIndex].id,
          partial: true
        });
      }

      currentNode = walker.nextNode();
    }

    // Now wrap all the marked ranges
    this.performWrapping(nodesToWrap);

    console.log(`Wrapped ${sentenceIndex + 1} sentences`);

    // Verify sentence count
    if (sentenceIndex + 1 !== this.currentSentences.length) {
      console.warn(`Mismatch: Expected ${this.currentSentences.length} sentences, wrapped ${sentenceIndex + 1}`);
    }
  },

  /**
   * Extract words with their positions (alphanumeric blobs)
   */
  extractWords(text) {
    const wordPattern = /[a-zA-Z0-9]+/g;
    const words = [];
    let match;

    while ((match = wordPattern.exec(text)) !== null) {
      words.push({
        word: match[0],
        index: match.index
      });
    }

    return words;
  },

  /**
   * Perform the actual wrapping of text nodes
   */
  performWrapping(nodesToWrap) {
    // Group by node first (to handle multiple ranges in same node)
    const nodeGroups = new Map();
    nodesToWrap.forEach(item => {
      if (!nodeGroups.has(item.node)) {
        nodeGroups.set(item.node, []);
      }
      nodeGroups.get(item.node).push(item);
    });

    // Process each node once, handling all its ranges
    nodeGroups.forEach((items, node) => {
      // Check if node is still in the DOM
      const parent = node.parentNode;
      if (!parent) {
        console.warn(`Node is no longer in DOM, skipping ${items.length} ranges`);
        return;
      }

      // Sort items by start position
      items.sort((a, b) => a.start - b.start);

      // Build fragments for this node
      const fragment = document.createDocumentFragment();
      let lastEnd = 0;

      items.forEach((item, index) => {
        const { start, end, sentenceId } = item;

        // Add any text before this range (if not covered by previous range)
        // Wrap in span to avoid bare text nodes (Paged.js compatibility)
        if (start > lastEnd) {
          const betweenText = node.textContent.substring(lastEnd, start);
          if (betweenText) {
            const span = document.createElement('span');
            span.textContent = betweenText;
            fragment.appendChild(span);
          }
        }

        // Create span for this sentence range
        const span = document.createElement('span');
        span.className = 'sentence';
        span.dataset.sentenceId = sentenceId;
        span.textContent = node.textContent.substring(start, end);
        fragment.appendChild(span);

        lastEnd = Math.max(lastEnd, end);
      });

      // Add any remaining text after last range
      // Wrap in span to avoid bare text nodes (Paged.js compatibility)
      if (lastEnd < node.textContent.length) {
        const afterText = node.textContent.substring(lastEnd);
        if (afterText) {
          const span = document.createElement('span');
          span.textContent = afterText;
          fragment.appendChild(span);
        }
      }

      // Replace the original node with the fragment
      parent.replaceChild(fragment, node);
    });

    // Apply annotation styles
    this.applyAnnotations();

    // Add click handlers
    document.querySelectorAll('.sentence').forEach(span => {
      span.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectSentence(span);
      });
    });
  },

  /**
   * Apply annotation styles to sentences
   */
  applyAnnotations() {
    // Guard against null annotations
    if (!this.currentAnnotations || this.currentAnnotations.length === 0) {
      console.log('No annotations to apply');
      return;
    }

    // Group annotations by sentence
    const annotationsBySentence = {};
    this.currentAnnotations.forEach(annotation => {
      // Note: Need to get sentence_id from annotation version
      // For now, this is simplified - will need to fetch full annotation data
      if (!annotationsBySentence[annotation.sentence_id]) {
        annotationsBySentence[annotation.sentence_id] = [];
      }
      annotationsBySentence[annotation.sentence_id].push(annotation);
    });

    // Apply styles
    Object.keys(annotationsBySentence).forEach(sentenceId => {
      const spans = document.querySelectorAll(`.sentence[data-sentence-id="${sentenceId}"]`);
      const annotations = annotationsBySentence[sentenceId];

      spans.forEach(span => {
        annotations.forEach(annotation => {
          if (annotation.type === 'highlight') {
            span.classList.add('annotated-highlight');
            if (annotation.payload && annotation.payload.color) {
              span.dataset.color = annotation.payload.color;
            }
          } else if (annotation.type === 'tag') {
            span.classList.add('annotated-tag');
          } else if (annotation.type === 'task') {
            span.classList.add('annotated-task');
          }
        });
      });
    });
  },

  /**
   * Select a sentence
   */
  selectSentence(span) {
    // Remove previous selection
    document.querySelectorAll('.sentence.selected').forEach(s => s.classList.remove('selected'));

    // Mark as selected
    span.classList.add('selected');

    // Show annotations for this sentence
    const sentenceId = span.dataset.sentenceId;
    if (window.WriteSysAnnotations) {
      window.WriteSysAnnotations.showAnnotationsForSentence(sentenceId, span.textContent);
    }
  },

  /**
   * Show status message
   */
  showStatus(message, type = 'info') {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.style.color = type === 'error' ? '#dc3545' : '#666';
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => WriteSysRenderer.init());
} else {
  WriteSysRenderer.init();
}

// Export for other modules
window.WriteSysRenderer = WriteSysRenderer;
