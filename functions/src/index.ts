import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();
const ADMIN_USER_ID = "e9ZGHMjgnmO3ueSbf1ao3Crvlr02";

export const deleteExpiredPosts = functions.pubsub
  .schedule("every 5 minutes")
  .onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    // Query for posts whose expiration time is in the past.
    const query = db.collection("posts").where("expiresAt", "<=", now);

    const expiredPosts = await query.get();

    if (expiredPosts.empty) {
      console.log("No expired posts to delete.");
      return null;
    }

    // Use a batch to delete all expired posts in one go.
    const batch = db.batch();
    expiredPosts.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    console.log(`Deleted ${expiredPosts.size} expired posts.`);
    return null;
  });

const createRoomNotification = async (
  roomId: string,
  notificationContent: string,
) => {
  const usersSnapshot = await db.collection("users").get();
  if (usersSnapshot.empty) {
    console.log("No users to notify.");
    return;
  }

  const batch = db.batch();
  let notificationCount = 0;

  usersSnapshot.forEach((userDoc) => {
    const userId = userDoc.id;
    const notificationRef = db
      .collection("users")
      .doc(userId)
      .collection("notifications")
      .doc(); // Auto-generate ID

    const notificationData = {
      id: notificationRef.id,
      type: "new_post",
      postId: roomId,
      fromUserId: ADMIN_USER_ID,
      activityContent: notificationContent,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      read: false,
    };
    batch.set(notificationRef, notificationData);
    notificationCount++;
  });

  await batch.commit();
  console.log(`Sent ${notificationCount} notifications for room ${roomId}.`);
};

export const sendManualNotification = functions.firestore
    .document('manualNotifications/{notificationId}')
    .onCreate(async (snap, context) => {
        const { roomId, notificationContent } = snap.data();

        if (!roomId || !notificationContent) {
            console.error("Missing roomId or notificationContent in the trigger document.");
            return null;
        }

        console.log(`Manually triggered notification for room: ${roomId}`);
        await createRoomNotification(roomId, notificationContent);

        // Optional: Delete the trigger document after processing
        return snap.ref.delete();
    });
