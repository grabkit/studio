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
  deleteDoc,
  getDocs,
} from 'firebase/firestore';
import Peer from 'simple-peer';
import { useToast } from './use-toast';
import { showIncomingCallToast } from '@/components/IncomingCallToast';
import type { Call, CallStatus, IceCandidate } from '@/lib/types';
import type { WithId } from '@/firebase';

export function useCallHandler(
    firestore: Firestore | null, 
    user: User | null,
) {
    const { toast } = useToast();
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [activeCall, setActiveCall] = useState<WithId<Call> | null>(null);
    const [incomingCall, setIncomingCall] = useState<WithId<Call> | null>(null);
    const [callStatus, setCallStatus] = useState<CallStatus | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    
    const peerRef = useRef<Peer.Instance | null>(null);
    const callUnsubscribeRef = useRef<() => void>(() => {});
    const candidatesUnsubscribeRef = useRef<() => void>(() => {});
    const incomingCallToastId = useRef<string | null>(null);
    const offerSignaledRef = useRef(false);
    const answerSignaledRef = useRef(false);

    // General cleanup function
    const cleanup = useCallback(() => {
        console.log("Cleaning up call handler...");
        callUnsubscribeRef.current();
        candidatesUnsubscribeRef.current();
        if (peerRef.current) {
            peerRef.current.destroy();
            peerRef.current = null;
        }
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        setActiveCall(null);
        setIncomingCall(null);
        setCallStatus(null);
        setLocalStream(null);
        setRemoteStream(null);
        if (incomingCallToastId.current) {
            toast.dismiss(incomingCallToastId.current);
            incomingCallToastId.current = null;
        }
        offerSignaledRef.current = false;
        answerSignaledRef.current = false;
    }, [localStream, toast]);
    
    const declineCall = useCallback(async () => {
        if (incomingCall && firestore) {
            const callRef = doc(firestore, 'calls', incomingCall.id);
            await updateDoc(callRef, { status: 'declined' });
        }
        cleanup();
    }, [incomingCall, firestore, cleanup]);

    const acceptCall = useCallback(async () => {
        if (!firestore || !incomingCall) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setLocalStream(stream);
            setActiveCall(incomingCall);
            setCallStatus('answered');

            const callRef = doc(firestore, 'calls', incomingCall.id);
            const answerCandidatesCol = collection(callRef, 'answerCandidates');
            
            // Clean up old candidates before answering
            const oldCandidatesSnap = await getDocs(answerCandidatesCol);
            oldCandidatesSnap.forEach(doc => deleteDoc(doc.ref));

        } catch (err) {
            console.error("Could not get user media to accept call", err);
            toast({ variant: 'destructive', title: 'Accept Failed', description: 'Could not access your microphone.'});
            declineCall();
        }
    }, [firestore, incomingCall, toast, declineCall]);

    const startCall = async (calleeId: string) => {
        if (!firestore || !user) return;
        cleanup();

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            setLocalStream(stream);

            const callDocRef = doc(collection(firestore, 'calls'));
            const callData: Omit<Call, 'id' | 'createdAt'> = {
                callerId: user.uid,
                calleeId: calleeId,
                participantIds: [user.uid, calleeId].sort(),
                status: 'offering',
            };
            await setDoc(callDocRef, { ...callData, createdAt: serverTimestamp() });
            
            const callWithId = { id: callDocRef.id, ...callData, createdAt: new Date() } as WithId<Call>;
            setActiveCall(callWithId);
            setCallStatus('offering');
        } catch (err) {
            console.error("Could not get user media or start call", err);
            toast({ variant: 'destructive', title: 'Call Failed', description: 'Could not access your microphone.'});
        }
    };

    const setupPeerConnection = useCallback((call: WithId<Call>, stream: MediaStream) => {
        if (!firestore || !user) return;

        const isInitiator = call.callerId === user.uid;
        const peer = new Peer({
            initiator: isInitiator,
            trickle: true,
            stream: stream,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                ]
            }
        });
        peerRef.current = peer;

        const callRef = doc(firestore, 'calls', call.id);
        const callerCandidatesCol = collection(callRef, 'callerCandidates');
        const answerCandidatesCol = collection(callRef, 'answerCandidates');

        peer.on('signal', async (data) => {
            if (data.type === 'offer') {
                await updateDoc(callRef, { offer: data, status: 'ringing' });
            } else if (data.type === 'answer') {
                await updateDoc(callRef, { answer: data, status: 'answered' });
            } else if (data.candidate) {
                if (isInitiator) {
                    await addDoc(callerCandidatesCol, data);
                } else {
                    await addDoc(answerCandidatesCol, data);
                }
            }
        });

        peer.on('connect', () => {
            console.log("Peer connected!");
            setCallStatus('answered');
        });
        
        peer.on('stream', (remoteMediaStream) => {
            setRemoteStream(remoteMediaStream);
        });

        peer.on('close', cleanup);
        
        peer.on('error', (err) => {
            // This error is often expected when the other user hangs up abruptly.
            // We can safely ignore it as the 'close' event will also trigger cleanup.
            if (err.message.includes('User-Initiated Abort')) {
                // Don't log this as an error, it's a normal part of hang-up
            } else {
                console.error("Peer error:", err);
            }
            cleanup();
        });


        // Listen for answer/offer
        callUnsubscribeRef.current = onSnapshot(callRef, (docSnap) => {
            const updatedCall = docSnap.data() as Call;
            if (!updatedCall || peerRef.current?.destroyed) return;

            // Callee receives offer
            if (!isInitiator && updatedCall.offer && !offerSignaledRef.current) {
                offerSignaledRef.current = true;
                peerRef.current.signal(updatedCall.offer);
            }
            
            // Caller receives answer
            if (isInitiator && updatedCall.answer && !answerSignaledRef.current) {
                answerSignaledRef.current = true;
                peerRef.current.signal(updatedCall.answer);
            }

            // Status handling
            setCallStatus(prevStatus => {
                if (!isInitiator && prevStatus === 'answered' && updatedCall.status === 'ringing') {
                    return 'answered';
                }
                return updatedCall.status;
            });

            if (updatedCall.status === 'ended' || updatedCall.status === 'declined' || updatedCall.status === 'missed') {
                setTimeout(cleanup, 500); 
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
    }, [firestore, user, cleanup]);

    useEffect(() => {
        if (activeCall && localStream && !peerRef.current) {
            setupPeerConnection(activeCall, localStream);
        }
    }, [activeCall, localStream, setupPeerConnection]);

    // Listen for incoming calls
    useEffect(() => {
        if (!firestore || !user) return;

        const q = query(
            collection(firestore, 'calls'),
            where('calleeId', '==', user.uid),
            where('status', '==', 'ringing')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const callDoc = snapshot.docs[0];
                const incomingCallData = { id: callDoc.id, ...callDoc.data() } as WithId<Call>;
                if (!activeCall && !incomingCall) { // Prevent handling multiple calls
                    setIncomingCall(incomingCallData);
                }
            } else {
                setIncomingCall(null);
            }
        });
        return () => unsubscribe();
    }, [firestore, user, activeCall, incomingCall]);
    
    const hangUp = useCallback(async () => {
        if (activeCall && firestore) {
            const callRef = doc(firestore, 'calls', activeCall.id);
            await updateDoc(callRef, { status: 'ended' });
        }
        cleanup();
    }, [activeCall, firestore, cleanup]);
    
     const toggleMute = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsMuted(!isMuted);
        }
    };


    return { 
        startCall, 
        acceptCall,
        declineCall,
        hangUp,
        toggleMute,
        isMuted,
        activeCall, 
        incomingCall,
        callStatus,
        localStream, 
        remoteStream, 
    };
}
