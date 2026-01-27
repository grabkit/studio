
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();

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
