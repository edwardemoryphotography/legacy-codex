import { auth } from '../lib/supabase.js';
import { showToast } from '../lib/utils.js';

export function renderAuth(container) {
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
              <input type="email" id="signin-email" required autocomplete="email" placeholder="you@example.com" />
            </div>
            <div class="form-group">
              <label for="signin-password">Password</label>
              <input type="password" id="signin-password" required autocomplete="current-password" placeholder="Your password" />
            </div>
            <button type="submit" class="btn btn-primary" id="signin-submit">Sign In</button>
            <div id="signin-error" class="error-message"></div>
          </form>

          <form id="signup-form" class="auth-form">
            <div class="form-group">
              <label for="signup-name">Display Name</label>
              <input type="text" id="signup-name" required autocomplete="name" placeholder="Your name" />
            </div>
            <div class="form-group">
              <label for="signup-email">Email</label>
              <input type="email" id="signup-email" required autocomplete="email" placeholder="you@example.com" />
            </div>
            <div class="form-group">
              <label for="signup-password">Password</label>
              <input type="password" id="signup-password" required minlength="6" autocomplete="new-password" placeholder="Min. 6 characters" />
            </div>
            <button type="submit" class="btn btn-primary" id="signup-submit">Create Account</button>
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
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (tab.dataset.tab === 'signin') {
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
    const submitBtn = container.querySelector('#signin-submit');
    errorEl.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';

    try {
      const email = container.querySelector('#signin-email').value;
      const password = container.querySelector('#signin-password').value;
      await auth.signIn(email, password);
    } catch (error) {
      errorEl.textContent = error.message || 'Failed to sign in';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = container.querySelector('#signup-error');
    const submitBtn = container.querySelector('#signup-submit');
    errorEl.textContent = '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';

    try {
      const name = container.querySelector('#signup-name').value;
      const email = container.querySelector('#signup-email').value;
      const password = container.querySelector('#signup-password').value;
      await auth.signUp(email, password, name);
      showToast('Account created successfully', 'success');
    } catch (error) {
      errorEl.textContent = error.message || 'Failed to create account';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';
    }
  });
}
