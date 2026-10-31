import { requestAutoSync } from './syncService';

/**
 * Registers the Service Worker and sets up background sync message listeners.
 */
export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.log('[PWA] Service Workers not supported in this browser environment.');
    return;
  }

  // Register on window load to avoid delaying initial paint
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      console.log('[PWA] Service Worker registered with scope:', registration.scope);

      // Listen for background sync trigger messages sent by the service worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'BACKGROUND_SYNC_TRIGGER') {
          console.log('[PWA] Received BACKGROUND_SYNC_TRIGGER from Service Worker. Executing auto-sync...');
          requestAutoSync({ reason: 'sw-background-sync', immediate: true });
        }
      });
    } catch (error) {
      console.warn('[PWA] Service Worker registration failed:', error);
    }
  });
}
