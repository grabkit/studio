

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
  where
} from 'firebase/firestore';
import type { SyncCall, SyncCallStatus, SyncMessage } from '@/lib/types';
import Peer from 'simple-peer';
import { WithId } from '@/firebase';

export function useSyncHandler(firestore: Firestore | null, user: User | null) {
  const [activeSyncCall, setActiveSyncCall] = useState<WithId<SyncCall> | null>(null);
  const [syncCallStatus, setSyncCallStatus] = useState<SyncCallStatus | null>(null);
  const [localSyncStream, setLocalSyncStream] = useState<MediaStream | null>(null);
  const [remoteSyncStream, setRemoteSyncStream] = useState<MediaStream | null>(null);
  const [syncCallMessages, setSyncCallMessages] = useState<WithId<SyncMessage>[]>([]);

  const peerRef = useRef<Peer.Instance | null>(null);
  const callUnsubscribeRef = useRef<() => void>(() => {});
  const candidatesUnsubscribeRef = useRef<() => void>(() => {});
  const messagesUnsubscribeRef = useRef<() => void>(() => {});
  const queueRef = useRef<string | null>(null);


  const cleanup = useCallback(() => {
    console.log("Cleaning up Sync call handler...");
    callUnsubscribeRef.current();
    candidatesUnsubscribeRef.current();
    messagesUnsubscribeRef.current();

    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    if (localSyncStream) {
      localSyncStream.getTracks().forEach(track => track.stop());
    }

    setActiveSyncCall(null);
    setSyncCallStatus(null);
    setLocalSyncStream(null);
    setRemoteSyncStream(null);
    setSyncCallMessages([]);
  }, [localSyncStream]);
  
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
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalSyncStream(stream);

      // We need to atomically find-and-claim a user from the queue.
      // The correct way to do this client-side is to query for a potential peer,
      // then use a transaction to atomically verify they are still available and claim them.
      const queueQuery = query(collection(firestore, 'syncQueue'), limit(1));
      const queueSnapshot = await getDocs(queueQuery);

      let peerInQueue = queueSnapshot.docs.length > 0 ? queueSnapshot.docs[0] : null;

      // If the only person in the queue is ourselves, wait.
      if (peerInQueue && peerInQueue.id === user.uid) {
        console.log("Found myself in queue, waiting...");
        queueRef.current = user.uid; // Ensure cleanup works if we navigate away
        return;
      }
      
      // If we found a peer, try to match with them.
      if (peerInQueue) {
        const peerId = peerInQueue.id;
        const peerInQueueRef = peerInQueue.ref;

        await runTransaction(firestore, async (transaction) => {
          const peerDoc = await transaction.get(peerInQueueRef);
          if (!peerDoc.exists()) {
            // The peer was claimed by someone else. Throw an error to signal a retry.
            throw new Error("Peer was already matched");
          }

          // Atomically remove the peer from the queue and create the call.
          transaction.delete(peerInQueueRef);
          
          const callDocRef = doc(collection(firestore, 'syncCalls'));
          const newCallData = {
            participantIds: [user.uid, peerId],
            status: 'searching',
            createdAt: serverTimestamp(),
          };
          transaction.set(callDocRef, newCallData);
          console.log(`Matched with ${peerId}, created call ${callDocRef.id}`);
        });

      } else {
        // Queue is empty, add ourselves.
        const userInQueueRef = doc(firestore, 'syncQueue', user.uid);
        await setDoc(userInQueueRef, {
          userId: user.uid,
          timestamp: serverTimestamp(),
        });
        queueRef.current = user.uid;
        console.log("Added to queue");
      }
    } catch (err) {
      console.error("Error in sync call transaction:", err);
      // If peer was matched, we can retry the whole process.
      if ((err as Error).message === "Peer was already matched") {
        console.log("Retrying to find another match...");
        // Adding a small delay to prevent rapid-fire retries.
        setTimeout(() => findOrStartSyncCall(), 300 + Math.random() * 500);
      } else {
        // Could be a media permission error or other firestore error.
        console.error("Error starting sync call or getting media:", err);
      }
    }
  }, [firestore, user, cleanup]);

  const setupPeerConnection = useCallback((call: WithId<SyncCall>, stream: MediaStream) => {
    if (!firestore || !user) return;

    const isInitiator = call.participantIds[0] === user.uid;
    const peer = new Peer({
      initiator: isInitiator,
      trickle: true,
      stream: stream,
    });
    peerRef.current = peer;

    const callRef = doc(firestore, 'syncCalls', call.id);
    const callerCandidatesCol = collection(callRef, 'callerCandidates');
    const answerCandidatesCol = collection(callRef, 'answerCandidates');

    peer.on('signal', async (data) => {
      if (data.type === 'offer') {
        await updateDoc(callRef, { offer: data });
      } else if (data.type === 'answer') {
        await updateDoc(callRef, { answer: data });
      } else if (data.candidate) {
        if (isInitiator) {
          await addDoc(callerCandidatesCol, data);
        } else {
          await addDoc(answerCandidatesCol, data);
        }
      }
    });

    peer.on('connect', () => {
      console.log('Peer connected!');
      updateDoc(callRef, { status: 'active' });
    });

    peer.on('stream', (remoteMediaStream) => {
      setRemoteSyncStream(remoteMediaStream);
    });

    peer.on('close', cleanup);
    peer.on('error', (err) => {
      console.error('Peer error:', err);
      cleanup();
    });

    // Listen for answer/offer
    callUnsubscribeRef.current = onSnapshot(callRef, (docSnap) => {
      const updatedCall = docSnap.data() as SyncCall;
      if (updatedCall) {
        if (!isInitiator && updatedCall.offer && !peerRef.current?.destroyed) {
          peerRef.current?.signal(updatedCall.offer);
        }
        if (isInitiator && updatedCall.answer && !peerRef.current?.destroyed) {
          peerRef.current?.signal(updatedCall.answer);
        }
        if (updatedCall.status !== syncCallStatus) {
            setSyncCallStatus(updatedCall.status);
            if (updatedCall.status === 'ended') {
                cleanup();
            }
        }
      }
    });

    // Listen for ICE candidates
    const candidatesToListen = isInitiator ? answerCandidatesCol : callerCandidatesCol;
    candidatesUnsubscribeRef.current = onSnapshot(candidatesToListen, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          if (peerRef.current && !peerRef.current.destroyed) {
            peerRef.current.signal(change.doc.data() as any);
          }
        }
      });
    });

  }, [firestore, user, cleanup, syncCallStatus]);

  useEffect(() => {
    if (activeSyncCall && localSyncStream && !peerRef.current) {
        setupPeerConnection(activeSyncCall, localSyncStream);
    }
  }, [activeSyncCall, localSyncStream, setupPeerConnection]);
  
  // Listen for newly created calls where this user is a participant
  useEffect(() => {
    if (!firestore || !user) return;
    const q = query(
      collection(firestore, 'syncCalls'),
      where('participantIds', 'array-contains', user.uid),
      where('status', '==', 'searching'),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const callDoc = snapshot.docs[0];
        setActiveSyncCall({ id: callDoc.id, ...callDoc.data() } as WithId<SyncCall>);
      }
    });

    return () => unsubscribe();
  }, [firestore, user]);
  
   // Listen for chat messages
  useEffect(() => {
    if (!firestore || !activeSyncCall) {
        setSyncCallMessages([]);
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
    await addDoc(messagesCol, {
        senderId: user.uid,
        text: text,
        timestamp: serverTimestamp(),
    });
  }

  const hangUpSyncCall = useCallback(async () => {
    if (activeSyncCall && firestore) {
      const callRef = doc(firestore, 'syncCalls', activeSyncCall.id);
      await updateDoc(callRef, { status: 'ended' });
    }
    cleanup();
  }, [activeSyncCall, firestore, cleanup]);

  return {
    findOrStartSyncCall,
    leaveSyncQueue,
    hangUpSyncCall,
    sendSyncChatMessage,
    activeSyncCall,
    syncCallStatus,
    localSyncStream,
    remoteSyncStream,
    syncCallMessages,
  };
}
