import { db } from '../../lib/supabase.js';
import { escapeHtml, formatDate, showToast } from '../../lib/utils.js';

export async function renderReflections(container, user) {
  container.innerHTML = `
    <div class="view-section">
      <div class="section-header">
        <h2>Reflections</h2>
        <button id="new-reflection-btn" class="btn btn-primary" style="width:auto">New Reflection</button>
      </div>
      <div id="reflections-list" class="list-container">
        <div class="loading"><div class="spinner"></div>Loading reflections...</div>
      </div>
    </div>

    <div id="new-reflection-modal" class="modal">
      <div class="modal-content">
        <div class="modal-handle"></div>
        <h3>Capture a Reflection</h3>
        <form id="new-reflection-form">
          <div class="form-group">
            <label for="reflection-insight">Insight</label>
            <textarea id="reflection-insight" rows="4" required placeholder="What did you learn or realize?"></textarea>
          </div>
          <div class="form-group">
            <label for="reflection-context">Context</label>
            <textarea id="reflection-context" rows="3" placeholder="What led to this insight?"></textarea>
          </div>
          <div class="form-group">
            <label for="reflection-session">Link to Session (optional)</label>
            <select id="reflection-session">
              <option value="">No session</option>
            </select>
          </div>
          <div class="form-actions">
            <button type="button" id="cancel-reflection-btn" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>

    <div id="delete-reflection-modal" class="modal">
      <div class="modal-content">
        <div class="modal-handle"></div>
        <h3>Delete Reflection</h3>
        <div class="confirm-dialog">
          <p>Are you sure you want to delete this reflection?</p>
          <div class="form-actions">
            <button type="button" id="cancel-delete-reflection" class="btn btn-secondary">Cancel</button>
            <button type="button" id="confirm-delete-reflection" class="btn btn-danger">Delete</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const newModal = container.querySelector('#new-reflection-modal');
  const deleteModal = container.querySelector('#delete-reflection-modal');
  let deleteTargetId = null;

  try {
    const sessions = await db.sessions.list(user.id);
    const sessionSelect = container.querySelector('#reflection-session');
    sessions.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.title;
      sessionSelect.appendChild(opt);
    });
  } catch {
    // sessions dropdown is optional
  }

  container.querySelector('#new-reflection-btn').addEventListener('click', () => newModal.classList.add('show'));
  container.querySelector('#cancel-reflection-btn').addEventListener('click', () => newModal.classList.remove('show'));
  newModal.addEventListener('click', (e) => { if (e.target === newModal) newModal.classList.remove('show'); });
  deleteModal.addEventListener('click', (e) => { if (e.target === deleteModal) deleteModal.classList.remove('show'); });
  container.querySelector('#cancel-delete-reflection').addEventListener('click', () => deleteModal.classList.remove('show'));

  container.querySelector('#confirm-delete-reflection').addEventListener('click', async () => {
    if (!deleteTargetId) return;
    try {
      await db.reflections.delete(deleteTargetId);
      showToast('Reflection deleted', 'success');
      deleteModal.classList.remove('show');
      loadReflections(container, user, deleteModal, (id) => { deleteTargetId = id; });
    } catch (error) {
      showToast('Failed to delete: ' + error.message, 'error');
    }
  });

  container.querySelector('#new-reflection-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const insight = container.querySelector('#reflection-insight').value;
    const context = container.querySelector('#reflection-context').value;
    const sessionId = container.querySelector('#reflection-session').value || null;

    try {
      await db.reflections.create(user.id, sessionId, insight, context);
      newModal.classList.remove('show');
      container.querySelector('#new-reflection-form').reset();
      showToast('Reflection saved', 'success');
      loadReflections(container, user, deleteModal, (id) => { deleteTargetId = id; });
    } catch (error) {
      showToast('Failed to save reflection: ' + error.message, 'error');
    }
  });

  loadReflections(container, user, deleteModal, (id) => { deleteTargetId = id; });
}

async function loadReflections(container, user, deleteModal, setDeleteTarget) {
  const listContainer = container.querySelector('#reflections-list');

  try {
    const reflections = await db.reflections.list(user.id);

    if (reflections.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">&#9673;</div>
          <p>No reflections yet</p>
          <p>Capture insights and meta-recognitions from your collaboration sessions.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = reflections.map(reflection => `
      <div class="list-item">
        <div class="item-header">
          <h3>${escapeHtml(reflection.insight.substring(0, 80))}${reflection.insight.length > 80 ? '...' : ''}</h3>
          <div class="item-actions">
            <button class="btn btn-icon btn-ghost delete-reflection-btn" data-id="${reflection.id}" title="Delete">&#10005;</button>
          </div>
        </div>
        ${reflection.context ? `<p class="item-description">${escapeHtml(reflection.context)}</p>` : ''}
        <div class="item-meta">
          <span>${formatDate(reflection.created_at)}</span>
        </div>
      </div>
    `).join('');

    listContainer.querySelectorAll('.delete-reflection-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setDeleteTarget(btn.dataset.id);
        deleteModal.classList.add('show');
      });
    });
  } catch (error) {
    listContainer.innerHTML = `<div class="error">Error loading reflections: ${error.message}</div>`;
  }
}
