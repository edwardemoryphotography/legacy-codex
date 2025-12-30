import { auth, db, supabase } from '../lib/supabase.js';

export async function renderDashboard(container, user) {
  container.innerHTML = `
    <div class="dashboard">
      <header class="dashboard-header">
        <div class="header-content">
          <h1>Legacy Codex</h1>
          <div class="header-actions">
            <span class="user-name">Welcome, <strong id="user-display-name">...</strong></span>
            <button id="signout-btn" class="btn btn-secondary">Sign Out</button>
          </div>
        </div>
        <nav class="dashboard-nav">
          <button class="nav-btn active" data-view="overview">Overview</button>
          <button class="nav-btn" data-view="sessions">Sessions</button>
          <button class="nav-btn" data-view="artifacts">Artifacts</button>
          <button class="nav-btn" data-view="principles">Principles</button>
          <button class="nav-btn" data-view="narratives">Narratives</button>
        </nav>
      </header>

      <main class="dashboard-main">
        <div id="view-container" class="view-container"></div>
      </main>
    </div>
  `;

  const userDisplayName = container.querySelector('#user-display-name');
  const profile = await loadUserProfile(user.id);
  userDisplayName.textContent = profile?.display_name || user.email;

  const signoutBtn = container.querySelector('#signout-btn');
  signoutBtn.addEventListener('click', async () => {
    await auth.signOut();
  });

  const navBtns = container.querySelectorAll('.nav-btn');
  const viewContainer = container.querySelector('#view-container');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const view = btn.dataset.view;
      renderView(viewContainer, view, user);
    });
  });

  renderView(viewContainer, 'overview', user);
}

async function loadUserProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error loading profile:', error);
    return null;
  }
}

async function renderView(container, view, user) {
  switch (view) {
    case 'overview':
      await renderOverview(container, user);
      break;
    case 'sessions':
      await renderSessions(container, user);
      break;
    case 'artifacts':
      await renderArtifacts(container, user);
      break;
    case 'principles':
      await renderPrinciples(container, user);
      break;
    case 'narratives':
      await renderNarratives(container, user);
      break;
  }
}

async function renderOverview(container, user) {
  container.innerHTML = `
    <div class="view-section">
      <h2>Welcome to Legacy Codex</h2>
      <p class="subtitle">Track your neurodivergent collaboration journey with AI</p>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value" id="sessions-count">-</div>
          <div class="stat-label">Collaboration Sessions</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="artifacts-count">-</div>
          <div class="stat-label">Artifacts Created</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="principles-count">-</div>
          <div class="stat-label">Principles Defined</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="narratives-count">-</div>
          <div class="stat-label">Narratives Captured</div>
        </div>
      </div>

      <div class="info-section">
        <h3>The 7-Phase Collaboration Protocol</h3>
        <ol class="phase-list">
          <li><strong>Initial Assumption</strong> – Present a query; AI proposes a direction</li>
          <li><strong>Challenge/Redirect</strong> – Identify the gap and redirect</li>
          <li><strong>AI Reflection</strong> – AI acknowledges misalignment</li>
          <li><strong>Reframing</strong> – Restructure the entire approach</li>
          <li><strong>Clarification</strong> – Articulate the actual goal precisely</li>
          <li><strong>Verification</strong> – Confirm alignment before proceeding</li>
          <li><strong>Meta-Recognition</strong> – Extract the process as a framework</li>
        </ol>
        <button id="start-session-btn" class="btn btn-primary">Start New Session</button>
      </div>
    </div>
  `;

  try {
    const [sessions, artifacts, principles, narratives] = await Promise.all([
      db.sessions.list(user.id),
      db.artifacts.list(user.id),
      db.principles.list(user.id),
      db.narratives.list(user.id),
    ]);

    container.querySelector('#sessions-count').textContent = sessions.length;
    container.querySelector('#artifacts-count').textContent = artifacts.length;
    container.querySelector('#principles-count').textContent = principles.length;
    container.querySelector('#narratives-count').textContent = narratives.length;
  } catch (error) {
    console.error('Error loading stats:', error);
  }

  const startBtn = container.querySelector('#start-session-btn');
  startBtn.addEventListener('click', () => {
    renderView(container, 'sessions', user);
    document.querySelector('[data-view="sessions"]').click();
  });
}

async function renderSessions(container, user) {
  container.innerHTML = `
    <div class="view-section">
      <div class="section-header">
        <h2>Collaboration Sessions</h2>
        <button id="new-session-btn" class="btn btn-primary">New Session</button>
      </div>
      <div id="sessions-list" class="list-container">
        <div class="loading">Loading sessions...</div>
      </div>
    </div>

    <div id="new-session-modal" class="modal">
      <div class="modal-content">
        <h3>Create New Session</h3>
        <form id="new-session-form">
          <div class="form-group">
            <label for="session-title">Title</label>
            <input type="text" id="session-title" required />
          </div>
          <div class="form-group">
            <label for="session-description">Description</label>
            <textarea id="session-description" rows="3"></textarea>
          </div>
          <div class="form-actions">
            <button type="button" id="cancel-session-btn" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary">Create</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const modal = container.querySelector('#new-session-modal');
  const newSessionBtn = container.querySelector('#new-session-btn');
  const cancelBtn = container.querySelector('#cancel-session-btn');
  const form = container.querySelector('#new-session-form');

  newSessionBtn.addEventListener('click', () => {
    modal.classList.add('show');
  });

  cancelBtn.addEventListener('click', () => {
    modal.classList.remove('show');
    form.reset();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = container.querySelector('#session-title').value;
    const description = container.querySelector('#session-description').value;

    try {
      await db.sessions.create(user.id, title, description);
      modal.classList.remove('show');
      form.reset();
      loadSessions(container, user);
    } catch (error) {
      alert('Failed to create session: ' + error.message);
    }
  });

  loadSessions(container, user);
}

async function loadSessions(container, user) {
  const listContainer = container.querySelector('#sessions-list');

  try {
    const sessions = await db.sessions.list(user.id);

    if (sessions.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <p>No collaboration sessions yet.</p>
          <p>Start your first session to begin tracking your AI collaboration journey.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = sessions
      .map(
        (session) => `
        <div class="list-item session-item">
          <div class="item-header">
            <h3>${escapeHtml(session.title)}</h3>
            <span class="badge badge-${session.status}">${session.status}</span>
          </div>
          ${session.description ? `<p class="item-description">${escapeHtml(session.description)}</p>` : ''}
          <div class="item-meta">
            <span>Phase ${session.current_phase}/7</span>
            <span>Created ${formatDate(session.created_at)}</span>
          </div>
        </div>
      `
      )
      .join('');
  } catch (error) {
    listContainer.innerHTML = `<div class="error">Error loading sessions: ${error.message}</div>`;
  }
}

async function renderArtifacts(container, user) {
  container.innerHTML = `
    <div class="view-section">
      <div class="section-header">
        <h2>Artifacts</h2>
        <button id="new-artifact-btn" class="btn btn-primary">New Artifact</button>
      </div>
      <div id="artifacts-list" class="list-container">
        <div class="loading">Loading artifacts...</div>
      </div>
    </div>

    <div id="new-artifact-modal" class="modal">
      <div class="modal-content">
        <h3>Create New Artifact</h3>
        <form id="new-artifact-form">
          <div class="form-group">
            <label for="artifact-title">Title</label>
            <input type="text" id="artifact-title" required />
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
            <textarea id="artifact-content" rows="6"></textarea>
          </div>
          <div class="form-actions">
            <button type="button" id="cancel-artifact-btn" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary">Create</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const modal = container.querySelector('#new-artifact-modal');
  const newBtn = container.querySelector('#new-artifact-btn');
  const cancelBtn = container.querySelector('#cancel-artifact-btn');
  const form = container.querySelector('#new-artifact-form');

  newBtn.addEventListener('click', () => modal.classList.add('show'));
  cancelBtn.addEventListener('click', () => {
    modal.classList.remove('show');
    form.reset();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = container.querySelector('#artifact-title').value;
    const type = container.querySelector('#artifact-type').value;
    const content = container.querySelector('#artifact-content').value;

    try {
      await db.artifacts.create(user.id, title, type, content);
      modal.classList.remove('show');
      form.reset();
      loadArtifacts(container, user);
    } catch (error) {
      alert('Failed to create artifact: ' + error.message);
    }
  });

  loadArtifacts(container, user);
}

async function loadArtifacts(container, user) {
  const listContainer = container.querySelector('#artifacts-list');

  try {
    const artifacts = await db.artifacts.list(user.id);

    if (artifacts.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <p>No artifacts yet.</p>
          <p>Create artifacts to capture your work products from collaboration sessions.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = artifacts
      .map(
        (artifact) => `
        <div class="list-item">
          <div class="item-header">
            <h3>${escapeHtml(artifact.title)}</h3>
            <span class="badge badge-${artifact.type}">${artifact.type}</span>
          </div>
          ${artifact.content ? `<p class="item-preview">${escapeHtml(artifact.content.substring(0, 150))}${artifact.content.length > 150 ? '...' : ''}</p>` : ''}
          <div class="item-meta">
            <span>Created ${formatDate(artifact.created_at)}</span>
          </div>
        </div>
      `
      )
      .join('');
  } catch (error) {
    listContainer.innerHTML = `<div class="error">Error loading artifacts: ${error.message}</div>`;
  }
}

async function renderPrinciples(container, user) {
  container.innerHTML = `
    <div class="view-section">
      <div class="section-header">
        <h2>Keystone Principles</h2>
        <button id="new-principle-btn" class="btn btn-primary">New Principle</button>
      </div>
      <div id="principles-list" class="list-container">
        <div class="loading">Loading principles...</div>
      </div>
    </div>

    <div id="new-principle-modal" class="modal">
      <div class="modal-content">
        <h3>Define New Principle</h3>
        <form id="new-principle-form">
          <div class="form-group">
            <label for="principle-title">Title</label>
            <input type="text" id="principle-title" required />
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
            <textarea id="principle-description" rows="4"></textarea>
          </div>
          <div class="form-actions">
            <button type="button" id="cancel-principle-btn" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary">Create</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const modal = container.querySelector('#new-principle-modal');
  const newBtn = container.querySelector('#new-principle-btn');
  const cancelBtn = container.querySelector('#cancel-principle-btn');
  const form = container.querySelector('#new-principle-form');

  newBtn.addEventListener('click', () => modal.classList.add('show'));
  cancelBtn.addEventListener('click', () => {
    modal.classList.remove('show');
    form.reset();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = container.querySelector('#principle-title').value;
    const category = container.querySelector('#principle-category').value;
    const description = container.querySelector('#principle-description').value;

    try {
      await db.principles.create(user.id, title, description, category);
      modal.classList.remove('show');
      form.reset();
      loadPrinciples(container, user);
    } catch (error) {
      alert('Failed to create principle: ' + error.message);
    }
  });

  loadPrinciples(container, user);
}

async function loadPrinciples(container, user) {
  const listContainer = container.querySelector('#principles-list');

  try {
    const principles = await db.principles.list(user.id);

    if (principles.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <p>No principles defined yet.</p>
          <p>Define keystone principles that guide your collaboration methodology.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = principles
      .map(
        (principle) => `
        <div class="list-item">
          <div class="item-header">
            <h3>${escapeHtml(principle.title)}</h3>
            <span class="badge badge-${principle.category}">${principle.category}</span>
          </div>
          ${principle.description ? `<p class="item-description">${escapeHtml(principle.description)}</p>` : ''}
        </div>
      `
      )
      .join('');
  } catch (error) {
    listContainer.innerHTML = `<div class="error">Error loading principles: ${error.message}</div>`;
  }
}

async function renderNarratives(container, user) {
  container.innerHTML = `
    <div class="view-section">
      <div class="section-header">
        <h2>Narratives</h2>
        <button id="new-narrative-btn" class="btn btn-primary">New Narrative</button>
      </div>
      <div id="narratives-list" class="list-container">
        <div class="loading">Loading narratives...</div>
      </div>
    </div>

    <div id="new-narrative-modal" class="modal">
      <div class="modal-content">
        <h3>Create New Narrative</h3>
        <form id="new-narrative-form">
          <div class="form-group">
            <label for="narrative-title">Title</label>
            <input type="text" id="narrative-title" required />
          </div>
          <div class="form-group">
            <label for="narrative-content">Content</label>
            <textarea id="narrative-content" rows="6"></textarea>
          </div>
          <div class="form-group">
            <label>
              <input type="checkbox" id="narrative-public" />
              Make this narrative public (visible to other users)
            </label>
          </div>
          <div class="form-actions">
            <button type="button" id="cancel-narrative-btn" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary">Create</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const modal = container.querySelector('#new-narrative-modal');
  const newBtn = container.querySelector('#new-narrative-btn');
  const cancelBtn = container.querySelector('#cancel-narrative-btn');
  const form = container.querySelector('#new-narrative-form');

  newBtn.addEventListener('click', () => modal.classList.add('show'));
  cancelBtn.addEventListener('click', () => {
    modal.classList.remove('show');
    form.reset();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = container.querySelector('#narrative-title').value;
    const content = container.querySelector('#narrative-content').value;
    const isPublic = container.querySelector('#narrative-public').checked;

    try {
      await db.narratives.create(user.id, title, content, [], isPublic);
      modal.classList.remove('show');
      form.reset();
      loadNarratives(container, user);
    } catch (error) {
      alert('Failed to create narrative: ' + error.message);
    }
  });

  loadNarratives(container, user);
}

async function loadNarratives(container, user) {
  const listContainer = container.querySelector('#narratives-list');

  try {
    const narratives = await db.narratives.list(user.id, true);

    if (narratives.length === 0) {
      listContainer.innerHTML = `
        <div class="empty-state">
          <p>No narratives yet.</p>
          <p>Capture stories and case studies from your successful collaborations.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = narratives
      .map(
        (narrative) => `
        <div class="list-item">
          <div class="item-header">
            <h3>${escapeHtml(narrative.title)}</h3>
            ${narrative.is_public ? '<span class="badge badge-public">Public</span>' : '<span class="badge badge-private">Private</span>'}
          </div>
          ${narrative.content ? `<p class="item-preview">${escapeHtml(narrative.content.substring(0, 200))}${narrative.content.length > 200 ? '...' : ''}</p>` : ''}
          <div class="item-meta">
            <span>Created ${formatDate(narrative.created_at)}</span>
          </div>
        </div>
      `
      )
      .join('');
  } catch (error) {
    listContainer.innerHTML = `<div class="error">Error loading narratives: ${error.message}</div>`;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}
