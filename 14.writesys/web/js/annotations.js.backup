// WriteSys Annotations
// Handles annotation sidebar, CRUD operations, and UI interactions

const WriteSysAnnotations = {
  apiBaseUrl: 'http://localhost:5003/api',
  currentSentenceId: null,
  currentSentenceText: '',
  annotations: [],

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
    if (!selectedSentence) {
      console.log('No sentence selected');
      return;
    }

    const sentenceId = selectedSentence.dataset.sentenceId;
    if (!sentenceId) {
      console.error('Selected sentence has no sentence_id');
      return;
    }

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
        // Update existing annotation to new color
        await this.updateAnnotationColor(existingAnnotation.annotation_id, sentenceId, color);
        console.log(`Updated annotation ${existingAnnotation.annotation_id} to color: ${color}`);

        // Update active circle
        document.querySelectorAll('.color-circle').forEach(c => c.classList.remove('active'));
        document.querySelector(`.color-circle[data-color="${color}"]`).classList.add('active');

        // Apply highlight to sentence
        this.applyHighlightToSentence(selectedSentence, color);
      } else {
        // Create new annotation
        await this.createHighlightAnnotation(sentenceId, color);
        console.log(`Created new annotation for sentence ${sentenceId} with color: ${color}`);

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
    const response = await fetch(`${this.apiBaseUrl}/annotations/${annotationId}`, {
      method: 'PUT',
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
   * Format sentence text for preview
   * - No quotes
   * - Remove leading punctuation
   * - Keep trailing punctuation
   */
  formatSentencePreview(text) {
    let formatted = text.trim();

    // Remove leading punctuation (but not letters/numbers)
    formatted = formatted.replace(/^[.,;:!?]+/, '');

    return formatted;
  },

  /**
   * Show annotations for a specific sentence
   */
  async showAnnotationsForSentence(sentenceId, sentenceText) {
    this.currentSentenceId = sentenceId;
    this.currentSentenceText = sentenceText;

    // Show color palette
    const palette = document.getElementById('color-palette');
    if (palette) {
      palette.classList.add('visible');
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

      // If sentence has a highlight, mark that color as active in the palette
      const annotation = this.annotations.find(a => a.color);
      if (annotation && annotation.color) {
        const activeCircle = document.querySelector(`.color-circle[data-color="${annotation.color}"]`);
        if (activeCircle) {
          activeCircle.classList.add('active');
        }
      }

    } catch (error) {
      console.error('Failed to fetch annotations:', error);
    }
  },

  /**
   * Render annotations list
   */
  renderAnnotations() {
    const container = document.getElementById('annotation-list');

    if (this.annotations.length === 0) {
      container.innerHTML = `
        <p style="font-size: 12px; color: #999; font-family: Helvetica, sans-serif;">
          No annotations yet.
          <a href="#" style="color: #007bff; text-decoration: none;" onclick="WriteSysAnnotations.showAnnotationForm(); return false;">Add one?</a>
        </p>
      `;
      return;
    }

    container.innerHTML = this.annotations.map(annotation => `
      <div class="annotation-item" data-annotation-id="${annotation.annotation_id}">
        <div class="annotation-header">
          <span class="annotation-type">${annotation.type}</span>
          <div class="annotation-actions">
            <button onclick="WriteSysAnnotations.editAnnotation(${annotation.annotation_id})">Edit</button>
            <button onclick="WriteSysAnnotations.deleteAnnotation(${annotation.annotation_id})">Delete</button>
          </div>
        </div>
        <div class="annotation-content">
          ${this.renderAnnotationContent(annotation)}
        </div>
        ${annotation.note ? `<div class="annotation-note">${annotation.note}</div>` : ''}
      </div>
    `).join('');

    // Show add annotation button
    container.innerHTML += `
      <button style="margin-top: 10px; width: 100%; padding: 10px; font-family: Helvetica, sans-serif; font-size: 12px; background: #f8f9fa; border: 1px dashed #dee2e6; border-radius: 4px; cursor: pointer;"
        onclick="WriteSysAnnotations.showAnnotationForm()">
        + Add Annotation
      </button>
    `;
  },

  /**
   * Render annotation type-specific content
   */
  renderAnnotationContent(annotation) {
    // Note: payload is currently not being returned by API
    // This is simplified for now
    if (annotation.type === 'highlight') {
      return '<span style="padding: 3px 8px; background: rgba(255, 255, 0, 0.3); border-radius: 3px;">Highlight</span>';
    } else if (annotation.type === 'tag') {
      return '<span style="color: #007bff;">📌 Tag</span>';
    } else if (annotation.type === 'task') {
      return '<span style="color: #ff6b6b;">✓ Task</span>';
    }
    return '';
  },

  /**
   * Show annotation form
   */
  showAnnotationForm() {
    document.getElementById('annotation-form').classList.remove('hidden');
    document.getElementById('annotation-list').style.display = 'none';

    // Reset form
    document.getElementById('annotation-type').value = 'highlight';
    this.showAnnotationOptions('highlight');
    document.getElementById('annotation-note').value = '';
  },

  /**
   * Hide annotation form
   */
  hideAnnotationForm() {
    document.getElementById('annotation-form').classList.add('hidden');
    document.getElementById('annotation-list').style.display = 'block';
  },

  /**
   * Show appropriate annotation options based on type
   */
  showAnnotationOptions(type) {
    document.getElementById('highlight-options').classList.add('hidden');
    document.getElementById('tag-options').classList.add('hidden');
    document.getElementById('task-options').classList.add('hidden');

    if (type === 'highlight') {
      document.getElementById('highlight-options').classList.remove('hidden');
    } else if (type === 'tag') {
      document.getElementById('tag-options').classList.remove('hidden');
    } else if (type === 'task') {
      document.getElementById('task-options').classList.remove('hidden');
    }
  },

  /**
   * Save annotation (create or update)
   */
  async saveAnnotation() {
    const type = document.getElementById('annotation-type').value;
    const note = document.getElementById('annotation-note').value;

    // Build payload based on type
    let payload = { note: note || '' };

    if (type === 'highlight') {
      payload.color = document.getElementById('highlight-color').value;
    } else if (type === 'tag') {
      payload.tag = document.getElementById('tag-value').value;
    } else if (type === 'task') {
      payload.description = document.getElementById('task-description').value;
      payload.priority = document.getElementById('task-priority').value;
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: type,
          sentence_id: this.currentSentenceId,
          payload: payload
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const result = await response.json();
      console.log('Annotation created:', result);

      // Refresh annotations
      await this.showAnnotationsForSentence(this.currentSentenceId, this.currentSentenceText);

      // Hide form
      this.hideAnnotationForm();

      // Reload manuscript to show new annotation styling
      if (window.WriteSysRenderer) {
        window.WriteSysRenderer.loadManuscript();
      }

    } catch (error) {
      console.error('Failed to save annotation:', error);
      alert(`Failed to save annotation: ${error.message}`);
    }
  },

  /**
   * Edit annotation
   */
  async editAnnotation(annotationId) {
    // For now, just show a simple prompt
    // In future, could populate the form with current values
    alert('Edit functionality coming soon! For now, you can delete and create a new annotation.');
  },

  /**
   * Delete annotation
   */
  async deleteAnnotation(annotationId, skipConfirm = false) {
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

      // Unselect the sentence (closes annotation menu)
      this.unselectSentence();

    } catch (error) {
      console.error('Failed to delete annotation:', error);
      alert(`Failed to delete annotation: ${error.message}`);
    }
  },

  /**
   * Unselect sentence - this is the single action that closes the annotation menu
   */
  unselectSentence() {
    // Hide color palette
    const palette = document.getElementById('color-palette');
    if (palette) {
      palette.classList.remove('visible');
    }

    // Remove selection from sentences
    document.querySelectorAll('.sentence.selected').forEach(s => s.classList.remove('selected'));

    // Clear the renderer's selected sentence tracking
    if (window.WriteSysRenderer) {
      window.WriteSysRenderer.currentSelectedSentenceId = null;
    }
  },

  /**
   * @deprecated Use unselectSentence() instead
   */
  hideColorPalette() {
    this.unselectSentence();
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => WriteSysAnnotations.init());
} else {
  WriteSysAnnotations.init();
}

// Export for other modules
window.WriteSysAnnotations = WriteSysAnnotations;
