import { getApps, initializeApp } from 'firebase/app';
import { getAuth, getFirestore } from 'firebase/auth';

// IMPORTANT: Replace the placeholder values with your own Firebase project configuration.
// You can find this in your Firebase project settings under "Project settings" > "General".
// It is highly recommended to use environment variables to store this sensitive information.
const firebaseConfig = {
  "projectId": "studio-3055449916-97578",
  "appId": "1:931224557936:web:948c0817d47b474cd317b5",
  "apiKey": "AIzaSyC0GNapq-TrgTv8aOmKMoVY7pDJMZ_twnw",
  "authDomain": "studio-3055449916-97578.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "931224557936"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

export { app, auth };
