'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  query,
  limit,
  deleteDoc,
  addDoc,
  runTransaction,
  getDocs,
  where,
  orderBy
} from 'firebase/firestore';
import type { SyncCall, SyncCallStatus, SyncMessage } from '@/lib/types';
import { WithId } from '@/firebase';

export function useSyncHandler(firestore: Firestore | null, user: User | null) {
  const [activeSyncCall, setActiveSyncCall] = useState<WithId<SyncCall> | null>(null);
  const [syncCallStatus, setSyncCallStatus] = useState<SyncCallStatus | null>(null);
  const [syncCallMessages, setSyncCallMessages] = useState<WithId<SyncMessage>[]>([]);

  const callUnsubscribeRef = useRef<() => void>(() => {});
  const messagesUnsubscribeRef = useRef<() => void>(() => {});
  const queueRef = useRef<string | null>(null);


  const cleanup = useCallback(() => {
    console.log("Cleaning up Sync call handler...");
    callUnsubscribeRef.current();
    messagesUnsubscribeRef.current();
    setActiveSyncCall(null);
    setSyncCallStatus(null);
    setSyncCallMessages([]);
  }, []);
  
  const leaveSyncQueue = useCallback(async () => {
    if (!firestore || !queueRef.current) return;
    const userInQueueRef = doc(firestore, 'syncQueue', queueRef.current);
    try {
        await deleteDoc(userInQueueRef);
        console.log("User removed from sync queue.");
    } catch (error) {
        console.error("Error removing user from sync queue:", error);
    }
    queueRef.current = null;
  }, [firestore]);


  const findOrStartSyncCall = useCallback(async () => {
    if (!firestore || !user) return;
    cleanup();

    try {
      const queueQuery = query(collection(firestore, 'syncQueue'), limit(2));
      const queueSnapshot = await getDocs(queueQuery);
      
      let peerInQueueDoc = null;
      for (const doc of queueSnapshot.docs) {
          if (doc.id !== user.uid) {
              peerInQueueDoc = doc;
              break;
          }
      }
      
      if (peerInQueueDoc) {
        const peerId = peerInQueueDoc.id;
        const peerInQueueRef = peerInQueueDoc.ref;

        await runTransaction(firestore, async (transaction) => {
          const peerDoc = await transaction.get(peerInQueueRef);
          if (!peerDoc.exists()) {
            throw new Error("Peer was already matched");
          }

          transaction.delete(peerInQueueRef);
          
          const callDocRef = doc(collection(firestore, 'syncCalls'));
          const newCallData = {
            participantIds: [user.uid, peerId].sort(),
            status: 'active',
            createdAt: serverTimestamp(),
          };
          transaction.set(callDocRef, newCallData);
          console.log(`Matched with ${peerId}, created call ${callDocRef.id}`);
        });
      } else {
        const userInQueueRef = doc(firestore, 'syncQueue', user.uid);
        await setDoc(userInQueueRef, {
          userId: user.uid,
          timestamp: serverTimestamp(),
        });
        queueRef.current = user.uid;
        console.log("Added/updated user in queue.");
      }
    } catch (err) {
      if ((err as Error).message === "Peer was already matched") {
        console.log("Peer was already matched. Retrying to find another match...");
        setTimeout(() => findOrStartSyncCall(), 300 + Math.random() * 500);
      } else {
        console.error("Error starting sync call:", err);
      }
    }
  }, [firestore, user, cleanup]);

  // Listen for newly created or ongoing calls where this user is a participant
  useEffect(() => {
    if (!firestore || !user) return;
    
    const q = query(
      collection(firestore, 'syncCalls'),
      where('participantIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let activeCallFound: WithId<SyncCall> | null = null;
      for (const doc of snapshot.docs) {
          const callData = doc.data() as SyncCall;
          if (callData.status !== 'ended') {
            activeCallFound = { id: doc.id, ...callData };
            break;
          }
      }

      if (activeCallFound) {
        if (!activeSyncCall || activeSyncCall.id !== activeCallFound.id) {
          setActiveSyncCall(activeCallFound);
        }
        setSyncCallStatus(activeCallFound.status);

      } else if (activeSyncCall) {
        // If there are no active calls but we had one in state, it means it has ended.
        cleanup();
      }
    });

    return () => unsubscribe();
  }, [firestore, user, activeSyncCall, cleanup]);
  
   // Listen for chat messages for the active call
  useEffect(() => {
    if (!firestore || !activeSyncCall) {
        setSyncCallMessages([]);
        messagesUnsubscribeRef.current(); // Clean up old listener
        return;
    };
    
    const messagesCol = collection(firestore, 'syncCalls', activeSyncCall.id, 'messages');
    const q = query(messagesCol, orderBy('timestamp', 'asc'));

    messagesUnsubscribeRef.current = onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WithId<SyncMessage>));
        setSyncCallMessages(messages);
    });

    return () => messagesUnsubscribeRef.current();
  }, [firestore, activeSyncCall]);

  const sendSyncChatMessage = async (text: string) => {
    if (!firestore || !user || !activeSyncCall) return;

    const messagesCol = collection(firestore, 'syncCalls', activeSyncCall.id, 'messages');
    try {
        await addDoc(messagesCol, {
            senderId: user.uid,
            text: text,
            timestamp: serverTimestamp(),
        });
    } catch(err) {
        console.error("Error sending sync chat message:", err);
    }
  }

  const hangUpSyncCall = useCallback(async () => {
    const callToHangup = activeSyncCall;
    
    // Cleanup local state immediately for instant feedback
    cleanup();

    if (callToHangup && firestore) {
      const callRef = doc(firestore, 'syncCalls', callToHangup.id);
      try {
        await updateDoc(callRef, { status: 'ended' });
      } catch (err) {
        console.error("Error hanging up sync call:", err);
      }
    }
    // The other user's onSnapshot listener will handle their cleanup.
  }, [activeSyncCall, firestore, cleanup]);

  return {
    findOrStartSyncCall,
    leaveSyncQueue,
    hangUpSyncCall,
    sendSyncChatMessage,
    activeSyncCall,
    syncCallStatus,
    syncCallMessages,
  };
}
