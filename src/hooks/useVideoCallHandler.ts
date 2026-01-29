
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
import type { VideoCall, VideoCallStatus } from '@/lib/types';
import type { WithId } from '@/firebase';

export function useVideoCallHandler(
    firestore: Firestore | null, 
    user: User | null,
) {
    const { toast } = useToast();
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [activeCall, setActiveCall] = useState<WithId<VideoCall> | null>(null);
    const [incomingCall, setIncomingCall] = useState<WithId<VideoCall> | null>(null);
    const [callStatus, setCallStatus] = useState<VideoCallStatus | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    
    const peerRef = useRef<Peer.Instance | null>(null);
    const callUnsubscribeRef = useRef<() => void>(() => {});
    const candidatesUnsubscribeRef = useRef<() => void>(() => {});
    const offerSignaledRef = useRef(false);
    const answerSignaledRef = useRef(false);

    // General cleanup function
    const cleanup = useCallback(() => {
        console.log("Cleaning up VIDEO call handler...");
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
        offerSignaledRef.current = false;
        answerSignaledRef.current = false;
    }, [localStream]);
    
    const declineCall = useCallback(async () => {
        if (incomingCall && firestore) {
            const callRef = doc(firestore, 'videoCalls', incomingCall.id);
            await updateDoc(callRef, { status: 'declined' });
        }
        cleanup();
    }, [incomingCall, firestore, cleanup]);

    const acceptCall = useCallback(async () => {
        if (!firestore || !incomingCall) return;

        // Optimistically update status to give caller instant feedback
        const callRef = doc(firestore, 'videoCalls', incomingCall.id);
        await updateDoc(callRef, { status: 'answered' });

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);
            setActiveCall(incomingCall);
            setCallStatus('answered'); // Local state update

            const answerCandidatesCol = collection(callRef, 'answerCandidates');
            
            const oldCandidatesSnap = await getDocs(answerCandidatesCol);
            oldCandidatesSnap.forEach(doc => deleteDoc(doc.ref));

        } catch (err) {
            console.error("Could not get user media to accept call", err);
            toast({ variant: 'destructive', title: 'Accept Failed', description: 'Could not access your camera or microphone.'});
            // declineCall will set status to 'declined' and clean up.
            declineCall();
        }
    }, [firestore, incomingCall, toast, declineCall]);

    const startCall = async (calleeId: string) => {
        if (!firestore || !user) return;
        cleanup();

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            setLocalStream(stream);

            const callDocRef = doc(collection(firestore, 'videoCalls'));
            const callData: Omit<VideoCall, 'id' | 'createdAt'> = {
                callerId: user.uid,
                calleeId: calleeId,
                participantIds: [user.uid, calleeId].sort(),
                status: 'offering',
            };
            await setDoc(callDocRef, { ...callData, createdAt: serverTimestamp() });
            
            const callWithId = { id: callDocRef.id, ...callData, createdAt: new Date() } as WithId<VideoCall>;
            setActiveCall(callWithId);
            setCallStatus('offering');
        } catch (err) {
            console.error("Could not get user media or start call", err);
            toast({ variant: 'destructive', title: 'Video Call Failed', description: 'Could not access your camera or microphone.'});
        }
    };

    const setupPeerConnection = useCallback((call: WithId<VideoCall>, stream: MediaStream) => {
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

        const callRef = doc(firestore, 'videoCalls', call.id);
        const callerCandidatesCol = collection(callRef, 'callerCandidates');
        const answerCandidatesCol = collection(callRef, 'answerCandidates');

        peer.on('signal', async (data) => {
            if (data.type === 'offer') {
                await updateDoc(callRef, { offer: data, status: 'ringing' });
            } else if (data.type === 'answer') {
                // The status is already set to 'answered', just update the answer payload
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
            console.log("Video Peer connected!");
            setCallStatus('answered');
        });
        
        peer.on('stream', (remoteMediaStream) => {
            setRemoteStream(remoteMediaStream);
        });

        peer.on('close', cleanup);
        
        peer.on('error', (err) => {
            if (err.message.includes('User-Initiated Abort')) return;
            console.error("Video Peer error:", err);
            cleanup();
        });


        callUnsubscribeRef.current = onSnapshot(callRef, (docSnap) => {
            const updatedCall = docSnap.data() as VideoCall;
            if (!updatedCall || peerRef.current?.destroyed) return;

            if (!isInitiator && updatedCall.offer && !offerSignaledRef.current) {
                offerSignaledRef.current = true;
                peerRef.current.signal(updatedCall.offer);
            }
            
            if (isInitiator && updatedCall.answer && !answerSignaledRef.current) {
                answerSignaledRef.current = true;
                peerRef.current.signal(updatedCall.answer);
            }
            
            if (updatedCall.status !== callStatus) {
                setCallStatus(updatedCall.status);
                if (['ended', 'declined', 'missed'].includes(updatedCall.status)) {
                    setTimeout(cleanup, 500); 
                }
            }
        });
        
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
    }, [firestore, user, cleanup, callStatus]);

    useEffect(() => {
        if (activeCall && localStream && !peerRef.current) {
            setupPeerConnection(activeCall, localStream);
        }
    }, [activeCall, localStream, setupPeerConnection]);

    useEffect(() => {
        if (!firestore || !user) return;

        const q = query(
            collection(firestore, 'videoCalls'),
            where('calleeId', '==', user.uid),
            where('status', '==', 'ringing')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const callDoc = snapshot.docs[0];
                const incomingCallData = { id: callDoc.id, ...callDoc.data() } as WithId<VideoCall>;
                if (!activeCall && !incomingCall) {
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
            const callRef = doc(firestore, 'videoCalls', activeCall.id);
            await updateDoc(callRef, { status: 'ended' });
        }
        cleanup();
    }, [activeCall, firestore, cleanup]);
    
     const toggleMute = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsMuted(prev => !prev);
        }
    };
    
    const toggleVideo = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach(track => {
                track.enabled = !track.enabled;
            });
            setIsVideoEnabled(prev => !prev);
        }
    }

    return { 
        startCall, 
        acceptCall,
        declineCall,
        hangUp,
        toggleMute,
        toggleVideo,
        isMuted,
        isVideoEnabled,
        activeCall, 
        incomingCall,
        callStatus,
        localStream, 
        remoteStream, 
    };
}
