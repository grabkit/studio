
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
  where,
  addDoc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import type { Call, CallStatus, IceCandidate } from '@/lib/types';
import Peer from 'simple-peer';
import { useToast } from './use-toast';
import { showIncomingCallToast } from '@/components/IncomingCallToast';

export function useCallHandler(firestore: Firestore | null, user: User | null) {
  const { toast, dismiss } = useToast();
  
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);

  const peerRef = useRef<Peer.Instance | null>(null);
  const incomingCallToastId = useRef<string | null>(null);
  const answerProcessed = useRef(false);

  const cleanupCall = useCallback(() => {
    console.log("Cleaning up call...");
    if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (incomingCallToastId.current) {
      dismiss(incomingCallToastId.current);
      incomingCallToastId.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setActiveCall(null);
    setCallStatus(null);
    setIncomingCall(null);
    setIsMuted(false);
    answerProcessed.current = false;
  }, [localStream, dismiss]);


  const declineCall = useCallback(async () => {
    if (!firestore || !incomingCall) return;
    const callRef = doc(firestore, 'calls', incomingCall.id);
    try {
        await updateDoc(callRef, { status: 'declined' });
    } catch (e) {
        console.error("Failed to decline call:", e);
    }
    cleanupCall();
  }, [firestore, incomingCall, cleanupCall]);

  const answerCall = useCallback(async () => {
    if (!firestore || !user || !incomingCall || !incomingCall.offer) return;
    
    // Set the active call immediately to transition the UI
    setActiveCall(incomingCall);
    setCallStatus('ringing'); 
    setIncomingCall(null);
     if (incomingCallToastId.current) {
      dismiss(incomingCallToastId.current);
      incomingCallToastId.current = null;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        setLocalStream(stream);

        const peer = new Peer({
            initiator: false,
            trickle: true,
            stream: stream,
        });
        peerRef.current = peer;
        
        const callRef = doc(firestore, 'calls', incomingCall.id);
        const answerCandidatesCol = collection(callRef, 'answerCandidates');

        peer.on('signal', async (data) => {
            if (data.type === 'answer') {
                await updateDoc(callRef, {
                    status: 'answered',
                    answer: data
                });
                setCallStatus('answered');
            } else if (data.type === 'candidate') {
                 await addDoc(answerCandidatesCol, data);
            }
        });
        
        peer.on('stream', (remoteStream) => {
            setRemoteStream(remoteStream);
        });

        // Signal the offer to start the process
        peer.signal(incomingCall.offer);

        // Listen for caller's ICE candidates
        const callerCandidatesCol = collection(callRef, 'callerCandidates');
        const unsubscribe = onSnapshot(callerCandidatesCol, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    if (peerRef.current && !peerRef.current.destroyed) {
                        peerRef.current.signal(change.doc.data() as any);
                    }
                }
            });
        });

        peer.on('close', () => {
            unsubscribe();
            cleanupCall();
        });
        peer.on('error', (err) => {
            console.error("Peer error:", err);
            unsubscribe();
            cleanupCall();
        });


    } catch (err) {
        console.error("Error answering call:", err);
        toast({
            variant: 'destructive',
            title: "Could not answer call",
            description: "Please ensure you have microphone permissions enabled."
        });
        
        if (incomingCall) {
            const callRef = doc(firestore, 'calls', incomingCall.id);
            await updateDoc(callRef, { status: 'declined' });
        }
        cleanupCall();
    }
  }, [firestore, user, incomingCall, toast, cleanupCall, dismiss]);

  const startCall = useCallback(async (calleeId: string) => {
    if (!firestore || !user) return;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        setLocalStream(stream);
        
        const peer = new Peer({
            initiator: true,
            trickle: true,
            stream: stream,
        });
        peerRef.current = peer;

        const callDocRef = doc(collection(firestore, 'calls'));
        const callerCandidatesCol = collection(callDocRef, 'callerCandidates');

        setActiveCall({ id: callDocRef.id, callerId: user.uid, calleeId, status: 'offering' } as Call);
        setCallStatus('offering');
        
        peer.on('signal', async (data) => {
            if (data.type === 'offer') {
                const newCall: Omit<Call, 'id'> = {
                    callerId: user.uid,
                    calleeId: calleeId,
                    status: 'offering',
                    createdAt: serverTimestamp() as any,
                    offer: data
                };
                await setDoc(callDocRef, newCall);
            } else if (data.type === 'candidate') {
                await addDoc(callerCandidatesCol, data);
            }
        });
        
        peer.on('stream', (remoteStream) => {
            setRemoteStream(remoteStream);
        });

        const unsubscribe = onSnapshot(callDocRef, (docSnap) => {
             const updatedCall = docSnap.data() as Call;
             if (updatedCall?.status === 'answered' && updatedCall.answer && !answerProcessed.current) {
                answerProcessed.current = true;
                 if (peerRef.current && !peerRef.current.destroyed) {
                    peerRef.current.signal(updatedCall.answer);
                 }
             } else if (updatedCall?.status === 'ended' || updatedCall?.status === 'declined' || updatedCall?.status === 'missed') {
                 toast({ title: `Call ${updatedCall.status}` });
                 unsubscribe();
                 cleanupCall();
             }
        });
        
        const answerCandidatesCol = collection(callDocRef, 'answerCandidates');
        const unsubscribeCandidates = onSnapshot(answerCandidatesCol, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    if (peerRef.current && !peerRef.current.destroyed) {
                        peerRef.current.signal(change.doc.data() as any);
                    }
                }
            });
        });

         peer.on('close', () => {
             unsubscribe();
             unsubscribeCandidates();
             cleanupCall();
         });
         peer.on('error', (err) => {
             console.error("Peer error:", err);
             unsubscribe();
             unsubscribeCandidates();
             cleanupCall();
         });


    } catch (err) {
        console.error("Error starting call:", err);
        toast({
            variant: 'destructive',
            title: "Could not start call",
            description: "Please ensure you have microphone permissions enabled."
        });
    }
  }, [firestore, user, toast, cleanupCall]);

  const hangUp = useCallback(async () => {
    if (!firestore || !activeCall) return;
    
    const callRef = doc(firestore, 'calls', activeCall.id);
    try {
      await updateDoc(callRef, { status: 'ended' });
    } catch (e) {
      console.error("Failed to update call status to ended:", e);
    }
    // The onSnapshot listener will handle the cleanup.
  }, [firestore, activeCall]);


  // Listen for incoming calls
  useEffect(() => {
    if (!firestore || !user) return;
    const q = query(
        collection(firestore, 'calls'),
        where('calleeId', '==', user.uid),
        where('status', '==', 'offering')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.docs.length) return;
        
        const callDoc = snapshot.docs[0];
        const incomingCallData = { id: callDoc.id, ...callDoc.data() } as Call;

        // Prevent showing new call toast if already in a call or processing one
        if (activeCall || incomingCall || incomingCallToastId.current) return;

        setIncomingCall(incomingCallData);
    });

    return () => unsubscribe();
  }, [firestore, user, activeCall, incomingCall]);


  const toggleMute = () => {
    if (localStream) {
        localStream.getAudioTracks().forEach(track => {
            track.enabled = !track.enabled;
        });
        setIsMuted(prev => !prev);
    }
  };


  useEffect(() => {
    if (incomingCall && !incomingCallToastId.current) {
        const toastId = `incoming-call-${incomingCall.id}`;
        const { id } = toast({
            id: toastId,
            duration: 60000, // 60 seconds to answer
            description: showIncomingCallToast({
                    callerId: incomingCall.callerId,
                    onAccept: () => answerCall(),
                    onDecline: () => declineCall(),
                }),
             onClose: async () => {
                // This is called when the toast times out
                if (incomingCallToastId.current === toastId) { // check if it's the same call
                     if (firestore && incomingCall) {
                        const callRef = doc(firestore, 'calls', incomingCall.id);
                        await updateDoc(callRef, { status: 'missed' });
                     }
                    cleanupCall();
                }
            }
        });
        incomingCallToastId.current = id;
    } 
  }, [incomingCall, answerCall, declineCall, toast, firestore, cleanupCall]);
  
   useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if(activeCall) {
            hangUp();
        }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
         window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  }, [activeCall, hangUp]);


  return {
    startCall,
    answerCall,
    declineCall,
    hangUp,
    toggleMute,
    activeCall,
    callStatus,
    localStream,
    remoteStream,
    isMuted
  };
}

    