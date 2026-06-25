'use client';

import { useEffect, useState } from 'react';

export default function ServiceWorkerRegister() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      let registration: ServiceWorkerRegistration;

      navigator.serviceWorker.register('/sw.js').then((reg) => {
        registration = reg;

        // Check for updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
            }
          });
        });
      }).catch(console.error);

      // Also check on page load if controller changed
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }
  }, []);

  const handleUpdate = () => {
    setUpdateAvailable(false);
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.waiting) {
        reg.waiting.postMessage('skipWaiting');
      }
    });
  };

  return (
    <>
      {updateAvailable && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white px-4 py-3 flex items-center justify-between shadow-lg">
          <span className="text-sm font-medium">有新版本可用</span>
          <button
            onClick={handleUpdate}
            className="px-3 py-1 bg-white text-blue-600 text-sm font-medium rounded hover:bg-blue-50 transition-colors"
          >
            立即更新
          </button>
        </div>
      )}
    </>
  );
}
