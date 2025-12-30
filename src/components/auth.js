import { auth } from '../lib/supabase.js';

export function renderAuth(container, onSuccess) {
  container.innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <h1>Legacy Codex</h1>
          <p>A framework for neurodivergent collaboration with AI</p>
        </div>

        <div class="auth-tabs">
          <button class="auth-tab active" data-tab="signin">Sign In</button>
          <button class="auth-tab" data-tab="signup">Sign Up</button>
        </div>

        <div class="auth-content">
          <form id="signin-form" class="auth-form active">
            <div class="form-group">
              <label for="signin-email">Email</label>
              <input type="email" id="signin-email" required autocomplete="email" />
            </div>
            <div class="form-group">
              <label for="signin-password">Password</label>
              <input type="password" id="signin-password" required autocomplete="current-password" />
            </div>
            <button type="submit" class="btn btn-primary">Sign In</button>
            <div id="signin-error" class="error-message"></div>
          </form>

          <form id="signup-form" class="auth-form">
            <div class="form-group">
              <label for="signup-name">Display Name</label>
              <input type="text" id="signup-name" required autocomplete="name" />
            </div>
            <div class="form-group">
              <label for="signup-email">Email</label>
              <input type="email" id="signup-email" required autocomplete="email" />
            </div>
            <div class="form-group">
              <label for="signup-password">Password</label>
              <input type="password" id="signup-password" required minlength="6" autocomplete="new-password" />
            </div>
            <button type="submit" class="btn btn-primary">Sign Up</button>
            <div id="signup-error" class="error-message"></div>
          </form>
        </div>
      </div>
    </div>
  `;

  const tabs = container.querySelectorAll('.auth-tab');
  const signinForm = container.querySelector('#signin-form');
  const signupForm = container.querySelector('#signup-form');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      if (tabName === 'signin') {
        signinForm.classList.add('active');
        signupForm.classList.remove('active');
      } else {
        signupForm.classList.add('active');
        signinForm.classList.remove('active');
      }
    });
  });

  signinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = container.querySelector('#signin-error');
    errorEl.textContent = '';

    const email = container.querySelector('#signin-email').value;
    const password = container.querySelector('#signin-password').value;

    try {
      const { user } = await auth.signIn(email, password);
      onSuccess(user);
    } catch (error) {
      errorEl.textContent = error.message || 'Failed to sign in';
    }
  });

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = container.querySelector('#signup-error');
    errorEl.textContent = '';

    const name = container.querySelector('#signup-name').value;
    const email = container.querySelector('#signup-email').value;
    const password = container.querySelector('#signup-password').value;

    try {
      const { user } = await auth.signUp(email, password, name);
      onSuccess(user);
    } catch (error) {
      errorEl.textContent = error.message || 'Failed to sign up';
    }
  });
}
