
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Auth, User } from 'firebase/auth';
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
  getDocs,
  writeBatch,
  addDoc,
  deleteDoc,
  getDoc,
} from 'firebase/firestore';
import type { Call, CallStatus, IceCandidate as IceCandidateType } from '@/lib/types';
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
    await updateDoc(callRef, { status: 'declined' });
    cleanupCall();
  }, [firestore, incomingCall, cleanupCall]);

  const answerCall = useCallback(async () => {
    if (!firestore || !user || !incomingCall || !incomingCall.offer) return;
    
    setActiveCall(incomingCall);
    setCallStatus('ringing');
    setIncomingCall(null);

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        setLocalStream(stream);

        const peer = new Peer({
            initiator: false,
            trickle: true,
            stream: stream,
        });

        peer.on('signal', async (data) => {
            if (data.type === 'answer') {
                const callRef = doc(firestore, 'calls', incomingCall.id);
                await updateDoc(callRef, {
                    status: 'answered',
                    answer: data
                });
                setCallStatus('answered');
            }
        });
        
        peer.signal(incomingCall.offer);
        peerRef.current = peer;

    } catch (err) {
        console.error("Error answering call:", err);
        toast({
            variant: 'destructive',
            title: "Could not answer call",
            description: "Please ensure you have microphone permissions enabled."
        });
        // Since declineCall is defined before, we can safely call it.
        if (incomingCall) {
            const callRef = doc(firestore, 'calls', incomingCall.id);
            await updateDoc(callRef, { status: 'declined' });
        }
        cleanupCall();
    }
  }, [firestore, user, incomingCall, toast, cleanupCall]);

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

        peer.on('signal', async (data) => {
            if (data.type === 'offer') {
                const callDocRef = doc(collection(firestore, 'calls'));
                const newCall: Omit<Call, 'id'> = {
                    callerId: user.uid,
                    calleeId: calleeId,
                    status: 'offering',
                    createdAt: serverTimestamp() as any,
                    offer: data
                };
                await setDoc(callDocRef, newCall);
                setActiveCall({ ...newCall, id: callDocRef.id } as Call);
                setCallStatus('offering');
            }
        });

    } catch (err) {
        console.error("Error starting call:", err);
        toast({
            variant: 'destructive',
            title: "Could not start call",
            description: "Please ensure you have microphone permissions enabled."
        });
    }
  }, [firestore, user, toast]);

  const hangUp = useCallback(async () => {
    if (!firestore || !activeCall) return;
    
    const callRef = doc(firestore, 'calls', activeCall.id);
    try {
      await updateDoc(callRef, { status: 'ended' });
    } catch (e) {
      console.error("Failed to update call status to ended:", e);
    }

    cleanupCall();
  }, [firestore, activeCall, cleanupCall]);


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

        if (activeCall || incomingCall) return;

        setIncomingCall(incomingCallData);
    });

    return () => unsubscribe();
  }, [firestore, user, activeCall, incomingCall]);


  // Listen for call status changes on the active call
  useEffect(() => {
    if (!firestore || !activeCall) return;
    
    const callRef = doc(firestore, 'calls', activeCall.id);
    const unsubscribe = onSnapshot(callRef, (docSnap) => {
        const updatedCall = docSnap.data() as Call;
        if (!updatedCall) {
            cleanupCall();
            return;
        }

        setCallStatus(updatedCall.status);

        if (updatedCall.status === 'ended' || updatedCall.status === 'declined' || updatedCall.status === 'missed') {
            toast({ title: `Call ${updatedCall.status}` });
            cleanupCall();
            return;
        }
        
        if (updatedCall.answer && peerRef.current && !peerRef.current.destroyed && peerRef.current.initiator && !answerProcessed.current) {
            answerProcessed.current = true;
            peerRef.current.signal(updatedCall.answer);
        }
    });

    return () => unsubscribe();
  }, [firestore, activeCall, cleanupCall, toast]);


  // Handle peer events (streams, ICE candidates)
  useEffect(() => {
    if (!peerRef.current || !activeCall || !firestore) return;
    const peer = peerRef.current;
    
    peer.on('stream', (remoteStream) => {
        setRemoteStream(remoteStream);
    });

    peer.on('signal', (data) => {
        if (data.type === 'candidate') {
            const candidatesCol = collection(firestore, 'calls', activeCall.id, 'iceCandidates');
            addDoc(candidatesCol, data);
        }
    });
    
    const candidatesCol = collection(firestore, 'calls', activeCall.id, 'iceCandidates');
    const unsubscribeCandidates = onSnapshot(candidatesCol, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                if (!peer.destroyed) {
                    const candidate = change.doc.data();
                    peer.signal(candidate);
                }
            }
        });
    });

    peer.on('close', () => hangUp());
    peer.on('error', (err) => {
        console.error("Peer error:", err);
        hangUp();
    });

    return () => {
        unsubscribeCandidates();
        peer.removeAllListeners();
    }
  }, [peerRef.current, activeCall, firestore, hangUp]);

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
            duration: 60000,
            description: showIncomingCallToast({
                    callerId: incomingCall.callerId,
                    onAccept: () => {
                        answerCall();
                        dismiss(toastId);
                        incomingCallToastId.current = null;
                    },
                    onDecline: () => {
                        declineCall();
                        dismiss(toastId);
                        incomingCallToastId.current = null;
                    },
                }),
             onClose: () => {
                if (incomingCall) {
                    // Use a separate function to decline if the toast times out,
                    // to avoid dependency issues with declineCall
                    const timeoutDecline = async () => {
                        if (!firestore) return;
                        const callRef = doc(firestore, 'calls', incomingCall.id);
                        await updateDoc(callRef, { status: 'missed' });
                        cleanupCall();
                    }
                    timeoutDecline();
                }
                incomingCallToastId.current = null;
            }
        });
        incomingCallToastId.current = id;
    } 

  }, [incomingCall, answerCall, declineCall, dismiss, toast, firestore, cleanupCall]);
  
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
