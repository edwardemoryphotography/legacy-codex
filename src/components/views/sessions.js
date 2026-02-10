import { db } from '../../lib/supabase.js';
import { escapeHtml, formatDate, showToast } from '../../lib/utils.js';

const PHASE_NAMES = [
  { key: 'initial_assumption', label: 'Initial Assumption', desc: 'Present a query; AI proposes a direction' },
  { key: 'challenge', label: 'Challenge / Redirect', desc: 'Identify the gap and redirect' },
  { key: 'reflection', label: 'AI Reflection', desc: 'AI acknowledges misalignment' },
  { key: 'reframing', label: 'Reframing', desc: 'Restructure the entire approach' },
  { key: 'clarification', label: 'Clarification', desc: 'Articulate the actual goal precisely' },
  { key: 'verification', label: 'Verification', desc: 'Confirm alignment before proceeding' },
  { key: 'meta_recognition', label: 'Meta-Recognition', desc: 'Extract the process as a framework' },
];

export async function renderSessions(container, user) {
  container.innerHTML = `
    <div class="view-section">
      <div class="section-header">
        <h2>Collaboration Sessions</h2>
        <button id="new-session-btn" class="btn btn-primary" style="width:auto">New Session</button>
      </div>
      <div id="sessions-list" class="list-container">
        <div class="loading"><div class="spinner"></div>Loading sessions...</div>
      </div>
    </div>

    <div id="new-session-modal" class="modal">
      <div class="modal-content">
        <div class="modal-handle"></div>
        <h3>Create New Session</h3>
        <form id="new-session-form">
          <div class="form-group">
            <label for="session-title">Title</label>
            <input type="text" id="session-title" required placeholder="What are you exploring?" />
          </div>
          <div class="form-group">
            <label for="session-description">Description</label>
            <textarea id="session-description" rows="3" placeholder="Optional context..."></textarea>
          </div>
          <div class="form-actions">
            <button type="button" id="cancel-session-btn" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary">Create</button>
          </div>
        </form>
      </div>
    </div>

    <div id="session-detail-modal" class="modal">
      <div class="modal-content" id="session-detail-content"></div>
    </div>

    <div id="delete-session-modal" class="modal">
      <div class="modal-content">
        <div class="modal-handle"></div>
        <h3>Delete Session</h3>
        <div class="confirm-dialog">
          <p>Are you sure you want to delete this session? This action cannot be undone.</p>
          <div class="form-actions">
            <button type="button" id="cancel-delete-btn" class="btn btn-secondary">Cancel</button>
            <button type="button" id="confirm-delete-btn" class="btn btn-danger">Delete</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const newModal = container.querySelector('#new-session-modal');
  const detailModal = container.querySelector('#session-detail-modal');
  const deleteModal = container.querySelector('#delete-session-modal');
  let deleteTargetId = null;

  container.querySelector('#new-session-btn').addEventListener('click', () => {
    newModal.classList.add('show');
  });

  container.querySelector('#cancel-session-btn').addEventListener('click', () => {
    newModal.classList.remove('show');
  });

  newModal.addEventListener('click', (e) => {
    if (e.target === newModal) newModal.classList.remove('show');
  });

  detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) detailModal.classList.remove('show');
  });

  deleteModal.addEventListener('click', (e) => {
    if (e.target === deleteModal) deleteModal.classList.remove('show');
  });

  container.querySelector('#cancel-delete-btn').addEventListener('click', () => {
    deleteModal.classList.remove('show');
  });

  container.querySelector('#confirm-delete-btn').addEventListener('click', async () => {
    if (!deleteTargetId) return;
    try {
      await db.sessions.delete(deleteTargetId);
      showToast('Session deleted', 'success');
      deleteModal.classList.remove('show');
      loadSessions(container, user, detailModal, deleteModal, (id) => { deleteTargetId = id; });
    } catch (error) {
      showToast('Failed to delete: ' + error.message, 'error');
    }
  });

  container.querySelector('#new-session-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = container.querySelector('#session-title').value;
    const description = container.querySelector('#session-description').value;

    try {
      const session = await db.sessions.create(user.id, title, description);
      if (session) {
        for (let i = 0; i < PHASE_NAMES.length; i++) {
          await db.phases.create(session.id, i + 1, PHASE_NAMES[i].key);
        }
      }
      newModal.classList.remove('show');
      container.querySelector('#new-session-form').reset();
      showToast('Session created', 'success');
      loadSessions(container, user, detailModal, deleteModal, (id) => { deleteTargetId = id; });
    } catch (error) {
      showToast('Failed to create session: ' + error.message, 'error');
    }
  });

  loadSessions(container, user, detailModal, deleteModal, (id) => { deleteTargetId = id; });
}

async function loadSessions(container, user, detailModal, deleteModal, setDeleteTarget) {
  const listContainer = container.querySelector('#sessions-list');

  try {
    const sessions = await db.sessions.list(user.id);

    if (sessions.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">&#9672;</div>
          <p>No collaboration sessions yet</p>
          <p>Start your first session to begin tracking your AI collaboration journey.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = sessions.map(session => `
      <div class="list-item" data-session-id="${session.id}">
        <div class="item-header">
          <h3>${escapeHtml(session.title)}</h3>
          <div class="item-actions">
            <button class="btn btn-icon btn-ghost delete-session-btn" data-id="${session.id}" title="Delete">&#10005;</button>
          </div>
        </div>
        ${session.description ? `<p class="item-description">${escapeHtml(session.description)}</p>` : ''}
        <div class="item-meta">
          <span class="badge badge-${session.status}">${session.status}</span>
          <span>Phase ${session.current_phase}/7</span>
          <span>${formatDate(session.created_at)}</span>
        </div>
      </div>
    `).join('');

    listContainer.querySelectorAll('.list-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.delete-session-btn')) return;
        const sessionId = item.dataset.sessionId;
        const session = sessions.find(s => s.id === sessionId);
        if (session) openSessionDetail(detailModal, session, user);
      });
    });

    listContainer.querySelectorAll('.delete-session-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        setDeleteTarget(btn.dataset.id);
        deleteModal.classList.add('show');
      });
    });
  } catch (error) {
    listContainer.innerHTML = `<div class="error">Error loading sessions: ${error.message}</div>`;
  }
}

async function openSessionDetail(modal, session, user) {
  const content = modal.querySelector('#session-detail-content');

  content.innerHTML = `
    <div class="modal-handle"></div>
    <button class="btn btn-ghost back-btn" id="close-detail-btn">&#8592; Back to Sessions</button>
    <h3>${escapeHtml(session.title)}</h3>
    ${session.description ? `<p class="item-description">${escapeHtml(session.description)}</p>` : ''}
    <div class="phase-tracker" id="phase-tracker">
      <div class="loading"><div class="spinner"></div>Loading phases...</div>
    </div>
  `;

  modal.classList.add('show');

  content.querySelector('#close-detail-btn').addEventListener('click', () => {
    modal.classList.remove('show');
  });

  try {
    const phases = await db.phases.list(session.id);
    const tracker = content.querySelector('#phase-tracker');

    if (phases.length === 0) {
      tracker.innerHTML = PHASE_NAMES.map((phase, i) => `
        <div class="phase-step ${i + 1 === session.current_phase ? 'current' : i + 1 < session.current_phase ? 'completed' : ''}">
          <div class="phase-number">${i + 1}</div>
          <div class="phase-info">
            <h4>${phase.label}</h4>
            <p>${phase.desc}</p>
          </div>
        </div>
      `).join('');
      return;
    }

    tracker.innerHTML = phases.map(phase => {
      const info = PHASE_NAMES[phase.phase_number - 1] || { label: phase.phase_name, desc: '' };
      const isCurrent = phase.phase_number === session.current_phase && !phase.completed;
      const isCompleted = phase.completed;

      return `
        <div class="phase-step ${isCurrent ? 'current' : ''} ${isCompleted ? 'completed' : ''}" data-phase-id="${phase.id}" data-phase-num="${phase.phase_number}">
          <div class="phase-number">${isCompleted ? '&#10003;' : phase.phase_number}</div>
          <div class="phase-info">
            <h4>${info.label}</h4>
            <p>${phase.content || info.desc}</p>
          </div>
        </div>
      `;
    }).join('');

    tracker.querySelectorAll('.phase-step').forEach(step => {
      step.addEventListener('click', async () => {
        const phaseId = step.dataset.phaseId;
        const phaseNum = parseInt(step.dataset.phaseNum);
        if (!phaseId) return;

        const phase = phases.find(p => p.id === phaseId);
        if (!phase) return;

        if (!phase.completed) {
          try {
            await db.phases.update(phaseId, { completed: true, completed_at: new Date().toISOString() });
            const nextPhase = Math.min(phaseNum + 1, 7);
            const newStatus = phaseNum === 7 ? 'completed' : session.status;
            await db.sessions.update(session.id, { current_phase: nextPhase, status: newStatus });
            session.current_phase = nextPhase;
            session.status = newStatus;
            phase.completed = true;

            step.classList.remove('current');
            step.classList.add('completed');
            step.querySelector('.phase-number').innerHTML = '&#10003;';

            const nextStep = tracker.querySelector(`[data-phase-num="${nextPhase}"]`);
            if (nextStep && phaseNum < 7) nextStep.classList.add('current');

            if (phaseNum === 7) showToast('Session completed!', 'success');
            else showToast(`Phase ${phaseNum} completed`, 'success');
          } catch (error) {
            showToast('Error updating phase: ' + error.message, 'error');
          }
        }
      });
    });
  } catch (error) {
    content.querySelector('#phase-tracker').innerHTML = `<div class="error">${error.message}</div>`;
  }
}
