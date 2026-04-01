// WriteSys Annotations
// Handles annotation sidebar, CRUD operations, and UI interactions

const WriteSysAnnotations = {
  apiBaseUrl: 'http://localhost:5003/api',
  currentSentenceId: null,
  currentSentenceText: '',
  annotations: [],
  autoSaveTimeout: null,

  // Available annotation colors
  COLORS: ['yellow', 'green', 'blue', 'purple', 'red', 'orange'],

  // Spacing constants - must match CSS variables in book.css
  SPACING: {
    PAGE_WIDTH: 576,           // Width of .pagedjs_page
    ANNOTATION_WIDTH: 240,     // --annotation-width
    HORIZONTAL_GAP: 32,        // --horizontal-gap (page to annotation margin)
  },

  // Session state for default-to-blue logic
  currentAnnotationSession: {
    sentenceId: null,
    autoDefaultedToBlue: false,
    originalColor: null,
    lastKeystroke: null,
    committed: false  // Set to true if P or flag is selected
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

    // Initialize priority/flag chips
    this.initPriorityFlagChips();

    // Initialize trash icon for deletion
    this.initTrashIcon();

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
      // If clicking the same color that's already applied, do nothing (use trash can to delete)
      if (existingAnnotation && existingAnnotation.color === color) {
        return;
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

        // Update sticky note background color
        this.applyStickyNoteColor(color);
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

        // Update sticky note background color
        this.applyStickyNoteColor(color);

        // Show P/flag section since annotation now exists
        this.showPriorityFlagSection();

        // Update P/flag UI
        this.updatePriorityFlagUI(newAnnotation);
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
    // Return first annotation (if multiple exist, pick first for display)
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
   * Apply color class to sticky note container
   * @param {string} color - Color name (yellow, green, blue, purple, red, orange) or null for grey
   */
  applyStickyNoteColor(color) {
    const stickyNote = document.getElementById('sticky-note-container');
    if (!stickyNote) return;

    // Remove all color classes
    this.COLORS.forEach(c => stickyNote.classList.remove(`color-${c}`));

    // Add new color class
    if (color) {
      stickyNote.classList.add(`color-${color}`);
    }
  },

  /**
   * Remove color from sticky note (revert to grey)
   */
  removeStickyNoteColor() {
    const stickyNote = document.getElementById('sticky-note-container');
    if (!stickyNote) return;

    // Remove all color classes (reverts to default grey background)
    this.COLORS.forEach(c => stickyNote.classList.remove(`color-${c}`));
  },

  /**
   * Initialize and position the annotation margin container
   */
  initAnnotationMargin() {
    const margin = document.getElementById('annotation-margin');
    if (!margin) return;

    // Position margin based on window size
    const positionMargin = () => {
      const windowWidth = window.innerWidth;
      const marginWidth = (windowWidth - this.SPACING.PAGE_WIDTH) / 2;

      // CONSTANT gap from page edge - matches vertical gap between pages
      // Position: distance from viewport right edge
      // = marginWidth (to page right) - gap - containerWidth
      const rightPosition = marginWidth - this.SPACING.HORIZONTAL_GAP - this.SPACING.ANNOTATION_WIDTH;

      margin.style.right = `${rightPosition}px`;
    };

    // Position on load and resize
    positionMargin();
    window.addEventListener('resize', positionMargin);
  },

  /**
   * Show annotations for a specific sentence
   * @param {string} sentenceId - The ID of the sentence to annotate
   * @param {string} sentenceText - The full text of the sentence
   */
  async showAnnotationsForSentence(sentenceId, sentenceText) {
    this.currentSentenceId = sentenceId;
    this.currentSentenceText = sentenceText;

    // Reset trash can state (in case it was "ran away" from previous sentence)
    this.cancelTrashRunAway();

    // Reset session state
    this.currentAnnotationSession = {
      sentenceId: sentenceId,
      autoDefaultedToBlue: false,
      originalColor: null,
      lastKeystroke: null,
      committed: false
    };

    // Show sentence preview (first 3 words)
    const preview = document.getElementById('sentence-preview');
    if (preview) {
      const words = sentenceText.trim().split(/\s+/);
      let firstThreeWords = words.slice(0, 3).join(' ');
      // Remove trailing non-alphanumeric characters
      firstThreeWords = firstThreeWords.replace(/\W+$/, '');
      preview.textContent = `${firstThreeWords}...`;
      preview.classList.add('visible');
    }

    // Show color palette
    const palette = document.getElementById('color-palette');
    if (palette) {
      palette.classList.add('visible');
    }

    // Show sticky note container (contains note, tags, priority, flag)
    const stickyNoteContainer = document.getElementById('sticky-note-container');
    if (stickyNoteContainer) {
      stickyNoteContainer.classList.add('visible');
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
          // Apply sticky note color
          this.applyStickyNoteColor(annotation.color);
        } else {
          // No color yet - keep grey
          this.removeStickyNoteColor();
        }

        // Populate note textbox
        const noteInput = document.getElementById('note-input');
        if (noteInput) {
          noteInput.value = annotation.note || '';
          // Resize textarea to fit existing content
          noteInput.style.height = 'auto';
          noteInput.style.height = noteInput.scrollHeight + 'px';
        }

        // Load and render tags
        this.renderTags(annotation.tags || []);

        // Show P/flag section since annotation exists
        this.showPriorityFlagSection();

        // Update P/flag UI
        this.updatePriorityFlagUI(annotation);
      } else {
        // No annotation - clear note and tags
        const noteInput = document.getElementById('note-input');
        if (noteInput) {
          noteInput.value = '';
          // Reset textarea height
          noteInput.style.height = 'auto';
        }
        this.renderTags([]);

        // No color - keep grey
        this.removeStickyNoteColor();

        // Hide P/flag section
        this.hidePriorityFlagSection();
      }

    } catch (error) {
      console.error('Failed to fetch annotations:', error);
    }
  },








  /**
   * Delete annotation
   */
  async deleteAnnotation(annotationId, skipConfirm = false, skipUnselect = false) {
    // skipConfirm parameter is kept for backward compatibility but not used anymore

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

    // Auto-resize textarea function
    const autoResize = () => {
      noteInput.style.height = 'auto'; // Reset height to recalculate
      noteInput.style.height = noteInput.scrollHeight + 'px'; // Set to scroll height
    };

    noteInput.addEventListener('input', (e) => {
      this.handleNoteInput(e);
      autoResize(); // Resize on input
    });

    noteInput.addEventListener('blur', () => {
      // Save immediately on blur
      this.saveAnnotation();
    });

    // Initial resize in case there's existing content
    autoResize();
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
   * Initialize priority/flag chips handling
   */
  initPriorityFlagChips() {
    // Initialize event listeners for priority chips (P0-P3)
    document.querySelectorAll('.priority-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const priority = chip.dataset.priority;
        this.handlePriorityClick(priority);
      });
    });

    // Initialize event listener for flag chip
    const flagChip = document.querySelector('.flag-chip');
    if (flagChip) {
      flagChip.addEventListener('click', () => {
        this.handleFlagClick();
      });
    }
  },

  /**
   * Handle priority chip click (radio behavior - P0, P1, P2, P3)
   */
  async handlePriorityClick(priority) {
    let annotation = this.annotations.find(a => a.sentence_id === this.currentSentenceId);

    // If no annotation exists, create one with blue color first
    if (!annotation || !annotation.annotation_id) {
      try {
        await this.handleColorSelection('blue');
        this.currentAnnotationSession.autoDefaultedToBlue = true;
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

    // Toggle behavior: if clicking the same priority, deselect it
    const newPriority = (annotation.priority === priority) ? 'none' : priority;

    // Mark as committed (prevents auto-blue undo)
    if (newPriority !== 'none') {
      this.currentAnnotationSession.committed = true;
      this.currentAnnotationSession.autoDefaultedToBlue = false;
    }

    try {
      // Update annotation with new priority
      const response = await fetch(`${this.apiBaseUrl}/annotations/${annotation.annotation_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentence_id: this.currentSentenceId,
          color: annotation.color,
          note: annotation.note || null,
          priority: newPriority,
          flagged: annotation.flagged || false
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Update local annotation
      annotation.priority = newPriority;

      // Update UI
      this.updatePriorityFlagUI(annotation);

    } catch (error) {
      console.error('Failed to update priority:', error);
      alert('Failed to update priority');
    }
  },

  /**
   * Handle flag chip click (toggle behavior)
   */
  async handleFlagClick() {
    let annotation = this.annotations.find(a => a.sentence_id === this.currentSentenceId);

    // If no annotation exists, create one with blue color first
    if (!annotation || !annotation.annotation_id) {
      try {
        await this.handleColorSelection('blue');
        this.currentAnnotationSession.autoDefaultedToBlue = true;
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

    // Toggle flagged state
    const newFlagged = !annotation.flagged;

    // Mark as committed (prevents auto-blue undo)
    if (newFlagged) {
      this.currentAnnotationSession.committed = true;
      this.currentAnnotationSession.autoDefaultedToBlue = false;
    }

    try {
      // Update annotation with new flagged state
      const response = await fetch(`${this.apiBaseUrl}/annotations/${annotation.annotation_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentence_id: this.currentSentenceId,
          color: annotation.color,
          note: annotation.note || null,
          priority: annotation.priority || 'none',
          flagged: newFlagged
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Update local annotation
      annotation.flagged = newFlagged;

      // Update UI
      this.updatePriorityFlagUI(annotation);

    } catch (error) {
      console.error('Failed to update flag:', error);
      alert('Failed to update flag');
    }
  },

  /**
   * Update priority/flag chip UI based on annotation state
   */
  updatePriorityFlagUI(annotation) {
    // Update priority chips
    document.querySelectorAll('.priority-chip').forEach(chip => {
      const priority = chip.dataset.priority;
      if (annotation.priority === priority) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });

    // Update flag chip
    const flagChip = document.querySelector('.flag-chip');
    if (flagChip) {
      if (annotation.flagged) {
        flagChip.classList.add('active');
      } else {
        flagChip.classList.remove('active');
      }
    }
  },

  /**
   * Show priority/flag section (only when annotation exists)
   */
  showPriorityFlagSection() {
    const container = document.getElementById('priority-flag-container');
    if (container) {
      container.style.display = 'block';
    }
  },

  /**
   * Hide priority/flag section
   */
  hidePriorityFlagSection() {
    const container = document.getElementById('priority-flag-container');
    if (container) {
      container.style.display = 'none';
    }
  },

  /**
   * Initialize trash icon for deletion
   */
  initTrashIcon() {
    const trashIcon = document.getElementById('trash-icon');
    const cancelDelete = document.getElementById('cancel-delete');

    if (trashIcon) {
      trashIcon.addEventListener('click', () => {
        if (trashIcon.classList.contains('ran-away')) {
          // Second click - actually delete
          this.handleTrashDelete();
        } else {
          // First click - run away
          this.showTrashRunAway();
        }
      });
    }

    if (cancelDelete) {
      cancelDelete.addEventListener('click', () => {
        this.cancelTrashRunAway();
      });
    }
  },

  /**
   * Show trash "running away" animation
   */
  showTrashRunAway() {
    const trashIcon = document.getElementById('trash-icon');
    const cancelDelete = document.getElementById('cancel-delete');

    if (trashIcon) {
      trashIcon.classList.add('ran-away');
    }

    if (cancelDelete) {
      cancelDelete.classList.add('visible');
    }
  },

  /**
   * Cancel trash run away - return to normal
   */
  cancelTrashRunAway() {
    const trashIcon = document.getElementById('trash-icon');
    const cancelDelete = document.getElementById('cancel-delete');

    if (trashIcon) {
      trashIcon.classList.remove('ran-away');
    }

    if (cancelDelete) {
      cancelDelete.classList.remove('visible');
    }
  },

  /**
   * Handle actual deletion when trash is clicked second time
   */
  async handleTrashDelete() {
    const annotation = this.annotations.find(a => a.sentence_id === this.currentSentenceId);

    if (annotation && annotation.annotation_id) {
      await this.deleteAnnotation(annotation.annotation_id, true); // skipConfirm = true
    }

    // Reset trash state
    this.cancelTrashRunAway();
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

        // Apply sticky note color
        this.applyStickyNoteColor('blue');

        // Show P/flag section since annotation now exists
        this.showPriorityFlagSection();

        // Update P/flag UI
        this.updatePriorityFlagUI(newAnnotation);
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

          // Revert sticky note to grey before deleting
          this.removeStickyNoteColor();

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

    // Don't undo if committed via P/flag selection
    if (this.currentAnnotationSession.committed) {
      return false;
    }

    // Don't undo if priority is set or flagged
    if (annotation.priority && annotation.priority !== 'none') {
      return false;
    }
    if (annotation.flagged) {
      return false;
    }

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
    // Create inline editable chip
    this.createEditableTagChip();
  },

  /**
   * Create inline editable tag chip
   */
  createEditableTagChip() {
    const tagsList = document.getElementById('tags-list');
    const newTagChip = tagsList.querySelector('.new-tag');

    // Create editable input styled as a chip
    const editableChip = document.createElement('div');
    editableChip.className = 'tag-chip editable-tag';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tag-input';
    input.placeholder = 'tag-name';
    input.maxLength = 50;

    editableChip.appendChild(input);

    // Insert before the "+tag" chip
    tagsList.insertBefore(editableChip, newTagChip);

    // Focus the input
    input.focus();

    // Flag to track if tag creation was cancelled
    let cancelled = false;

    // Handle finishing tag creation
    const finishTagCreation = async (e) => {
      if (cancelled) return;

      const tagName = input.value.trim();

      // Remove the editable chip
      editableChip.remove();

      if (!tagName) return;

      // Validate and create tag
      await this.finalizeTagCreation(tagName);
    };

    // Listen for completion events
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Tab') {
        e.preventDefault();
        finishTagCreation(e);
      } else if (e.key === 'Escape') {
        cancelled = true;
        editableChip.remove();
      }
    });

    input.addEventListener('blur', finishTagCreation);
  },

  /**
   * Finalize tag creation with validation
   */
  async finalizeTagCreation(tagName) {
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

    // Hide sentence preview
    const preview = document.getElementById('sentence-preview');
    if (preview) {
      preview.classList.remove('visible');
    }

    // Hide color palette
    const palette = document.getElementById('color-palette');
    if (palette) {
      palette.classList.remove('visible');
    }

    // Hide sticky note container (contains note, tags, priority, flag)
    const stickyNoteContainer = document.getElementById('sticky-note-container');
    if (stickyNoteContainer) {
      stickyNoteContainer.classList.remove('visible');
    }

    // Clear sticky note color (will be reset when next sentence is selected)
    this.removeStickyNoteColor();

    // Hide priority/flag container
    this.hidePriorityFlagSection();

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
      lastKeystroke: null,
      committed: false
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
