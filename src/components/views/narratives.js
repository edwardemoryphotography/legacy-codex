import { db } from '../../lib/supabase.js';
import { escapeHtml, formatDate, showToast } from '../../lib/utils.js';

export async function renderNarratives(container, user) {
  container.innerHTML = `
    <div class="view-section">
      <div class="section-header">
        <h2>Narratives</h2>
        <button id="new-narrative-btn" class="btn btn-primary" style="width:auto">New Narrative</button>
      </div>
      <div id="narratives-list" class="list-container">
        <div class="loading"><div class="spinner"></div>Loading narratives...</div>
      </div>
    </div>

    <div id="new-narrative-modal" class="modal">
      <div class="modal-content">
        <div class="modal-handle"></div>
        <h3>Create New Narrative</h3>
        <form id="new-narrative-form">
          <div class="form-group">
            <label for="narrative-title">Title</label>
            <input type="text" id="narrative-title" required placeholder="Name your narrative" />
          </div>
          <div class="form-group">
            <label for="narrative-content">Content</label>
            <textarea id="narrative-content" rows="6" placeholder="Tell the story..."></textarea>
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" id="narrative-public" />
              Make this narrative public
            </label>
          </div>
          <div class="form-actions">
            <button type="button" id="cancel-narrative-btn" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary">Create</button>
          </div>
        </form>
      </div>
    </div>

    <div id="delete-narrative-modal" class="modal">
      <div class="modal-content">
        <div class="modal-handle"></div>
        <h3>Delete Narrative</h3>
        <div class="confirm-dialog">
          <p>Are you sure you want to delete this narrative?</p>
          <div class="form-actions">
            <button type="button" id="cancel-delete-narrative" class="btn btn-secondary">Cancel</button>
            <button type="button" id="confirm-delete-narrative" class="btn btn-danger">Delete</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const newModal = container.querySelector('#new-narrative-modal');
  const deleteModal = container.querySelector('#delete-narrative-modal');
  let deleteTargetId = null;

  container.querySelector('#new-narrative-btn').addEventListener('click', () => newModal.classList.add('show'));
  container.querySelector('#cancel-narrative-btn').addEventListener('click', () => newModal.classList.remove('show'));
  newModal.addEventListener('click', (e) => { if (e.target === newModal) newModal.classList.remove('show'); });
  deleteModal.addEventListener('click', (e) => { if (e.target === deleteModal) deleteModal.classList.remove('show'); });
  container.querySelector('#cancel-delete-narrative').addEventListener('click', () => deleteModal.classList.remove('show'));

  container.querySelector('#confirm-delete-narrative').addEventListener('click', async () => {
    if (!deleteTargetId) return;
    try {
      await db.narratives.delete(deleteTargetId);
      showToast('Narrative deleted', 'success');
      deleteModal.classList.remove('show');
      loadNarratives(container, user, deleteModal, (id) => { deleteTargetId = id; });
    } catch (error) {
      showToast('Failed to delete: ' + error.message, 'error');
    }
  });

  container.querySelector('#new-narrative-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = container.querySelector('#narrative-title').value;
    const content = container.querySelector('#narrative-content').value;
    const isPublic = container.querySelector('#narrative-public').checked;

    try {
      await db.narratives.create(user.id, title, content, [], isPublic);
      newModal.classList.remove('show');
      container.querySelector('#new-narrative-form').reset();
      showToast('Narrative created', 'success');
      loadNarratives(container, user, deleteModal, (id) => { deleteTargetId = id; });
    } catch (error) {
      showToast('Failed to create narrative: ' + error.message, 'error');
    }
  });

  loadNarratives(container, user, deleteModal, (id) => { deleteTargetId = id; });
}

async function loadNarratives(container, user, deleteModal, setDeleteTarget) {
  const listContainer = container.querySelector('#narratives-list');

  try {
    const narratives = await db.narratives.list(user.id, true);

    if (narratives.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">&#9733;</div>
          <p>No narratives yet</p>
          <p>Capture stories and case studies from your successful collaborations.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = narratives.map(narrative => `
      <div class="list-item">
        <div class="item-header">
          <h3>${escapeHtml(narrative.title)}</h3>
          <div class="item-actions">
            ${narrative.user_id === user.id ? `<button class="btn btn-icon btn-ghost delete-narrative-btn" data-id="${narrative.id}" title="Delete">&#10005;</button>` : ''}
            ${narrative.is_public ? '<span class="badge badge-public">Public</span>' : '<span class="badge badge-private">Private</span>'}
          </div>
        </div>
        ${narrative.content ? `<p class="item-preview">${escapeHtml(narrative.content.substring(0, 200))}${narrative.content.length > 200 ? '...' : ''}</p>` : ''}
        <div class="item-meta">
          <span>${formatDate(narrative.created_at)}</span>
        </div>
      </div>
    `).join('');

    listContainer.querySelectorAll('.delete-narrative-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setDeleteTarget(btn.dataset.id);
        deleteModal.classList.add('show');
      });
    });
  } catch (error) {
    listContainer.innerHTML = `<div class="error">Error loading narratives: ${error.message}</div>`;
  }
}
