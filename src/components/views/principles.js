import { db } from '../../lib/supabase.js';
import { escapeHtml, showToast } from '../../lib/utils.js';

export async function renderPrinciples(container, user) {
  container.innerHTML = `
    <div class="view-section">
      <div class="section-header">
        <h2>Keystone Principles</h2>
        <button id="new-principle-btn" class="btn btn-primary" style="width:auto">New Principle</button>
      </div>
      <div id="principles-list" class="list-container">
        <div class="loading"><div class="spinner"></div>Loading principles...</div>
      </div>
    </div>

    <div id="new-principle-modal" class="modal">
      <div class="modal-content">
        <div class="modal-handle"></div>
        <h3>Define New Principle</h3>
        <form id="new-principle-form">
          <div class="form-group">
            <label for="principle-title">Title</label>
            <input type="text" id="principle-title" required placeholder="Name your principle" />
          </div>
          <div class="form-group">
            <label for="principle-category">Category</label>
            <select id="principle-category" required>
              <option value="methodology">Methodology</option>
              <option value="mindset">Mindset</option>
              <option value="practice">Practice</option>
              <option value="value">Value</option>
            </select>
          </div>
          <div class="form-group">
            <label for="principle-description">Description</label>
            <textarea id="principle-description" rows="4" placeholder="Describe this principle..."></textarea>
          </div>
          <div class="form-actions">
            <button type="button" id="cancel-principle-btn" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary">Create</button>
          </div>
        </form>
      </div>
    </div>

    <div id="delete-principle-modal" class="modal">
      <div class="modal-content">
        <div class="modal-handle"></div>
        <h3>Delete Principle</h3>
        <div class="confirm-dialog">
          <p>Are you sure you want to delete this principle?</p>
          <div class="form-actions">
            <button type="button" id="cancel-delete-principle" class="btn btn-secondary">Cancel</button>
            <button type="button" id="confirm-delete-principle" class="btn btn-danger">Delete</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const newModal = container.querySelector('#new-principle-modal');
  const deleteModal = container.querySelector('#delete-principle-modal');
  let deleteTargetId = null;

  container.querySelector('#new-principle-btn').addEventListener('click', () => newModal.classList.add('show'));
  container.querySelector('#cancel-principle-btn').addEventListener('click', () => newModal.classList.remove('show'));
  newModal.addEventListener('click', (e) => { if (e.target === newModal) newModal.classList.remove('show'); });
  deleteModal.addEventListener('click', (e) => { if (e.target === deleteModal) deleteModal.classList.remove('show'); });
  container.querySelector('#cancel-delete-principle').addEventListener('click', () => deleteModal.classList.remove('show'));

  container.querySelector('#confirm-delete-principle').addEventListener('click', async () => {
    if (!deleteTargetId) return;
    try {
      await db.principles.delete(deleteTargetId);
      showToast('Principle deleted', 'success');
      deleteModal.classList.remove('show');
      loadPrinciples(container, user, deleteModal, (id) => { deleteTargetId = id; });
    } catch (error) {
      showToast('Failed to delete: ' + error.message, 'error');
    }
  });

  container.querySelector('#new-principle-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = container.querySelector('#principle-title').value;
    const category = container.querySelector('#principle-category').value;
    const description = container.querySelector('#principle-description').value;

    try {
      await db.principles.create(user.id, title, description, category);
      newModal.classList.remove('show');
      container.querySelector('#new-principle-form').reset();
      showToast('Principle defined', 'success');
      loadPrinciples(container, user, deleteModal, (id) => { deleteTargetId = id; });
    } catch (error) {
      showToast('Failed to create principle: ' + error.message, 'error');
    }
  });

  loadPrinciples(container, user, deleteModal, (id) => { deleteTargetId = id; });
}

async function loadPrinciples(container, user, deleteModal, setDeleteTarget) {
  const listContainer = container.querySelector('#principles-list');

  try {
    const principles = await db.principles.list(user.id);

    if (principles.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">&#9670;</div>
          <p>No principles defined yet</p>
          <p>Define keystone principles that guide your collaboration methodology.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = principles.map(principle => `
      <div class="list-item">
        <div class="item-header">
          <h3>${escapeHtml(principle.title)}</h3>
          <div class="item-actions">
            <button class="btn btn-icon btn-ghost delete-principle-btn" data-id="${principle.id}" title="Delete">&#10005;</button>
            <span class="badge badge-${principle.category}">${principle.category}</span>
          </div>
        </div>
        ${principle.description ? `<p class="item-description">${escapeHtml(principle.description)}</p>` : ''}
      </div>
    `).join('');

    listContainer.querySelectorAll('.delete-principle-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setDeleteTarget(btn.dataset.id);
        deleteModal.classList.add('show');
      });
    });
  } catch (error) {
    listContainer.innerHTML = `<div class="error">Error loading principles: ${error.message}</div>`;
  }
}
