import { auth, supabase } from './lib/supabase.js';
import { renderAuth } from './components/auth.js';
import { renderDashboard } from './components/dashboard.js';
import './styles/main.css';

let currentUser = null;

async function init() {
  const appContainer = document.getElementById('app');

  currentUser = await auth.getCurrentUser();

  if (currentUser) {
    renderDashboard(appContainer, currentUser);
  } else {
    renderAuth(appContainer, handleAuthSuccess);
  }

  auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      currentUser = session.user;
      renderDashboard(appContainer, currentUser);
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      renderAuth(appContainer, handleAuthSuccess);
    }
  });
}

function handleAuthSuccess(user) {
  currentUser = user;
  const appContainer = document.getElementById('app');
  renderDashboard(appContainer, currentUser);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
