import { auth } from './lib/supabase.js';
import { initTheme, initPwaInstall, initPwaUpdates } from './lib/utils.js';
import { renderAuth } from './components/auth.js';
import { renderDashboard } from './components/dashboard.js';
import './styles/main.css';

let currentUser = null;
let isRendering = false;

async function init() {
  initTheme();
  initPwaInstall();
  initPwaUpdates();

  const appContainer = document.getElementById('app');

  currentUser = await auth.getCurrentUser();

  if (currentUser) {
    renderDashboard(appContainer, currentUser);
  } else {
    renderAuth(appContainer);
  }

  auth.onAuthStateChange((event, session) => {
    if (isRendering) return;
    isRendering = true;

    if (event === 'SIGNED_IN' && session) {
      currentUser = session.user;
      renderDashboard(appContainer, currentUser);
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      renderAuth(appContainer);
    }

    setTimeout(() => { isRendering = false; }, 100);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
