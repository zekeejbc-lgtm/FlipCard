// Firebase Cloud Messaging Service Worker
// This file handles background push notifications

// Give the service worker access to Firebase Messaging.
// Note: Firebase v9 uses modular SDK, but service workers still use v8 compat
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyD9igTpHd8LsXCZhGarVB2PnrO2aszNQGc",
  authDomain: "cumlaude-push.firebaseapp.com",
  projectId: "cumlaude-push",
  storageBucket: "cumlaude-push.firebasestorage.app",
  messagingSenderId: "56596622764",
  appId: "1:56596622764:web:05ec45b90f51e096e09e09"
});

// Retrieve an instance of Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  
  const notificationTitle = payload.notification?.title || 'Classroom Virtual Environment';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    tag: payload.data?.tag || 'cumlaude-notification',
    data: payload.data,
    requireInteraction: false
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event.notification);
  
  event.notification.close();
  
  // Get the URL to open (from notification data or default to app)
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
