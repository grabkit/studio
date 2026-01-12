
// This file must be in the public folder

// Give the service worker access to Firebase Messaging.
// Note that you can only use Firebase Messaging here, other Firebase services
// are not available in the service worker.
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.9.0/firebase-messaging-compat.js');


// Initialize the Firebase app in the service worker with your project's config
const firebaseConfig = {
  apiKey: "AIzaSyC0GNapq-TrgTv8aOmKMoVY7pDJMZ_twnw",
  authDomain: "studio-3055449916-97578.firebaseapp.com",
  projectId: "studio-3055449916-97578",
  storageBucket: "studio-3055449916-97578.appspot.com",
  messagingSenderId: "931224557936",
  appId: "1:931224557936:web:948c0817d47b474cd317b5",
  measurementId: ""
};

firebase.initializeApp(firebaseConfig);


// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();


messaging.onBackgroundMessage((payload) => {
  console.log(
    '[firebase-messaging-sw.js] Received background message ',
    payload
  );
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/blur-logo.png' // Make sure you have a logo file here
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
