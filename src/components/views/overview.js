import { db } from '../../lib/supabase.js';

export async function renderOverview(container, user, navigateTo) {
  container.innerHTML = `
    <div class="view-section">
      <h2>Welcome to Legacy Codex</h2>
      <p class="subtitle">Track your neurodivergent collaboration journey with AI</p>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value" id="sessions-count"><div class="spinner"></div></div>
          <div class="stat-label">Sessions</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="artifacts-count"><div class="spinner"></div></div>
          <div class="stat-label">Artifacts</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="principles-count"><div class="spinner"></div></div>
          <div class="stat-label">Principles</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" id="narratives-count"><div class="spinner"></div></div>
          <div class="stat-label">Narratives</div>
        </div>
      </div>

      <div class="info-section">
        <h3>The 7-Phase Collaboration Protocol</h3>
        <ol class="phase-list">
          <li><strong>Initial Assumption</strong> -- Present a query; AI proposes a direction</li>
          <li><strong>Challenge / Redirect</strong> -- Identify the gap and redirect</li>
          <li><strong>AI Reflection</strong> -- AI acknowledges misalignment</li>
          <li><strong>Reframing</strong> -- Restructure the entire approach</li>
          <li><strong>Clarification</strong> -- Articulate the actual goal precisely</li>
          <li><strong>Verification</strong> -- Confirm alignment before proceeding</li>
          <li><strong>Meta-Recognition</strong> -- Extract the process as a framework</li>
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
  } catch {
    container.querySelector('#sessions-count').textContent = '0';
    container.querySelector('#artifacts-count').textContent = '0';
    container.querySelector('#principles-count').textContent = '0';
    container.querySelector('#narratives-count').textContent = '0';
  }

  container.querySelector('#start-session-btn').addEventListener('click', () => {
    navigateTo('sessions');
  });
}
