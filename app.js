// Replace with your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyDQaxmyKfPH47Yy5dfhx47t5w3ZuDFuDR4",
  authDomain: "clipboard-54e4e.firebaseapp.com",
  projectId: "clipboard-54e4e",
  storageBucket: "clipboard-54e4e.firebasestorage.app",
  messagingSenderId: "15498983647",
  appId: "1:15498983647:web:e6145bf6bb7935fcc9516a",
  measurementId: "G-XFBZMTRXCZ"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
