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

// 3. Login / Logout
document.getElementById("loginBtn").onclick = () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider);
};

document.getElementById("logoutBtn").onclick = () => {
  auth.signOut();
};

// 4. Save clipboard text
document.getElementById("saveBtn").onclick = () => {
  const text = document.getElementById("clipboardInput").value;
  if (auth.currentUser) {
    db.collection("clipboard").add({
      text: text,
      user: auth.currentUser.email,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
  } else {
    alert("Please login first!");
  }
};

// 5. Listen for updates
db.collection("clipboard")
  .orderBy("timestamp", "desc")
  .onSnapshot(snapshot => {
    const output = document.getElementById("clipboardOutput");
    output.innerHTML = "";
    snapshot.forEach(doc => {
      const data = doc.data();
      output.innerHTML += `<p>${data.user}: ${data.text}</p>`;
    });
  });
