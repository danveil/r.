import { useRegisterSW } from 'virtual:pwa-register/react';
export function UpdateNotice({ formOpen }: { formOpen: boolean }) {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration)
        window.addEventListener('focus', () => {
          if (navigator.onLine)
            void registration.update().catch(() => {
              /* Offline or host temporarily unavailable. Retry on focus. */
            });
        });
    },
  });
  if (formOpen || (!needRefresh && !offlineReady)) return null;
  return (
    <aside className="update-notice" aria-live="polite">
      <p>{needRefresh ? 'A fresh version is ready.' : 'Ready to use offline.'}</p>
      {needRefresh && <button onClick={() => void updateServiceWorker(true)}>Update now</button>}
      <button
        onClick={() => {
          setNeedRefresh(false);
          setOfflineReady(false);
        }}
      >
        {needRefresh ? 'Later' : 'Got it'}
      </button>
    </aside>
  );
}
