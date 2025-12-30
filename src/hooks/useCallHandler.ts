
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

export function useCallHandler(firestore: Firestore | null, user: User | null) {
  const { toast } = useToast();
  
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  
  const peerRef = useRef<Peer.Instance | null>(null);

  const cleanupCall = useCallback(() => {
    console.log("Cleaning up call...");
    if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    setLocalStream(null);
    setRemoteStream(null);
    setActiveCall(null);
    setCallStatus(null);
    setIsMuted(false);
  }, [localStream]);


  const declineCall = useCallback(async () => {
    if (!firestore || !activeCall) return;
    
    const callRef = doc(firestore, 'calls', activeCall.id);
    try {
        const newStatus = activeCall.status === 'ringing' ? 'declined' : 'ended';
        await updateDoc(callRef, { status: newStatus });
    } catch (e) {
        console.error("Failed to decline/cancel call:", e);
    }
    cleanupCall();
  }, [firestore, activeCall, cleanupCall]);


  const answerCall = useCallback(async () => {
    if (!firestore || !user || !activeCall || activeCall.status !== 'ringing' || !activeCall.offer) return;
    
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        setLocalStream(stream);

        const peer = new Peer({
            initiator: false,
            trickle: true,
            stream: stream,
        });
        peerRef.current = peer;
        
        const callRef = doc(firestore, 'calls', activeCall.id);
        const answerCandidatesCol = collection(callRef, 'answerCandidates');
        const callerCandidatesCol = collection(callRef, 'callerCandidates');

        peer.on('signal', async (data) => {
            if (data.type === 'answer') {
                await updateDoc(callRef, { answer: data, status: 'answered' });
            } else if (data.type === 'candidate') {
                 await addDoc(answerCandidatesCol, data);
            }
        });
        
        peer.on('connect', () => {
            setCallStatus('answered');
        });

        peer.on('stream', (remoteStream) => {
            setRemoteStream(remoteStream);
        });

        onSnapshot(callerCandidatesCol, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    if (peerRef.current && !peerRef.current.destroyed) {
                        peerRef.current.signal(change.doc.data() as any);
                    }
                }
            });
        });

        peer.signal(activeCall.offer);

        peer.on('close', cleanupCall);
        peer.on('error', (err) => {
            console.error("Peer error:", err);
            cleanupCall();
        });

    } catch (err) {
        console.error("Error answering call:", err);
        toast({
            variant: 'destructive',
            title: "Could not answer call",
            description: "Please ensure you have microphone permissions enabled."
        });
        if (activeCall) {
            declineCall();
        }
    }
  }, [firestore, user, activeCall, toast, cleanupCall, declineCall]);

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
             if (updatedCall?.answer && peerRef.current && !peerRef.current.destroyed) {
                 peerRef.current.signal(updatedCall.answer);
             }
             if (updatedCall?.status !== activeCall?.status) {
                setCallStatus(updatedCall?.status);
             }
             if (updatedCall?.status === 'ended' || updatedCall?.status === 'declined' || updatedCall?.status === 'missed') {
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
  }, [firestore, user, toast, cleanupCall, activeCall?.status]);

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
        where('status', 'in', ['offering', 'ringing'])
    );
    const unsubscribe = onSnapshot(q, async (snapshot) => {
        if (!snapshot.docs.length) {
            if (activeCall && activeCall.callerId !== user.uid && activeCall.status === 'ringing') {
                cleanupCall();
            }
            return;
        }
        
        const callDoc = snapshot.docs[0];
        const incomingCallData = { id: callDoc.id, ...callDoc.data() } as Call;

        // If we are already in a call, or this is the call we are already handling, ignore.
        if (activeCall && activeCall.id === incomingCallData.id) return;
        
        // If there's another active call, maybe decline this new one automatically?
        if (activeCall && activeCall.id !== incomingCallData.id) {
            const newCallRef = doc(firestore, 'calls', incomingCallData.id);
            await updateDoc(newCallRef, { status: 'declined' }); // Or 'busy' if you add that status
            return;
        }
        
        if (incomingCallData.status === 'offering') {
            const callRef = doc(firestore, 'calls', incomingCallData.id);
            await updateDoc(callRef, { status: 'ringing' });
            setActiveCall({ ...incomingCallData, status: 'ringing' });
            setCallStatus('ringing');
        } else {
            setActiveCall(incomingCallData);
            setCallStatus(incomingCallData.status);
        }
    });

    return () => unsubscribe();
  }, [firestore, user, activeCall, cleanupCall]);


  const toggleMute = () => {
    if (localStream) {
        localStream.getAudioTracks().forEach(track => {
            track.enabled = !track.enabled;
        });
        setIsMuted(prev => !prev);
    }
  };


   useEffect(() => {
    const handleBeforeUnload = () => {
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
