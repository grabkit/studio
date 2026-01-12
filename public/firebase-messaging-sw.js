
import { precacheAndRoute } from 'workbox-precaching';
import { initializeApp } from 'firebase/app';
import { getMessaging, onBackgroundMessage } from 'firebase/messaging/sw';

// This line is crucial for Workbox to inject the precache manifest.
precacheAndRoute(self.__WB_MANIFEST);

// Initialize the Firebase app in the service worker.
const firebaseApp = initializeApp({
  "projectId": "studio-3055449916-97578",
  "appId": "1:931224557936:web:948c0817d47b474cd317b5",
  "apiKey": "AIzaSyC0GNapq-TrgTv8aOmKMoVY7pDJMZ_twnw",
  "authDomain": "studio-3055449916-97578.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "931224557936",
  "databaseURL": "https://studio-3055449916-97578-default-rtdb.firebaseio.com"
});

const messaging = getMessaging(firebaseApp);

onBackgroundMessage(messaging, (payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon || '/blur-logo.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
