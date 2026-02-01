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
  const [syncCallMessages, setSyncCallMessages] = useState<WithId<SyncMessage>[]>([]);

  // Refs to hold latest values without causing re-renders in effects
  const callUnsubscribeRef = useRef<() => void>(() => {});
  const messagesUnsubscribeRef = useRef<() => void>(() => {});
  const queueRef = useRef<string | null>(null);
  const activeSyncCallRef = useRef(activeSyncCall);
  activeSyncCallRef.current = activeSyncCall;


  const cleanup = useCallback(() => {
    callUnsubscribeRef.current();
    messagesUnsubscribeRef.current();
    setActiveSyncCall(null);
    setSyncCallMessages([]);
  }, []);
  
  const leaveSyncQueue = useCallback(async () => {
    if (!firestore || !queueRef.current) return;
    const userInQueueRef = doc(firestore, 'syncQueue', queueRef.current);
    try {
        await deleteDoc(userInQueueRef);
    } catch (error) {
        // This is okay, it might have been deleted by a matching transaction
    }
    queueRef.current = null;
  }, [firestore]);


  const findOrStartSyncCall = useCallback(async () => {
    if (!firestore || !user || activeSyncCallRef.current) return;
    
    // Leave any old queue entry before starting
    await leaveSyncQueue();

    try {
      const queueQuery = query(collection(firestore, 'syncQueue'), limit(2));
      const queueSnapshot = await getDocs(queueQuery);
      
      const peerInQueueDoc = queueSnapshot.docs.find(doc => doc.id !== user.uid);
      
      if (peerInQueueDoc) {
        const peerId = peerInQueueDoc.id;
        const peerInQueueRef = peerInQueueDoc.ref;

        await runTransaction(firestore, async (transaction) => {
          const peerDoc = await transaction.get(peerInQueueRef);
          if (!peerDoc.exists()) throw new Error("Peer was already matched");

          transaction.delete(peerInQueueRef);
          
          const callDocRef = doc(collection(firestore, 'syncCalls'));
          const newCallData = {
            participantIds: [user.uid, peerId].sort(),
            status: 'active',
            createdAt: serverTimestamp(),
          };
          transaction.set(callDocRef, newCallData);
        });
      } else {
        const userInQueueRef = doc(firestore, 'syncQueue', user.uid);
        await setDoc(userInQueueRef, { userId: user.uid, timestamp: serverTimestamp() });
        queueRef.current = user.uid;
      }
    } catch (err) {
      console.error("Error in findOrStartSyncCall:", err);
      if ((err as Error).message === "Peer was already matched") {
        setTimeout(() => findOrStartSyncCall(), 300 + Math.random() * 300);
      }
    }
  }, [firestore, user, leaveSyncQueue]);

  // Listen for newly created or ongoing calls where this user is a participant
  useEffect(() => {
    if (!firestore || !user) return;
    
    const q = query(
      collection(firestore, 'syncCalls'),
      where('participantIds', 'array-contains', user.uid),
      where('status', '==', 'active')
    );

    callUnsubscribeRef.current = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const callDoc = snapshot.docs[0];
        const callData = { id: callDoc.id, ...callDoc.data() } as WithId<SyncCall>;
        setActiveSyncCall(callData);
      } else {
        setActiveSyncCall(null);
      }
    });

    return () => callUnsubscribeRef.current();
  }, [firestore, user]);
  
   // Listen for chat messages for the active call
  useEffect(() => {
    if (!firestore || !activeSyncCall) {
        setSyncCallMessages([]);
        if (messagesUnsubscribeRef.current) messagesUnsubscribeRef.current();
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
    const callToHangup = activeSyncCallRef.current;
    
    // Cleanup local state immediately to trigger UI changes (like redirect)
    cleanup();

    if (callToHangup && firestore) {
      const callRef = doc(firestore, 'syncCalls', callToHangup.id);
      try {
        await updateDoc(callRef, { status: 'ended' });
      } catch (err) {
        console.error("Error hanging up sync call:", err);
      }
    }
  }, [firestore, cleanup]);

  return {
    findOrStartSyncCall,
    leaveSyncQueue,
    hangUpSyncCall,
    sendSyncChatMessage,
    activeSyncCall,
    syncCallMessages,
  };
}
