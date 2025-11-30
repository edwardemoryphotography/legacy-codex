function initTheme() {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const stored = localStorage.getItem('theme-mode');
  const theme = stored || (prefersDark ? 'dark' : 'light');

  applyTheme(theme);
}

function applyTheme(theme) {
  const root = document.documentElement;

  if (theme === 'dark') {
    root.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme-mode', 'dark');
  } else {
    root.removeAttribute('data-theme');
    localStorage.setItem('theme-mode', 'light');
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}

window.addEventListener('load', initTheme);

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (!localStorage.getItem('theme-mode')) {
    applyTheme(e.matches ? 'dark' : 'light');
  }
});
