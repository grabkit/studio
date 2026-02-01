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

    const queueQuery = query(collection(firestore, 'syncQueue'), limit(2));
    const queueSnapshot = await getDocs(queueQuery);
    
    const peerInQueueDoc = queueSnapshot.docs.find(doc => doc.id !== user.uid);
    
    if (peerInQueueDoc) {
      const peerId = peerInQueueDoc.id;
      const peerInQueueRef = peerInQueueDoc.ref;

      try {
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
      } catch (err) {
        // This error is expected if two users try to match at the same time.
        // One transaction will succeed, the other will fail. The user whose
        // transaction failed will automatically be connected to the call
        // created by the other user via the onSnapshot listener for active calls.
        // We can log this for debugging but it doesn't need to be an error.
        console.log('Sync call transaction failed, likely a race condition (this is okay).');
      }
    } else {
      const userInQueueRef = doc(firestore, 'syncQueue', user.uid);
      await setDoc(userInQueueRef, { userId: user.uid, timestamp: serverTimestamp() });
      queueRef.current = user.uid;
    }
  }, [firestore, user, leaveSyncQueue]);

  // Listen for newly created or ongoing calls where this user is a participant
  useEffect(() => {
    if (!firestore || !user) return;
    
    const q = query(
      collection(firestore, 'syncCalls'),
      where('participantIds', 'array-contains', user.uid),
    );

    callUnsubscribeRef.current = onSnapshot(q, (snapshot) => {
        const activeCalls = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as WithId<SyncCall>))
            .filter(call => call.status !== 'ended');
        
        if (activeCalls.length > 0) {
            setActiveSyncCall(activeCalls[0]);
        } else {
             if (activeSyncCallRef.current) {
                cleanup();
            }
        }
    });

    return () => callUnsubscribeRef.current();
  }, [firestore, user, cleanup]);
  
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
    
    // Don't cleanup local state immediately to avoid race conditions.
    // Let the onSnapshot listener handle the state update when the status changes to 'ended'.

    if (callToHangup && firestore) {
      const callRef = doc(firestore, 'syncCalls', callToHangup.id);
      try {
        await updateDoc(callRef, { status: 'ended' });
      } catch (err) {
        console.error("Error hanging up sync call:", err);
      }
    } else {
        // If there's no active call, we might still need to clean up local state
        cleanup();
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
