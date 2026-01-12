
'use client';

import { useState, useEffect, useCallback } from 'react';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

export function useFcm() {
  const { firebaseApp, user, firestore } = useFirebase();
  const { toast } = useToast();
  const [permission, setPermission] = useState<NotificationPermission>('default');

  // Effect to set initial permission status
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Effect to handle incoming foreground messages
  useEffect(() => {
    let unsubscribe: () => void;

    isSupported().then(supported => {
        if (supported && firebaseApp) {
            const messaging = getMessaging(firebaseApp);
            unsubscribe = onMessage(messaging, (payload) => {
              console.log('Foreground message received.', payload);
              toast({
                title: payload.notification?.title,
                description: payload.notification?.body,
              });
            });
        }
    });


    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [firebaseApp, toast]);

  const saveTokenToDb = useCallback(
    async (token: string) => {
      if (!firestore || !user) return;
      try {
        const userDocRef = doc(firestore, 'users', user.uid);
        await updateDoc(userDocRef, {
          fcmTokens: arrayUnion(token),
        });
        console.log('FCM token saved to Firestore.');
      } catch (error) {
        console.error('Error saving FCM token to Firestore:', error);
      }
    },
    [firestore, user]
  );

  const requestPermission = useCallback(async () => {
    if (!firebaseApp || !('Notification' in window) || !(await isSupported())) {
      console.log('Notifications not supported.');
      return;
    }

    try {
      const currentPermission = await Notification.requestPermission();
      setPermission(currentPermission);

      if (currentPermission === 'granted') {
        const messaging = getMessaging(firebaseApp);
        // Use your VAPID key from the Firebase console
        const fcmToken = await getToken(messaging, {
          vapidKey: 'BMroAQzePSAUnxmZhwcHRUd9YF7PYT4r2EnPRCbAvTMqh2LDNQApHLlH1sVtZqQxxjc5dhZ5n9HPFAHc9MU0a2o',
          serviceWorkerRegistration: await navigator.serviceWorker.register('/sw.js'),
        });

        if (fcmToken) {
          console.log('FCM Token:', fcmToken);
          await saveTokenToDb(fcmToken);
        } else {
          console.log('No registration token available. Request permission to generate one.');
        }
      } else {
        console.log('Notification permission denied.');
      }
    } catch (error) {
      console.error('An error occurred while retrieving token. ', error);
    }
  }, [firebaseApp, saveTokenToDb]);

  return { permission, requestPermission };
}
