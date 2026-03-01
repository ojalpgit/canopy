// Use compat SDK (loaded by script tags in login.html / signup.html).
// If you see auth/configuration-not-found: enable Email/Password in Firebase Console
// → Authentication → Sign-in method → Email/Password → Enable → Save
var firebaseConfig = {
  apiKey: "AIzaSyABwUoLwuC2OiSFWlBFfe1cEXgxx4kzqYo",
  authDomain: "canopy-de358.firebaseapp.com",
  projectId: "canopy-de358",
  storageBucket: "canopy-de358.firebasestorage.app",
  messagingSenderId: "1040310142920",
  appId: "1:1040310142920:web:73535907a827dd6e22a2fd",
  measurementId: "G-CKP8J9K5MM"
};

if (typeof firebase !== 'undefined') {
  firebase.initializeApp(firebaseConfig);
}
