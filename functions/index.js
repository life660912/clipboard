const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Auto-delete rooms and history older than 7 days
exports.cleanupOldData = functions.pubsub
    .schedule('every 24 hours')
    .onRun(async (context) => {
        const now = admin.firestore.Timestamp.now();
        const sevenDaysAgo = new Date(now.toDate());
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const roomsRef = admin.firestore().collection('rooms');
        
        try {
            // Delete rooms older than 7 days
            const oldRoomsSnapshot = await roomsRef
                .where('updatedAt', '<', sevenDaysAgo)
                .get();
            
            const deletePromises = [];
            oldRoomsSnapshot.forEach((doc) => {
                deletePromises.push(doc.ref.delete());
                
                // Also delete history subcollection
                deletePromises.push(
                    doc.ref.collection('history').get().then((historySnapshot) => {
                        const historyDeletes = [];
                        historySnapshot.forEach((historyDoc) => {
                            historyDeletes.push(historyDoc.ref.delete());
                        });
                        return Promise.all(historyDeletes);
                    })
                );
                
                // Delete activeUsers subcollection
                deletePromises.push(
                    doc.ref.collection('activeUsers').get().then((usersSnapshot) => {
                        const userDeletes = [];
                        usersSnapshot.forEach((userDoc) => {
                            userDeletes.push(userDoc.ref.delete());
                        });
                        return Promise.all(userDeletes);
                    })
                );
            });
            
            await Promise.all(deletePromises);
            console.log(`Deleted ${oldRoomsSnapshot.size} old rooms`);
            
            // Clean up history for all rooms (keep only 10 latest items)
            const allRoomsSnapshot = await roomsRef.get();
            const cleanupPromises = [];
            
            allRoomsSnapshot.forEach((doc) => {
                const historyRef = doc.ref.collection('history')
                    .orderBy('savedAt', 'desc');
                
                cleanupPromises.push(
                    historyRef.get().then((historySnapshot) => {
                        const deleteHistoryPromises = [];
                        historySnapshot.forEach((historyDoc, index) => {
                            if (index >= 10) { // Keep only 10 items
                                deleteHistoryPromises.push(historyDoc.ref.delete());
                            }
                        });
                        return Promise.all(deleteHistoryPromises);
                    })
                );
            });
            
            await Promise.all(cleanupPromises);
            console.log('Cleaned up history for all rooms');
            
            return null;
        } catch (error) {
            console.error('Error in cleanup:', error);
            return null;
        }
    });

// Add user to room's users array when they join
exports.addUserToRoom = functions.firestore
    .document('rooms/{roomId}/activeUsers/{userId}')
    .onCreate(async (snap, context) => {
        const roomId = context.params.roomId;
        const userId = context.params.userId;
        
        const roomRef = admin.firestore().collection('rooms').doc(roomId);
        
        return roomRef.update({
            users: admin.firestore.FieldValue.arrayUnion(userId)
        });
    });

// Remove inactive users (not active for 5 minutes)
exports.removeInactiveUsers = functions.pubsub
    .schedule('every 5 minutes')
    .onRun(async (context) => {
        const now = admin.firestore.Timestamp.now();
        const fiveMinutesAgo = new Date(now.toDate());
        fiveMinutesAgo.setMinutes(fiveMinutesAgo.getMinutes() - 5);
        
        const roomsRef = admin.firestore().collection('rooms');
        
        try {
            const roomsSnapshot = await roomsRef.get();
            const cleanupPromises = [];
            
            roomsSnapshot.forEach((roomDoc) => {
                const usersRef = roomDoc.ref.collection('activeUsers');
                
                cleanupPromises.push(
                    usersRef
                        .where('joinedAt', '<', fiveMinutesAgo)
                        .get()
                        .then((usersSnapshot) => {
                            const userDeletePromises = [];
                            usersSnapshot.forEach((userDoc) => {
                                userDeletePromises.push(userDoc.ref.delete());
                            });
                            return Promise.all(userDeletePromises);
                        })
                );
            });
            
            await Promise.all(cleanupPromises);
            console.log('Cleaned up inactive users');
            return null;
        } catch (error) {
            console.error('Error cleaning inactive users:', error);
            return null;
        }
    });