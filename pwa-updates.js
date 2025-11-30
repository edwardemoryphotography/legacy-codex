function showUpdateNotification() {
  const notification = document.getElementById('update-notification');
  if (notification) {
    notification.style.display = 'flex';
  }
}

function hideUpdateNotification() {
  const notification = document.getElementById('update-notification');
  if (notification) {
    notification.style.display = 'none';
  }
}

function reloadPage() {
  window.location.reload();
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('Service Worker controller changed - new version ready');
    hideUpdateNotification();
  });

  navigator.serviceWorker.ready.then(registration => {
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateNotification();
        }
      });
    });

    setInterval(() => {
      registration.update();
    }, 60000);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const updateBtn = document.getElementById('update-btn');
  if (updateBtn) {
    updateBtn.addEventListener('click', reloadPage);
  }

  const dismissUpdateBtn = document.getElementById('dismiss-update-btn');
  if (dismissUpdateBtn) {
    dismissUpdateBtn.addEventListener('click', hideUpdateNotification);
  }
});
