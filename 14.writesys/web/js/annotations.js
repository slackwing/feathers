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
    // Close sidebar button
    document.getElementById('close-sidebar').addEventListener('click', () => this.hideSidebar());

    // Annotation type selector
    document.getElementById('annotation-type').addEventListener('change', (e) => {
      this.showAnnotationOptions(e.target.value);
    });

    // Save annotation
    document.getElementById('save-annotation').addEventListener('click', () => this.saveAnnotation());

    // Cancel annotation
    document.getElementById('cancel-annotation').addEventListener('click', () => this.hideAnnotationForm());

    // Click outside sidebar to close
    document.addEventListener('click', (e) => {
      const sidebar = document.getElementById('annotation-sidebar');
      const content = document.getElementById('manuscript-content');

      if (!sidebar.contains(e.target) && content.contains(e.target)) {
        this.hideSidebar();
      }
    });

    console.log('WriteSys Annotations initialized');
  },

  /**
   * Show annotations for a specific sentence
   */
  async showAnnotationsForSentence(sentenceId, sentenceText) {
    this.currentSentenceId = sentenceId;
    this.currentSentenceText = sentenceText;

    // Update sentence text display
    document.getElementById('selected-sentence-text').textContent = `"${sentenceText.trim()}"`;

    // Show sidebar
    const sidebar = document.getElementById('annotation-sidebar');
    sidebar.classList.remove('hidden');
    sidebar.classList.add('visible');

    // Fetch annotations for this sentence
    try {
      const response = await fetch(`${this.apiBaseUrl}/annotations/sentence/${sentenceId}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      this.annotations = data.annotations || [];

      // Render annotations
      this.renderAnnotations();

    } catch (error) {
      console.error('Failed to fetch annotations:', error);
      document.getElementById('annotation-list').innerHTML = '<p style="color: #999;">Failed to load annotations</p>';
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
  async deleteAnnotation(annotationId) {
    if (!confirm('Delete this annotation?')) {
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

      // Refresh annotations
      await this.showAnnotationsForSentence(this.currentSentenceId, this.currentSentenceText);

      // Reload manuscript to update styling
      if (window.WriteSysRenderer) {
        window.WriteSysRenderer.loadManuscript();
      }

    } catch (error) {
      console.error('Failed to delete annotation:', error);
      alert(`Failed to delete annotation: ${error.message}`);
    }
  },

  /**
   * Hide sidebar
   */
  hideSidebar() {
    const sidebar = document.getElementById('annotation-sidebar');
    sidebar.classList.add('hidden');
    sidebar.classList.remove('visible');

    // Remove selection from sentences
    document.querySelectorAll('.sentence.selected').forEach(s => s.classList.remove('selected'));
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
