
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
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export function useCallHandler(firestore: Firestore | null, user: User | null) {
  const { toast, dismiss } = useToast();
  
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const peerRef = useRef<Peer.Instance | null>(null);
  const incomingCallToastId = useRef<string | null>(null);


  const startCall = useCallback(async (calleeId: string) => {
    if (!firestore || !user) return;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        setLocalStream(stream);

        const callDocRef = doc(collection(firestore, 'calls'));
        const newCall: Omit<Call, 'id'> = {
            callerId: user.uid,
            calleeId: calleeId,
            status: 'offering',
            createdAt: serverTimestamp() as any,
        };

        const peer = new Peer({
            initiator: true,
            trickle: true,
            stream: stream,
        });

        peer.on('signal', async (data) => {
            if (data.type === 'offer') {
                const callData = { ...newCall, offer: data };
                await setDoc(callDocRef, callData);

                setActiveCall({ ...callData, id: callDocRef.id } as Call);
                setCallStatus('offering');
            }
        });
        
        peerRef.current = peer;

    } catch (err) {
        console.error("Error starting call:", err);
        toast({
            variant: 'destructive',
            title: "Could not start call",
            description: "Please ensure you have microphone permissions enabled."
        });
    }
  }, [firestore, user, toast]);


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
    setIsMuted(false);
  }, [localStream, dismiss]);


  const hangUp = useCallback(async () => {
    if (!firestore || !activeCall) return;
    
    const callRef = doc(firestore, 'calls', activeCall.id);
    await updateDoc(callRef, { status: 'ended' });

    cleanupCall();
  }, [firestore, activeCall, cleanupCall]);


  // Listen for incoming calls
  useEffect(() => {
    if (!firestore || !user) return;
    const q = query(
        collection(firestore, 'calls'),
        where('calleeId', '==', user.uid),
        where('status', 'in', ['offering', 'ringing'])
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.docs.length) return;
        
        const incomingCall = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Call;

        if (activeCall) return; // Already in a call

        setActiveCall(incomingCall);
        setCallStatus('ringing');
    });

    return () => unsubscribe();
  }, [firestore, user, activeCall]);


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
            cleanupCall();
        }

        if (updatedCall.answer && peerRef.current && !peerRef.current.destroyed) {
            peerRef.current.signal(updatedCall.answer);
        }
    });

    return () => unsubscribe();
  }, [firestore, activeCall, cleanupCall]);


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
                const candidate = change.doc.data();
                peer.signal(candidate);
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


  const answerCall = useCallback(async () => {
    if (!firestore || !user || !activeCall || !activeCall.offer) return;
    
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
                const callRef = doc(firestore, 'calls', activeCall.id);
                await updateDoc(callRef, {
                    status: 'answered',
                    answer: data
                });
                setCallStatus('answered');
            }
        });
        
        peer.signal(activeCall.offer);
        peerRef.current = peer;

    } catch (err) {
        console.error("Error answering call:", err);
        toast({
            variant: 'destructive',
            title: "Could not answer call",
            description: "Please ensure you have microphone permissions enabled."
        });
        hangUp();
    }
  }, [firestore, user, activeCall, toast, hangUp]);


  const declineCall = useCallback(async () => {
    if (!firestore || !activeCall) return;
    const callRef = doc(firestore, 'calls', activeCall.id);
    await updateDoc(callRef, { status: 'declined' });
    cleanupCall();
  }, [firestore, activeCall, cleanupCall]);


  const toggleMute = () => {
    if (localStream) {
        localStream.getAudioTracks().forEach(track => {
            track.enabled = !track.enabled;
        });
        setIsMuted(prev => !prev);
    }
  };

  const isRinging = callStatus === 'ringing';

  useEffect(() => {
    if (isRinging && !incomingCallToastId.current) {
        const { id } = toast({
            duration: 60000, // 60 seconds to answer
            component: () => (
                 showIncomingCallToast({
                    callerId: activeCall?.callerId ?? 'Unknown',
                    onAccept: () => {
                        answerCall();
                        dismiss(id);
                        incomingCallToastId.current = null;
                    },
                    onDecline: () => {
                        declineCall();
                        dismiss(id);
                        incomingCallToastId.current = null;
                    },
                })
            )
        });
        incomingCallToastId.current = id;
    } else if (!isRinging && incomingCallToastId.current) {
        dismiss(incomingCallToastId.current);
        incomingCallToastId.current = null;
    }
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if(activeCall) {
            hangUp();
        }
    }
    
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
         window.removeEventListener('beforeunload', handleBeforeUnload);
        if (incomingCallToastId.current) {
            dismiss(incomingCallToastId.current);
        }
    }

  }, [isRinging, activeCall, answerCall, declineCall, dismiss, toast, hangUp]);


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