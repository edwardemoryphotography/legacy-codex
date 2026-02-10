import { db } from '../../lib/supabase.js';
import { escapeHtml, formatDate, showToast } from '../../lib/utils.js';

export async function renderArtifacts(container, user) {
  container.innerHTML = `
    <div class="view-section">
      <div class="section-header">
        <h2>Artifacts</h2>
        <button id="new-artifact-btn" class="btn btn-primary" style="width:auto">New Artifact</button>
      </div>
      <div id="artifacts-list" class="list-container">
        <div class="loading"><div class="spinner"></div>Loading artifacts...</div>
      </div>
    </div>

    <div id="new-artifact-modal" class="modal">
      <div class="modal-content">
        <div class="modal-handle"></div>
        <h3>Create New Artifact</h3>
        <form id="new-artifact-form">
          <div class="form-group">
            <label for="artifact-title">Title</label>
            <input type="text" id="artifact-title" required placeholder="Name your artifact" />
          </div>
          <div class="form-group">
            <label for="artifact-type">Type</label>
            <select id="artifact-type" required>
              <option value="note">Note</option>
              <option value="code">Code</option>
              <option value="document">Document</option>
              <option value="diagram">Diagram</option>
              <option value="framework">Framework</option>
            </select>
          </div>
          <div class="form-group">
            <label for="artifact-content">Content</label>
            <textarea id="artifact-content" rows="6" placeholder="Capture your work product..."></textarea>
          </div>
          <div class="form-actions">
            <button type="button" id="cancel-artifact-btn" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary">Create</button>
          </div>
        </form>
      </div>
    </div>

    <div id="delete-artifact-modal" class="modal">
      <div class="modal-content">
        <div class="modal-handle"></div>
        <h3>Delete Artifact</h3>
        <div class="confirm-dialog">
          <p>Are you sure you want to delete this artifact?</p>
          <div class="form-actions">
            <button type="button" id="cancel-delete-artifact" class="btn btn-secondary">Cancel</button>
            <button type="button" id="confirm-delete-artifact" class="btn btn-danger">Delete</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const newModal = container.querySelector('#new-artifact-modal');
  const deleteModal = container.querySelector('#delete-artifact-modal');
  let deleteTargetId = null;

  container.querySelector('#new-artifact-btn').addEventListener('click', () => newModal.classList.add('show'));
  container.querySelector('#cancel-artifact-btn').addEventListener('click', () => newModal.classList.remove('show'));
  newModal.addEventListener('click', (e) => { if (e.target === newModal) newModal.classList.remove('show'); });
  deleteModal.addEventListener('click', (e) => { if (e.target === deleteModal) deleteModal.classList.remove('show'); });
  container.querySelector('#cancel-delete-artifact').addEventListener('click', () => deleteModal.classList.remove('show'));

  container.querySelector('#confirm-delete-artifact').addEventListener('click', async () => {
    if (!deleteTargetId) return;
    try {
      await db.artifacts.delete(deleteTargetId);
      showToast('Artifact deleted', 'success');
      deleteModal.classList.remove('show');
      loadArtifacts(container, user, deleteModal, (id) => { deleteTargetId = id; });
    } catch (error) {
      showToast('Failed to delete: ' + error.message, 'error');
    }
  });

  container.querySelector('#new-artifact-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = container.querySelector('#artifact-title').value;
    const type = container.querySelector('#artifact-type').value;
    const content = container.querySelector('#artifact-content').value;

    try {
      await db.artifacts.create(user.id, title, type, content);
      newModal.classList.remove('show');
      container.querySelector('#new-artifact-form').reset();
      showToast('Artifact created', 'success');
      loadArtifacts(container, user, deleteModal, (id) => { deleteTargetId = id; });
    } catch (error) {
      showToast('Failed to create artifact: ' + error.message, 'error');
    }
  });

  loadArtifacts(container, user, deleteModal, (id) => { deleteTargetId = id; });
}

async function loadArtifacts(container, user, deleteModal, setDeleteTarget) {
  const listContainer = container.querySelector('#artifacts-list');

  try {
    const artifacts = await db.artifacts.list(user.id);

    if (artifacts.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">&#9830;</div>
          <p>No artifacts yet</p>
          <p>Create artifacts to capture your work products from collaboration sessions.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = artifacts.map(artifact => `
      <div class="list-item">
        <div class="item-header">
          <h3>${escapeHtml(artifact.title)}</h3>
          <div class="item-actions">
            <button class="btn btn-icon btn-ghost delete-artifact-btn" data-id="${artifact.id}" title="Delete">&#10005;</button>
            <span class="badge badge-${artifact.type}">${artifact.type}</span>
          </div>
        </div>
        ${artifact.content ? `<p class="item-preview">${escapeHtml(artifact.content.substring(0, 150))}${artifact.content.length > 150 ? '...' : ''}</p>` : ''}
        <div class="item-meta">
          <span>${formatDate(artifact.created_at)}</span>
        </div>
      </div>
    `).join('');

    listContainer.querySelectorAll('.delete-artifact-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setDeleteTarget(btn.dataset.id);
        deleteModal.classList.add('show');
      });
    });
  } catch (error) {
    listContainer.innerHTML = `<div class="error">Error loading artifacts: ${error.message}</div>`;
  }
}
