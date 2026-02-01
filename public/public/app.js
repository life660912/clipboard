// Firebase Configuration (Replace with your config)
const firebaseConfig = {
  apiKey: "AIzaSyDQaxmyKfPH47Yy5dfhx47t5w3ZuDFuDR4",
  authDomain: "clipboard-54e4e.firebaseapp.com",
  projectId: "clipboard-54e4e",
  storageBucket: "clipboard-54e4e.firebasestorage.app",
  messagingSenderId: "15498983647",
  appId: "1:15498983647:web:e6145bf6bb7935fcc9516a",
  measurementId: "G-XFBZMTRXCZ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// App State
let currentUser = null;
let currentRoomId = null;
let unsubscribeRoom = null;
let unsubscribeUsers = null;
let editor = null;
let saveTimeout = null;
let lastContent = '';

// DOM Elements
const authSection = document.getElementById('auth-section');
const mainApp = document.getElementById('main-app');
const googleSigninBtn = document.getElementById('google-signin');
const signoutBtn = document.getElementById('signout');
const userNameEl = document.getElementById('user-name');
const userAvatarEl = document.getElementById('user-avatar');
const roomIdInput = document.getElementById('room-id');
const copyRoomBtn = document.getElementById('copy-room');
const newRoomBtn = document.getElementById('new-room');
const clearEditorBtn = document.getElementById('clear-editor');
const downloadBtn = document.getElementById('download-text');
const roomModal = document.getElementById('room-modal');
const roomInput = document.getElementById('room-input');
const joinRoomBtn = document.getElementById('join-room');
const closeModalBtn = document.getElementById('close-modal');
const shareRoomBtn = document.getElementById('share-room');
const roomsContainer = document.getElementById('rooms-container');
const saveStatusEl = document.getElementById('save-status');
const userCountEl = document.getElementById('user-count');
const userCountSpan = userCountEl.querySelector('span');

// Initialize CodeMirror Editor
function initEditor() {
    editor = CodeMirror.fromTextArea(document.getElementById('clipboard-editor'), {
        lineNumbers: true,
        mode: 'markdown',
        theme: 'dracula',
        lineWrapping: true,
        autofocus: true,
        extraKeys: {
            "Ctrl-S": function() { saveContent(); },
            "Cmd-S": function() { saveContent(); }
        }
    });
    
    // Debounced save on content change
    editor.on('change', function() {
        clearTimeout(saveTimeout);
        saveStatusEl.innerHTML = '<i class="fas fa-sync-alt"></i> Saving...';
        saveStatusEl.className = 'status-saving';
        
        saveTimeout = setTimeout(saveContent, 2000); // Auto-save every 2 seconds
    });
}

// Google Sign In
googleSigninBtn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .then((result) => {
            console.log('Signed in successfully');
        })
        .catch((error) => {
            console.error('Sign in error:', error);
            alert('Sign in failed: ' + error.message);
        });
});

// Sign Out
signoutBtn.addEventListener('click', () => {
    auth.signOut().then(() => {
        if (unsubscribeRoom) unsubscribeRoom();
        if (unsubscribeUsers) unsubscribeUsers();
        currentRoomId = null;
        mainApp.classList.add('hidden');
        authSection.classList.remove('hidden');
    });
});

// Create or Join Room
newRoomBtn.addEventListener('click', () => {
    roomInput.value = '';
    roomModal.classList.remove('hidden');
});

shareRoomBtn.addEventListener('click', () => {
    if (currentRoomId) {
        const shareUrl = `${window.location.origin}?room=${currentRoomId}`;
        if (navigator.share) {
            navigator.share({
                title: 'Join my Live Clipboard Room',
                text: 'Join me on Live Clipboard for real-time text synchronization',
                url: shareUrl
            });
        } else {
            navigator.clipboard.writeText(shareUrl).then(() => {
                alert('Room link copied to clipboard!');
            });
        }
    }
});

joinRoomBtn.addEventListener('click', () => {
    const roomId = roomInput.value.trim();
    if (roomId) {
        joinRoom(roomId);
    } else {
        createNewRoom();
    }
    roomModal.classList.add('hidden');
});

closeModalBtn.addEventListener('click', () => {
    roomModal.classList.add('hidden');
});

copyRoomBtn.addEventListener('click', () => {
    if (currentRoomId) {
        navigator.clipboard.writeText(currentRoomId).then(() => {
            const originalText = copyRoomBtn.innerHTML;
            copyRoomBtn.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => {
                copyRoomBtn.innerHTML = originalText;
            }, 2000);
        });
    }
});

// Create New Room
function createNewRoom() {
    const newRoomId = generateRoomId();
    joinRoom(newRoomId);
}

function generateRoomId() {
    return Math.random().toString(36).substring(2, 10);
}

// Join Room
function joinRoom(roomId) {
    if (unsubscribeRoom) unsubscribeRoom();
    if (unsubscribeUsers) unsubscribeUsers();
    
    currentRoomId = roomId;
    roomIdInput.value = roomId;
    
    // Update active room in UI
    updateRoomList(roomId);
    
    // Listen to room content
    const roomRef = db.collection('rooms').doc(roomId);
    
    unsubscribeRoom = roomRef.onSnapshot((doc) => {
        if (doc.exists) {
            const data = doc.data();
            if (data.content !== editor.getValue()) {
                editor.setValue(data.content || '');
                lastContent = data.content || '';
            }
            
            // Update room info
            updateRoomInfo(doc);
        } else {
            // Create new room if it doesn't exist
            roomRef.set({
                content: '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                owner: currentUser.uid,
                users: [currentUser.uid]
            });
        }
        
        saveStatusEl.innerHTML = '<i class="fas fa-check-circle"></i> Saved';
        saveStatusEl.className = 'status-saved';
    });
    
    // Listen to active users
    unsubscribeUsers = roomRef.collection('activeUsers').onSnapshot((snapshot) => {
        const activeUsers = snapshot.docs.length;
        userCountSpan.textContent = activeUsers;
    });
    
    // Add user to active users
    const userRef = roomRef.collection('activeUsers').doc(currentUser.uid);
    userRef.set({
        name: currentUser.displayName,
        photoURL: currentUser.photoURL,
        joinedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Remove user when they leave
    window.addEventListener('beforeunload', () => {
        userRef.delete();
    });
}

// Save Content to Firestore
function saveContent() {
    if (!currentRoomId || !currentUser) return;
    
    const content = editor.getValue();
    if (content === lastContent) return;
    
    lastContent = content;
    
    const roomRef = db.collection('rooms').doc(currentRoomId);
    
    // Add to history (limit to 10 items)
    const historyRef = roomRef.collection('history').doc();
    historyRef.set({
        content: content,
        savedBy: currentUser.uid,
        savedByName: currentUser.displayName,
        savedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Update room content
    roomRef.update({
        content: content,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastEditedBy: currentUser.uid
    });
    
    // Clean old history items (client-side check, real cleanup in Cloud Functions)
    roomRef.collection('history')
        .orderBy('savedAt', 'desc')
        .get()
        .then((snapshot) => {
            const deletions = [];
            snapshot.forEach((doc, index) => {
                if (index >= 10) { // Keep only 10 latest items
                    deletions.push(doc.ref.delete());
                }
            });
            return Promise.all(deletions);
        });
}

// Update Room List
function updateRoomList(activeRoomId) {
    if (!currentUser) return;
    
    roomsContainer.innerHTML = '';
    
    // Get user's recent rooms
    db.collection('rooms')
        .where('users', 'array-contains', currentUser.uid)
        .orderBy('updatedAt', 'desc')
        .limit(10)
        .get()
        .then((snapshot) => {
            snapshot.forEach((doc) => {
                const room = doc.data();
                const roomEl = document.createElement('div');
                roomEl.className = `room-item ${doc.id === activeRoomId ? 'active' : ''}`;
                roomEl.innerHTML = `
                    <div class="room-info">
                        <span class="room-name">${doc.id}</span>
                        <span class="room-time">${formatTime(room.updatedAt?.toDate())}</span>
                    </div>
                `;
                
                roomEl.addEventListener('click', () => {
                    joinRoom(doc.id);
                });
                
                roomsContainer.appendChild(roomEl);
            });
            
            // Add "Create New" option
            const newRoomEl = document.createElement('div');
            newRoomEl.className = 'room-item';
            newRoomEl.innerHTML = `
                <div class="room-info">
                    <span class="room-name" style="color: #4f46e5;">
                        <i class="fas fa-plus"></i> Create New Room
                    </span>
                </div>
            `;
            newRoomEl.addEventListener('click', createNewRoom);
            roomsContainer.appendChild(newRoomEl);
        });
}

// Update Room Info
function updateRoomInfo(doc) {
    const data = doc.data();
    const timeEl = document.querySelector(`.room-item.active .room-time`);
    if (timeEl && data.updatedAt) {
        timeEl.textContent = formatTime(data.updatedAt.toDate());
    }
}

// Format Time
function formatTime(date) {
    if (!date) return 'Just now';
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
}

// Clear Editor
clearEditorBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to clear the editor? This will clear for all users in the room.')) {
        editor.setValue('');
        saveContent();
    }
});

// Download Content
downloadBtn.addEventListener('click', () => {
    const content = editor.getValue();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clipboard-${currentRoomId || 'content'}-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// Check URL for room parameter
function checkUrlForRoom() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    if (roomId) {
        joinRoom(roomId);
    }
}

// Auth State Observer
auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        userNameEl.textContent = user.displayName;
        userAvatarEl.src = user.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName);
        
        authSection.classList.add('hidden');
        mainApp.classList.remove('hidden');
        
        initEditor();
        updateRoomList();
        checkUrlForRoom();
        
        // If no room is specified, show room modal
        if (!currentRoomId) {
            setTimeout(() => {
                roomModal.classList.remove('hidden');
            }, 1000);
        }
    } else {
        currentUser = null;
        mainApp.classList.add('hidden');
        authSection.classList.remove('hidden');
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Handle room modal clicks
    roomModal.addEventListener('click', (e) => {
        if (e.target === roomModal) {
            roomModal.classList.add('hidden');
        }
    });
    
    // Auto-join room from localStorage
    const lastRoom = localStorage.getItem('lastRoom');
    if (lastRoom) {
        roomInput.value = lastRoom;
    }
});