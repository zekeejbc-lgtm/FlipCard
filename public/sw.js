// CumLaude! Service Worker
const CACHE_NAME = 'cumlaude-v2';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg'
];

function isCacheableAppRequest(requestUrl) {
  if (requestUrl.origin !== self.location.origin) {
    return false;
  }

  const { pathname } = requestUrl;
  return (
    pathname === '/' ||
    pathname === '/index.html' ||
    pathname === '/manifest.json' ||
    pathname === '/icon-192.svg' ||
    pathname === '/icon-512.svg' ||
    pathname.startsWith('/assets/')
  );
}

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Take control immediately
  self.clients.claim();
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);

  // Skip API calls and non-app assets
  if (event.request.url.includes('script.google.com') || !isCacheableAppRequest(requestUrl)) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone the response before caching
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => {
        // If network fails, try cache
        return caches.match(event.request);
      })
  );
});

// Firebase Cloud Messaging background handler
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Initialize Firebase in service worker
firebase.initializeApp({
  apiKey: "AIzaSyD9igTpHd8LsXCZhGarVB2PnrO2aszNQGc",
  authDomain: "cumlaude-push.firebaseapp.com",
  projectId: "cumlaude-push",
  storageBucket: "cumlaude-push.firebasestorage.app",
  messagingSenderId: "56596622764",
  appId: "1:56596622764:web:05ec45b90f51e096e09e09"
});

const messaging = firebase.messaging();

// Handle background push messages
messaging.onBackgroundMessage((payload) => {
  console.log('Background message received:', payload);
  
  const title = payload.notification?.title || 'CumLaude!';
  const options = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    data: payload.data || {},
    requireInteraction: true
  };

  return self.registration.showNotification(title, options);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.url.includes(targetUrl)) {
            return client.focus();
          }
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
