// Registers the push service worker and subscribes the current browser to
// Web Push, so task-assignment / work-lunch-logout / long-break
// notifications from push_routes.py arrive even when no Drawlead OS tab is
// open. No-ops quietly wherever push isn't available: unsupported browser,
// user hasn't granted permission yet, or VAPID keys aren't configured on
// the server yet (GET /api/push/vapid-public-key returns enabled: false).
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function setupPushNotifications(token) {
  if (!token) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');

    const { data } = await axios.get(`${API}/api/push/vapid-public-key`);
    if (!data.enabled || !data.publicKey) return;

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
    }
    if (Notification.permission !== 'granted') return;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });
    }

    await axios.post(`${API}/api/push/subscribe`, subscription.toJSON(), {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    console.error('Push notification setup failed:', e);
  }
}
