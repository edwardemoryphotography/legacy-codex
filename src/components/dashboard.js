import { auth, supabase } from '../lib/supabase.js';
import { toggleTheme } from '../lib/utils.js';
import { renderOverview } from './views/overview.js';
import { renderSessions } from './views/sessions.js';
import { renderArtifacts } from './views/artifacts.js';
import { renderPrinciples } from './views/principles.js';
import { renderNarratives } from './views/narratives.js';
import { renderReflections } from './views/reflections.js';

export async function renderDashboard(container, user) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  container.innerHTML = `
    <div class="dashboard">
      <header class="dashboard-header">
        <div class="header-content">
          <div class="header-left">
            <h1>Legacy Codex</h1>
          </div>
          <div class="header-actions">
            <span class="user-name" id="user-display-name"></span>
            <button id="theme-toggle" class="btn btn-icon theme-toggle" title="Toggle theme">${isDark ? '&#9788;' : '&#9790;'}</button>
            <button id="signout-btn" class="btn btn-sm btn-secondary">Sign Out</button>
          </div>
        </div>
        <nav class="dashboard-nav">
          <button class="nav-btn active" data-view="overview">Overview</button>
          <button class="nav-btn" data-view="sessions">Sessions</button>
          <button class="nav-btn" data-view="artifacts">Artifacts</button>
          <button class="nav-btn" data-view="principles">Principles</button>
          <button class="nav-btn" data-view="narratives">Narratives</button>
          <button class="nav-btn" data-view="reflections">Reflections</button>
        </nav>
      </header>

      <main class="dashboard-main">
        <div id="view-container" class="view-container"></div>
      </main>
    </div>
  `;

  loadUserProfile(user).then(profile => {
    const el = container.querySelector('#user-display-name');
    if (el) el.textContent = profile?.display_name || user.email;
  });

  container.querySelector('#signout-btn').addEventListener('click', () => auth.signOut());

  container.querySelector('#theme-toggle').addEventListener('click', () => {
    toggleTheme();
    const btn = container.querySelector('#theme-toggle');
    const nowDark = document.documentElement.getAttribute('data-theme') === 'dark';
    btn.innerHTML = nowDark ? '&#9788;' : '&#9790;';
  });

  const navBtns = container.querySelectorAll('.nav-btn');
  const viewContainer = container.querySelector('#view-container');

  function navigateTo(view) {
    navBtns.forEach(b => {
      b.classList.toggle('active', b.dataset.view === view);
    });
    renderView(viewContainer, view, user, navigateTo);
  }

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.view));
  });

  renderView(viewContainer, 'overview', user, navigateTo);
}

async function loadUserProfile(user) {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle();
    return data;
  } catch {
    return null;
  }
}

async function renderView(container, view, user, navigateTo) {
  switch (view) {
    case 'overview':
      await renderOverview(container, user, navigateTo);
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
    case 'reflections':
      await renderReflections(container, user);
      break;
  }
}
