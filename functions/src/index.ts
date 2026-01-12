
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();
const fcm = admin.messaging();


/**
 * Sends a push notification when a new notification document is created.
 */
export const sendPushNotification = functions.firestore
  .document("users/{userId}/notifications/{notificationId}")
  .onCreate(async (snapshot, context) => {
    const {userId} = context.params;
    const notificationData = snapshot.data();

    if (!notificationData) {
      console.log("No notification data found.");
      return;
    }

    // Get the user's data, including their FCM tokens
    const userRef = db.doc(`users/${userId}`);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      console.log(`User document not found for userId: ${userId}`);
      return;
    }
    const userData = userDoc.data();
    const tokens = userData?.fcmTokens;

    if (!tokens || tokens.length === 0) {
      console.log("No FCM tokens for user", userId);
      return;
    }

    const fromUserId = notificationData.fromUserId;
    const fromUserDoc = await db.doc(`users/${fromUserId}`).get();
    const fromUserName = fromUserDoc.data()?.name || "Someone";

    let title = "New Notification";
    let body = "You have a new notification.";

    switch (notificationData.type) {
      case "like":
        title = `${fromUserName} liked your post`;
        body = notificationData.activityContent
          ? `"${notificationData.activityContent.substring(0, 50)}..."`
          : "Check it out!";
        break;
      case "comment":
        title = `${fromUserName} replied to your post`;
        body = notificationData.activityContent
          ? `"${notificationData.activityContent.substring(0, 50)}..."`
          : "See what they said.";
        break;
      case "follow":
        title = "New Follower!";
        body = `${fromUserName} started following you.`;
        break;
      case "message_request":
        title = "New Message Request";
        body = `${fromUserName} wants to send you a message.`;
        break;
      case "repost":
        title = `${fromUserName} reposted your post`;
        body = notificationData.activityContent
            ? `"${notificationData.activityContent.substring(0, 50)}..."`
            : "Your post was shared.";
        break;
      case "quote":
        title = `${fromUserName} quoted your post`;
        body = notificationData.activityContent
            ? `"${notificationData.activityContent.substring(0, 50)}..."`
            : "See what they added.";
        break;
      case "new_post":
        title = `${fromUserName} just posted`;
        body = notificationData.activityContent
            ? `"${notificationData.activityContent.substring(0, 50)}..."`
            : "See their new post.";
        break;
    }

    const payload: admin.messaging.MessagingPayload = {
      notification: {
        title,
        body,
        icon: "/blur-logo.png",
        click_action: notificationData.postId
          ? `/post/${notificationData.postId}`
          : "/activity",
      },
    };

    // Send notifications to all tokens.
    const response = await fcm.sendToDevice(tokens, payload);
    const tokensToRemove: string[] = [];
    response.results.forEach((result, index) => {
      const error = result.error;
      if (error) {
        console.error(
          "Failure sending notification to",
          tokens[index],
          error
        );
        // Cleanup stale tokens
        if (
          error.code === "messaging/invalid-registration-token" ||
          error.code === "messaging/registration-token-not-registered"
        ) {
          tokensToRemove.push(tokens[index]);
        }
      }
    });

    if (tokensToRemove.length > 0) {
      await userRef.update({
        fcmTokens: admin.firestore.FieldValue.arrayRemove(...tokensToRemove),
      });
    }
  });
