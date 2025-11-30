let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallBanner();
});

window.addEventListener('appinstalled', () => {
  console.log('PWA was installed');
  deferredPrompt = null;
  hideInstallBanner();
});

function showInstallBanner() {
  const banner = document.getElementById('install-banner');
  if (banner) {
    banner.style.display = 'flex';
  }
}

function hideInstallBanner() {
  const banner = document.getElementById('install-banner');
  if (banner) {
    banner.style.display = 'none';
  }
}

async function installApp() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    deferredPrompt = null;
    hideInstallBanner();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const installBtn = document.getElementById('install-btn');
  if (installBtn) {
    installBtn.addEventListener('click', installApp);
  }

  const dismissBtn = document.getElementById('dismiss-banner-btn');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', hideInstallBanner);
  }
});
