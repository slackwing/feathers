// WriteSys Annotations
// Handles annotation sidebar, CRUD operations, and UI interactions

const WriteSysAnnotations = {
  apiBaseUrl: 'http://localhost:5003/api',
  currentSentenceId: null,
  currentSentenceText: '',
  annotations: [],
  autoSaveTimeout: null,

  // Session state for default-to-blue logic
  currentAnnotationSession: {
    sentenceId: null,
    autoDefaultedToBlue: false,
    originalColor: null,
    lastKeystroke: null
  },

  /**
   * Initialize annotations module
   */
  init() {
    // Click on grey background (margins) to unselect sentence
    document.addEventListener('click', (e) => {
      const annotationMargin = document.getElementById('annotation-margin');
      const annotationMarginInner = document.querySelector('.annotation-margin-inner');
      const appContainer = document.getElementById('app-container');
      const pagedPages = document.querySelector('.pagedjs_pages');

      // Unselect if clicking directly on grey background elements
      // (not on their children, which would be actual content like palette or pages)
      const isGreyBackground =
        e.target === annotationMargin ||           // The annotation margin container itself
        e.target === annotationMarginInner ||       // The inner container of annotation margin
        e.target === appContainer ||                // The app container
        e.target === pagedPages ||                  // The paged.js container (grey background)
        e.target === document.body;                 // The body

      if (isGreyBackground) {
        this.unselectSentence();
      }
    });

    // Initialize annotation margin positioning
    this.initAnnotationMargin();

    // Initialize color palette
    this.initColorPalette();

    // Initialize note input
    this.initNoteInput();

    // Initialize tags
    this.initTags();

    console.log('WriteSys Annotations initialized');
  },

  /**
   * Initialize color palette interactions
   */
  initColorPalette() {
    const circles = document.querySelectorAll('.color-circle');
    circles.forEach(circle => {
      circle.addEventListener('click', (e) => {
        const color = e.target.dataset.color;
        this.handleColorSelection(color);
      });
    });
  },

  /**
   * Handle color selection - creates, updates, or removes annotation
   * Clicking the same color again removes the highlight (toggle behavior)
   */
  async handleColorSelection(color) {
    // Get currently selected sentence
    const selectedSentence = document.querySelector('.sentence.selected');
    if (!selectedSentence) return;

    const sentenceId = selectedSentence.dataset.sentenceId;
    if (!sentenceId) return;

    // Check if annotation already exists for this sentence
    const existingAnnotation = await this.getAnnotationForSentence(sentenceId);

    try{
      // If clicking the same color that's already applied, remove the highlight (toggle off)
      if (existingAnnotation && existingAnnotation.color === color) {
        // Ask for confirmation before deleting
        if (!confirm('Delete this annotation?')) {
          return;
        }

        // Remove highlight from all fragments
        const allFragments = document.querySelectorAll(`.sentence[data-sentence-id="${sentenceId}"]`);
        const highlightColors = ['yellow', 'green', 'blue', 'purple', 'red', 'orange'];
        allFragments.forEach(fragment => {
          highlightColors.forEach(c => fragment.classList.remove(`highlight-${c}`));
        });

        // Clear active circle
        document.querySelectorAll('.color-circle').forEach(c => c.classList.remove('active'));

        // Delete annotation (will unselect sentence) - skip confirm since we already confirmed
        await this.deleteAnnotation(existingAnnotation.annotation_id, true);
        console.log(`Removed annotation ${existingAnnotation.annotation_id}`);
      } else if (existingAnnotation) {
        // Get current note text before updating
        const noteInput = document.getElementById('note-input');
        const noteText = noteInput ? noteInput.value.trim() : '';

        // IMPORTANT: Manual color change "commits" the annotation
        // Disable session-based auto-undo because user has explicitly chosen a color
        if (this.currentAnnotationSession.autoDefaultedToBlue) {
          this.currentAnnotationSession.autoDefaultedToBlue = false;
        }

        // Update existing annotation to new color
        await this.updateAnnotationColor(existingAnnotation.annotation_id, sentenceId, color);

        // Update local annotation object
        existingAnnotation.color = color;
        existingAnnotation.note = noteText || null;  // Also save the note

        // Update active circle
        document.querySelectorAll('.color-circle').forEach(c => c.classList.remove('active'));
        document.querySelector(`.color-circle[data-color="${color}"]`).classList.add('active');

        // Apply highlight to sentence
        this.applyHighlightToSentence(selectedSentence, color);
      } else {
        // Create new annotation
        const apiResponse = await this.createHighlightAnnotation(sentenceId, color);

        // Construct full annotation object for local array
        const newAnnotation = {
          annotation_id: apiResponse.annotation_id,
          sentence_id: sentenceId,
          color: color,
          note: null,
          priority: 'none',
          flagged: false,
          tags: []
        };

        // Add to local annotations array
        this.annotations.push(newAnnotation);

        // Update active circle
        document.querySelectorAll('.color-circle').forEach(c => c.classList.remove('active'));
        document.querySelector(`.color-circle[data-color="${color}"]`).classList.add('active');

        // Apply highlight to sentence
        this.applyHighlightToSentence(selectedSentence, color);
      }

      // Keep palette open so user can change colors or toggle off
    } catch (error) {
      console.error('Failed to handle color selection:', error);
      alert('Failed to save annotation');
    }
  },

  /**
   * Get annotation for a specific sentence (user: andrew)
   */
  async getAnnotationForSentence(sentenceId) {
    const response = await fetch(`${this.apiBaseUrl}/annotations/sentence/${sentenceId}`);
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }
    const data = await response.json();
    const annotations = data.annotations || [];
    // Return first annotation (should only be one per sentence per user)
    return annotations.length > 0 ? annotations[0] : null;
  },

  /**
   * Create new highlight annotation
   */
  async createHighlightAnnotation(sentenceId, color) {
    const response = await fetch(`${this.apiBaseUrl}/annotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sentence_id: sentenceId,
        color: color,
        note: null,
        priority: 'none',
        flagged: false
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return await response.json();
  },

  /**
   * Update annotation color
   */
  async updateAnnotationColor(annotationId, sentenceId, color) {
    // Get current note text from input field
    const noteInput = document.getElementById('note-input');
    const noteText = noteInput ? noteInput.value.trim() : '';

    // Get annotation from local array to preserve other fields
    const annotation = this.annotations.find(a => a.annotation_id === annotationId);

    const response = await fetch(`${this.apiBaseUrl}/annotations/${annotationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sentence_id: sentenceId,
        color: color,
        note: noteText || null,
        priority: annotation?.priority || 'none',
        flagged: annotation?.flagged || false
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return await response.json();
  },

  /**
   * Apply highlight styling to a sentence element
   * Updates ALL fragments with the same sentence_id
   */
  applyHighlightToSentence(sentenceElement, color) {
    const sentenceId = sentenceElement.dataset.sentenceId;
    if (!sentenceId) return;

    // Find ALL fragments with this sentence_id (including across pages)
    const allFragments = document.querySelectorAll(`.sentence[data-sentence-id="${sentenceId}"]`);

    // Remove existing highlight classes from all fragments
    const highlightColors = ['yellow', 'green', 'blue', 'purple', 'red', 'orange'];
    allFragments.forEach(fragment => {
      highlightColors.forEach(c => fragment.classList.remove(`highlight-${c}`));
      // Keep selected class so user can continue changing/deleting the highlight
    });

    // Add new highlight class to all fragments
    allFragments.forEach(fragment => {
      fragment.classList.add(`highlight-${color}`);
    });
  },

  /**
   * Initialize and position the annotation margin container
   */
  initAnnotationMargin() {
    const margin = document.getElementById('annotation-margin');
    if (!margin) return;

    // Position margin based on window size
    const positionMargin = () => {
      const pageWidth = 576; // Width of .pagedjs_page
      const windowWidth = window.innerWidth;
      const marginWidth = (windowWidth - pageWidth) / 2;

      // Calculate available space for annotations (leave 40px padding)
      const availableWidth = Math.max(200, marginWidth - 40);

      // Position from right edge
      const rightOffset = Math.max(20, marginWidth - availableWidth - 20);

      margin.style.right = `${rightOffset}px`;
      margin.style.width = `${Math.min(availableWidth, 400)}px`; // Max 400px
    };

    // Position on load and resize
    positionMargin();
    window.addEventListener('resize', positionMargin);
  },

  /**

  /**
   * Show annotations for a specific sentence
   */
  async showAnnotationsForSentence(sentenceId, sentenceText) {
    this.currentSentenceId = sentenceId;
    this.currentSentenceText = sentenceText;

    // Reset session state
    this.currentAnnotationSession = {
      sentenceId: sentenceId,
      autoDefaultedToBlue: false,
      originalColor: null,
      lastKeystroke: null
    };

    // Show color palette
    const palette = document.getElementById('color-palette');
    if (palette) {
      palette.classList.add('visible');
    }

    // Show note container
    const noteContainer = document.getElementById('note-container');
    if (noteContainer) {
      noteContainer.classList.add('visible');
    }

    // Show tags container
    const tagsContainer = document.getElementById('tags-container');
    if (tagsContainer) {
      tagsContainer.classList.add('visible');
    }

    // Fetch annotations for this sentence to highlight current color in palette
    try {
      const response = await fetch(`${this.apiBaseUrl}/annotations/sentence/${sentenceId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      this.annotations = data.annotations || [];

      // Clear all active states
      document.querySelectorAll('.color-circle').forEach(c => c.classList.remove('active'));

      // Find annotation for this sentence (may or may not have color)
      const annotation = this.annotations[0]; // There should only be one annotation per sentence
      if (annotation) {
        // If annotation has a color, mark it as active in the palette
        if (annotation.color) {
          const activeCircle = document.querySelector(`.color-circle[data-color="${annotation.color}"]`);
          if (activeCircle) {
            activeCircle.classList.add('active');
          }
        }

        // Populate note textbox
        const noteInput = document.getElementById('note-input');
        if (noteInput) {
          noteInput.value = annotation.note || '';
        }

        // Load and render tags
        this.renderTags(annotation.tags || []);
      } else {
        // No annotation - clear note and tags
        const noteInput = document.getElementById('note-input');
        if (noteInput) {
          noteInput.value = '';
        }
        this.renderTags([]);
      }

    } catch (error) {
      console.error('Failed to fetch annotations:', error);
    }
  },








  /**
   * Delete annotation
   */
  async deleteAnnotation(annotationId, skipConfirm = false, skipUnselect = false) {
    if (!skipConfirm && !confirm('Delete this annotation?')) {
      return;
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/annotations/${annotationId}`, {
        method: 'DELETE'
      });

      if (!response.ok && response.status !== 204) {
        throw new Error(`HTTP ${response.status}`);
      }

      console.log('Annotation deleted:', annotationId);

      // Remove from local annotations array
      this.annotations = this.annotations.filter(a => a.annotation_id !== annotationId);

      // Remove highlight from UI
      const sentenceId = this.currentSentenceId;
      if (sentenceId) {
        document.querySelectorAll(`.sentence[data-sentence-id="${sentenceId}"]`).forEach(el => {
          el.classList.remove('highlight-yellow', 'highlight-green', 'highlight-blue',
                             'highlight-purple', 'highlight-red', 'highlight-orange');
        });
      }

      // Unselect the sentence (closes annotation menu) unless skipped
      if (!skipUnselect) {
        this.unselectSentence();
      } else {
        // Clear active circle since no annotation
        document.querySelectorAll('.color-circle').forEach(c => c.classList.remove('active'));
      }

    } catch (error) {
      console.error('Failed to delete annotation:', error);
      alert(`Failed to delete annotation: ${error.message}`);
    }
  },

  /**
   * Initialize note input handling
   */
  initNoteInput() {
    const noteInput = document.getElementById('note-input');
    if (!noteInput) return;

    noteInput.addEventListener('input', (e) => {
      this.handleNoteInput(e);
    });

    noteInput.addEventListener('blur', () => {
      // Save immediately on blur
      this.saveAnnotation();
    });
  },

  /**
   * Initialize tags handling
   */
  initTags() {
    const tagsContainer = document.getElementById('tags-list');
    if (!tagsContainer) return;

    // Event delegation for tag clicks
    tagsContainer.addEventListener('click', (e) => {
      if (e.target.classList.contains('tag-chip-remove')) {
        const tagChip = e.target.closest('.tag-chip');
        const tagId = parseInt(tagChip.dataset.tagId);
        const tagName = tagChip.dataset.tagName;
        this.removeTag(tagId, tagName);
      } else if (e.target.classList.contains('new-tag') || e.target.closest('.new-tag')) {
        this.addNewTag();
      }
    });
  },

  /**
   * Handle note input with default-to-blue logic
   */
  async handleNoteInput(event) {
    const noteText = event.target.value;
    const existingAnnotation = this.annotations.find(a => a.sentence_id === this.currentSentenceId);
    const hasColor = existingAnnotation && existingAnnotation.color;

    // First character typed, no color selected → default to blue
    if (noteText.length === 1 && !hasColor) {
      this.currentAnnotationSession.autoDefaultedToBlue = true;

      try {
        // Create annotation and get the response
        const apiResponse = await this.createHighlightAnnotation(this.currentSentenceId, 'blue');

        // Construct full annotation object for local array
        const newAnnotation = {
          annotation_id: apiResponse.annotation_id,
          sentence_id: this.currentSentenceId,
          color: 'blue',
          note: null,
          priority: 'none',
          flagged: false,
          tags: []
        };

        // Add to local annotations array
        this.annotations.push(newAnnotation);

        // Update active circle
        document.querySelectorAll('.color-circle').forEach(c => c.classList.remove('active'));
        const blueCircle = document.querySelector('.color-circle[data-color="blue"]');
        if (blueCircle) {
          blueCircle.classList.add('active');
        }

        // Apply highlight to sentence
        const selectedSentence = document.querySelector(`.sentence[data-sentence-id="${this.currentSentenceId}"]`);
        if (selectedSentence) {
          this.applyHighlightToSentence(selectedSentence, 'blue');
        }
      } catch (error) {
        console.error('Failed to create auto-default blue annotation:', error);
        this.currentAnnotationSession.autoDefaultedToBlue = false;
      }
    }

    // Erased all text, and we auto-defaulted → undo blue
    if (noteText.length === 0 && this.currentAnnotationSession.autoDefaultedToBlue) {
      if (this.shouldUndoAutoBlue()) {
        const annotation = this.annotations.find(a => a.sentence_id === this.currentSentenceId);
        if (annotation) {
          // Clear any pending auto-save
          clearTimeout(this.autoSaveTimeout);

          await this.deleteAnnotation(annotation.annotation_id, true, true); // skipConfirm=true, skipUnselect=true
          this.currentAnnotationSession.autoDefaultedToBlue = false;
          return;
        }
      }
    }

    // Schedule auto-save 1 second after last keystroke
    this.scheduleAutoSave();
  },

  /**
   * Check if we should undo auto-default blue
   */
  shouldUndoAutoBlue() {
    const annotation = this.annotations.find(a => a.sentence_id === this.currentSentenceId);
    if (!annotation) return false;

    const noteInput = document.getElementById('note-input');
    const hasNote = noteInput && noteInput.value.trim().length > 0;

    // TODO: Add checks for priority and flagged when implemented

    return this.currentAnnotationSession.autoDefaultedToBlue &&
           !hasNote &&
           annotation.color === 'blue';
  },

  /**
   * Schedule auto-save with debounce
   */
  scheduleAutoSave() {
    clearTimeout(this.autoSaveTimeout);

    this.autoSaveTimeout = setTimeout(() => {
      this.saveAnnotation();
    }, 1000); // 1 second debounce
  },

  /**
   * Save annotation (note changes)
   */
  async saveAnnotation() {
    if (!this.currentSentenceId) return;

    const noteInput = document.getElementById('note-input');
    const noteText = noteInput ? noteInput.value.trim() : '';

    const annotation = this.annotations.find(a => a.sentence_id === this.currentSentenceId);
    if (!annotation) return;

    try {
      const response = await fetch(`${this.apiBaseUrl}/annotations/${annotation.annotation_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json'},
        body: JSON.stringify({
          sentence_id: this.currentSentenceId,
          color: annotation.color,
          note: noteText || null,
          priority: annotation.priority || 'none',
          flagged: annotation.flagged || false
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      // Update local annotation
      annotation.note = noteText || null;

    } catch (error) {
      console.error('Failed to save note:', error);
      alert('Failed to save note');
    }
  },

  /**
   * Render tags list
   */
  renderTags(tags) {
    const tagsList = document.getElementById('tags-list');
    if (!tagsList) return;

    tagsList.innerHTML = '';

    // Render existing tags (now tag objects with tag_id and tag_name)
    tags.forEach(tag => {
      const chip = document.createElement('div');
      chip.className = 'tag-chip';
      chip.dataset.tagId = tag.tag_id;
      chip.dataset.tagName = tag.tag_name;
      chip.innerHTML = `
        <span>${tag.tag_name}</span>
        <span class="tag-chip-remove">×</span>
      `;
      tagsList.appendChild(chip);
    });

    // Add "new tag" chip
    const newTagChip = document.createElement('div');
    newTagChip.className = 'tag-chip new-tag';
    newTagChip.innerHTML = '+ tag';
    tagsList.appendChild(newTagChip);
  },

  /**
   * Add new tag
   */
  async addNewTag() {
    const tagName = prompt('Enter tag name (lowercase, dash-separated):');
    if (!tagName) return;

    // Validate tag name
    const valid = /^[a-z0-9-]+$/.test(tagName);
    if (!valid) {
      alert('Invalid tag name. Use only lowercase letters, numbers, and dashes.');
      return;
    }

    let annotation = this.annotations.find(a => a.sentence_id === this.currentSentenceId);

    // If no annotation exists yet, create one with blue color first
    if (!annotation || !annotation.annotation_id) {
      try {
        // Create annotation with blue color
        await this.handleColorSelection('blue');
        this.currentAnnotationSession.autoDefaultedToBlue = true;

        // Get the newly created annotation
        annotation = this.annotations.find(a => a.sentence_id === this.currentSentenceId);

        if (!annotation || !annotation.annotation_id) {
          alert('Failed to create annotation');
          return;
        }
      } catch (error) {
        alert(`Error creating annotation: ${error.message}`);
        return;
      }
    }

    try {
      // Get migration ID from global state (set by renderer)
      const migrationId = window.WriteSysRenderer?.currentMigrationID;
      if (!migrationId) {
        throw new Error('Migration ID not available');
      }

      const response = await fetch(`${this.apiBaseUrl}/annotations/${annotation.annotation_id}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag_name: tagName,
          migration_id: migrationId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      annotation.tags = data.tags;
      this.renderTags(data.tags);
    } catch (error) {
      console.error('Failed to add tag:', error);
      alert(`Failed to add tag: ${error.message}`);
    }
  },

  /**
   * Remove tag
   */
  async removeTag(tagId, tagName) {
    const annotation = this.annotations.find(a => a.sentence_id === this.currentSentenceId);
    if (!annotation || !annotation.annotation_id) return;

    try {
      const response = await fetch(`${this.apiBaseUrl}/annotations/${annotation.annotation_id}/tags/${tagId}`, {
        method: 'DELETE'
      });

      if (!response.ok && response.status !== 204) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Remove from local tags array
      annotation.tags = annotation.tags.filter(t => t.tag_id !== tagId);
      this.renderTags(annotation.tags);

      // If this was the last tag AND we auto-defaulted to blue AND there's no note, undo the auto-blue
      if (annotation.tags.length === 0 &&
          this.currentAnnotationSession.autoDefaultedToBlue &&
          (!annotation.note || annotation.note.trim() === '')) {
        await this.deleteAnnotation(annotation.annotation_id, true); // skipUnselect = true
      }
    } catch (error) {
      console.error('Failed to remove tag:', error);
      alert(`Failed to remove tag: ${error.message}`);
    }
  },

  /**
   * Unselect sentence - this is the single action that closes the annotation menu
   */
  unselectSentence() {
    // Save any pending note changes before unselecting
    clearTimeout(this.autoSaveTimeout);
    this.saveAnnotation();

    // Hide color palette
    const palette = document.getElementById('color-palette');
    if (palette) {
      palette.classList.remove('visible');
    }

    // Hide note container
    const noteContainer = document.getElementById('note-container');
    if (noteContainer) {
      noteContainer.classList.remove('visible');
    }

    // Hide tags container
    const tagsContainer = document.getElementById('tags-container');
    if (tagsContainer) {
      tagsContainer.classList.remove('visible');
    }

    // Remove selection from sentences
    document.querySelectorAll('.sentence.selected').forEach(s => s.classList.remove('selected'));

    // Clear the renderer's selected sentence tracking
    if (window.WriteSysRenderer) {
      window.WriteSysRenderer.currentSelectedSentenceId = null;
    }

    // Reset session state
    this.currentAnnotationSession = {
      sentenceId: null,
      autoDefaultedToBlue: false,
      originalColor: null,
      lastKeystroke: null
    };
  },

};

// Export for other modules BEFORE initialization
window.WriteSysAnnotations = WriteSysAnnotations;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => WriteSysAnnotations.init());
} else {
  WriteSysAnnotations.init();
}
