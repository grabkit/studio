// This file must be in the public folder.

// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Your web app's Firebase configuration
const firebaseConfig = {
  "projectId": "studio-3055449916-97578",
  "appId": "1:931224557936:web:948c0817d47b474cd317b5",
  "apiKey": "AIzaSyC0GNapq-TrgTv8aOmKMoVY7pDJMZ_twnw",
  "authDomain": "studio-3055449916-97578.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "931224557936",
  "databaseURL": "https://studio-3055449916-97578-default-rtdb.firebaseio.com"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon || '/blur-logo.png' 
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
