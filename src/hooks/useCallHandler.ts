
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
  writeBatch,
  getDocs,
  deleteDoc,
  getDoc,
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
  }, [localStream, dismiss]);


  const declineCall = useCallback(async () => {
    const callToDecline = activeCall || incomingCall;
    if (!firestore || !callToDecline) return;
    
    const callRef = doc(firestore, 'calls', callToDecline.id);
    try {
        const newStatus = callToDecline.status === 'ringing' ? 'declined' : 'ended';
        await updateDoc(callRef, { status: newStatus });
    } catch (e) {
        console.error("Failed to decline/cancel call:", e);
    }
    cleanupCall();
  }, [firestore, incomingCall, activeCall, cleanupCall]);


  const answerCall = useCallback(async () => {
    if (!firestore || !user || !incomingCall || !incomingCall.offer) return;
    
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
        const callerCandidatesCol = collection(callRef, 'callerCandidates');

        peer.on('signal', async (data) => {
            if (data.type === 'answer') {
                await updateDoc(callRef, { answer: data });
            } else if (data.type === 'candidate') {
                 await addDoc(answerCandidatesCol, data);
            }
        });
        
        peer.on('connect', () => {
            updateDoc(callRef, { status: 'answered' });
            setCallStatus('answered');
        });

        peer.on('stream', (remoteStream) => {
            setRemoteStream(remoteStream);
        });

        const unsubscribeCandidates = onSnapshot(callerCandidatesCol, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    if (peerRef.current && !peerRef.current.destroyed) {
                        peerRef.current.signal(change.doc.data() as any);
                    }
                }
            });
        });

        peer.signal(incomingCall.offer);

        peer.on('close', () => {
            unsubscribeCandidates();
            cleanupCall();
        });
        peer.on('error', (err) => {
            console.error("Peer error:", err);
            unsubscribeCandidates();
            cleanupCall();
        });

        setActiveCall(incomingCall);
        setIncomingCall(null);

    } catch (err) {
        console.error("Error answering call:", err);
        toast({
            variant: 'destructive',
            title: "Could not answer call",
            description: "Please ensure you have microphone permissions enabled."
        });
        
        if (incomingCall) {
            declineCall();
        }
    }
  }, [firestore, user, incomingCall, toast, cleanupCall, dismiss, declineCall]);

  const startCall = useCallback(async (calleeId: string) => {
    if (!firestore || !user) return;

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        setLocalStream(stream);
        
        const callDocRef = doc(collection(firestore, 'calls'));

        const peer = new Peer({
            initiator: true,
            trickle: true,
            stream: stream
        });
        peerRef.current = peer;
        
        const callerCandidatesCol = collection(callDocRef, 'callerCandidates');

        peer.on('signal', async (data) => {
            if (data.type === 'offer') {
                const newCallData: Omit<Call, 'id'> = {
                    callerId: user.uid,
                    calleeId: calleeId,
                    status: 'offering',
                    offer: data,
                    createdAt: serverTimestamp() as any,
                };
                await setDoc(callDocRef, newCallData);
                setActiveCall({ id: callDocRef.id, ...newCallData } as Call);
                setCallStatus('offering');
            } else if (data.type === 'candidate') {
                await addDoc(callerCandidatesCol, data);
            }
        });

        peer.on('connect', () => {
             setCallStatus('answered');
        });
        
        peer.on('stream', (remoteStream) => {
            setRemoteStream(remoteStream);
        });

        onSnapshot(callDocRef, (docSnap) => {
             const updatedCall = docSnap.data() as Call;
             if (updatedCall?.status === 'answered' && updatedCall.answer) {
                 if (peerRef.current && !peerRef.current.destroyed) {
                    peerRef.current.signal(updatedCall.answer);
                 }
                 setCallStatus('answered');
                 setActiveCall(prev => prev ? { ...prev, status: 'answered' } : null);
             } else if (updatedCall?.status === 'ended' || updatedCall?.status === 'declined' || updatedCall?.status === 'missed') {
                 toast({ title: `Call ${updatedCall.status}` });
                 cleanupCall();
             }
        });
        
        const answerCandidatesCol = collection(callDocRef, 'answerCandidates');
        onSnapshot(answerCandidatesCol, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    if (peerRef.current && !peerRef.current.destroyed) {
                        peerRef.current.signal(change.doc.data() as any);
                    }
                }
            });
        });

         peer.on('close', cleanupCall);
         peer.on('error', (err) => {
             console.error("Peer error:", err);
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

        if (activeCall || incomingCall || incomingCallToastId.current) return;
        
        const callRef = doc(firestore, 'calls', incomingCallData.id);
        updateDoc(callRef, { status: 'ringing' });

        setIncomingCall({...incomingCallData, status: 'ringing'});
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
            duration: 60000, 
            description: showIncomingCallToast({
                    callerId: incomingCall.callerId,
                    onAccept: () => answerCall(),
                    onDecline: () => declineCall(),
                }),
             onClose: async () => {
                if (incomingCallToastId.current === toastId) { 
                     if (firestore && incomingCall) {
                        try {
                            const callRef = doc(firestore, 'calls', incomingCall.id);
                            const currentDocSnap = await getDoc(callRef);
                            if (currentDocSnap.exists() && currentDocSnap.data().status === 'ringing') {
                               await updateDoc(callRef, { status: 'missed' });
                            }
                        } catch (e) {
                            console.error("Error updating call to missed:", e);
                        }
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
