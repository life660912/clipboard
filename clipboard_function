const input = document.getElementById("clipboardInput");
const output = document.getElementById("clipboardOutput");

document.getElementById("saveBtn").onclick = () => {
  db.collection("clipboard").add({
    text: input.value,
    user: auth.currentUser.email,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
  input.value = "";
};

// Listen for updates
db.collection("clipboard")
  .orderBy("timestamp", "desc")
  .onSnapshot(snapshot => {
    output.innerHTML = "";
    snapshot.forEach(doc => {
      const data = doc.data();
      output.innerHTML += `<p>${data.user}: ${data.text}</p>`;
    });
  });
