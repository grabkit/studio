

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
} from 'firebase/firestore';
import type { VideoCall, CallStatus } from '@/lib/types';
import Peer from 'simple-peer';
import { useToast } from './use-toast';

type MissedCallInfo = {
  calleeId: string;
  type: 'voice' | 'video';
};

const peerConfig = {
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
        ],
    },
};

export function useVideoCallHandler(
    firestore: Firestore | null, 
    user: User | null,
    setMissedCallInfo: React.Dispatch<React.SetStateAction<MissedCallInfo | null>>
) {
  const { toast } = useToast();
  
  const [activeCall, setActiveCall] = useState<VideoCall | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  
  const peerRef = useRef<Peer.Instance | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const ringTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callerCandidatesUnsubscribeRef = useRef<() => void>(() => {});
  const answerCandidatesUnsubscribeRef = useRef<() => void>(() => {});


  const cleanupCall = useCallback(() => {
    console.log("Cleaning up video call...");
    if (peerRef.current) {
        peerRef.current.destroy();
        peerRef.current = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
    }
    if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
    }
    callerCandidatesUnsubscribeRef.current();
    answerCandidatesUnsubscribeRef.current();
    setLocalStream(null);
    setRemoteStream(null);
    setActiveCall(null);
    setCallStatus(null);
    setIsMuted(false);
    setIsVideoEnabled(true);
    setCallDuration(0);
  }, [localStream]);


  const declineCall = useCallback(async () => {
    if (!firestore || !activeCall) return;
    
    const callRef = doc(firestore, 'videoCalls', activeCall.id);
    try {
        const newStatus = activeCall.status === 'ringing' ? 'declined' : 'ended';
        await updateDoc(callRef, { status: newStatus });
    } catch (e) {
        console.error("Failed to decline/cancel video call:", e);
    }
    cleanupCall();
  }, [firestore, activeCall, cleanupCall]);


  const answerCall = useCallback(async () => {
    if (!firestore || !user || !activeCall || activeCall.status !== 'ringing' || !activeCall.offer) return;
    setCallStatus('answered');
    
    if (ringTimeoutRef.current) {
        clearTimeout(ringTimeoutRef.current);
        ringTimeoutRef.current = null;
    }
    
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    setLocalStream(stream);

    const peer = new Peer({
        ...peerConfig,
        initiator: false,
        trickle: true,
        stream: stream,
    });
    peerRef.current = peer;
    
    const callRef = doc(firestore, 'videoCalls', activeCall.id);
    const answerCandidatesCol = collection(callRef, 'answerCandidates');
    const callerCandidatesCol = collection(callRef, 'callerCandidates');

    peer.on('signal', async (data) => {
        if (data.type === 'answer') {
            await updateDoc(callRef, { status: 'answered', answer: data });
        } else if (data.candidate) {
             await addDoc(answerCandidatesCol, data);
        }
    });
    
    peer.on('connect', () => {
        setCallStatus('answered');
    });

    peer.on('track', (track, stream) => {
        setRemoteStream(stream);
    });

    callerCandidatesUnsubscribeRef.current = onSnapshot(callerCandidatesCol, (snapshot) => {
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
        if ((err as any).code === 'ERR_CONNECTION_FAILURE' || err.message.includes('reason=Close called')) {
            console.log("Peer connection gracefully closed or failed, cleaning up.");
            cleanupCall();
            return;
        }
        console.error("Peer error:", err);
        cleanupCall();
    });
  }, [firestore, user, activeCall, cleanupCall]);

  const startCall = useCallback(async (calleeId: string, stream: MediaStream) => {
    if (!firestore || !user) return;

    setLocalStream(stream);
    
    const callDocRef = doc(collection(firestore, 'videoCalls'));

    const peer = new Peer({
        ...peerConfig,
        initiator: true,
        trickle: true,
        stream: stream
    });
    peerRef.current = peer;
    
    const callerCandidatesCol = collection(callDocRef, 'callerCandidates');

    peer.on('signal', async (data) => {
        if (data.type === 'offer') {
            const newCallData: Omit<VideoCall, 'id'> = {
                callerId: user.uid,
                calleeId: calleeId,
                status: 'offering',
                offer: data,
                createdAt: serverTimestamp() as any,
            };
            await setDoc(callDocRef, newCallData);
            setActiveCall({ id: callDocRef.id, ...newCallData } as VideoCall);
            setCallStatus('offering');

            ringTimeoutRef.current = setTimeout(async () => {
                await updateDoc(callDocRef, { status: 'missed' });
                setMissedCallInfo({ calleeId, type: 'video' });
                cleanupCall();
            }, 60000);
        } else if (data.candidate) {
            await addDoc(callerCandidatesCol, data);
        }
    });

    peer.on('connect', () => {
         setCallStatus('answered');
    });
    
    peer.on('track', (track, stream) => {
        setRemoteStream(stream);
    });

    const unsubscribe = onSnapshot(callDocRef, (docSnap) => {
         const updatedCall = docSnap.data() as VideoCall;
         const peer = peerRef.current as any;
         if (updatedCall?.answer && peer && !peer.destroyed && peer._pc.signalingState !== 'stable') {
             peer.signal(updatedCall.answer);
         }
         if (updatedCall?.status && updatedCall.status !== callStatus) {
             if (ringTimeoutRef.current && (updatedCall.status === 'answered' || updatedCall.status === 'declined' || updatedCall.status === 'ended')) {
                clearTimeout(ringTimeoutRef.current);
                ringTimeoutRef.current = null;
            }
            if (updatedCall.status === 'answered') {
                setActiveCall(prev => prev ? { ...prev, status: 'answered' } : null);
            }
            setCallStatus(updatedCall.status);
         }
         if (updatedCall?.status === 'ended' || updatedCall?.status === 'declined' || updatedCall?.status === 'missed') {
             toast({ title: `Video Call ${updatedCall.status}` });
             cleanupCall();
             unsubscribe();
         }
    });
    
    const answerCandidatesCol = collection(callDocRef, 'answerCandidates');
    answerCandidatesUnsubscribeRef.current = onSnapshot(answerCandidatesCol, (snapshot) => {
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
        if ((err as any).code === 'ERR_CONNECTION_FAILURE' || err.message.includes('reason=Close called')) {
            console.log("Peer connection gracefully closed or failed, cleaning up.");
            cleanupCall();
            return;
        }
        console.error("Peer error:", err);
        cleanupCall();
     });
  }, [firestore, user, toast, cleanupCall, callStatus, setMissedCallInfo]);

  const hangUp = useCallback(async () => {
    if (!firestore || !activeCall) return;
    
    const callRef = doc(firestore, 'videoCalls', activeCall.id);
    try {
      await updateDoc(callRef, { status: 'ended' });
    } catch (e) {
      console.error("Failed to update video call status to ended:", e);
    }
    cleanupCall();
  }, [firestore, activeCall, cleanupCall]);


  // Listen for incoming calls
  useEffect(() => {
    if (!firestore || !user) return;
    const q = query(
        collection(firestore, 'videoCalls'),
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
        const incomingCallData = { id: callDoc.id, ...callDoc.data() } as VideoCall;

        if (activeCall && activeCall.id === incomingCallData.id) return;
        
        if (activeCall && activeCall.id !== incomingCallData.id) {
            const newCallRef = doc(firestore, 'videoCalls', incomingCallData.id);
            await updateDoc(newCallRef, { status: 'declined' }); 
            return;
        }
        
        if (incomingCallData.status === 'offering') {
            try {
                const callRef = doc(firestore, 'videoCalls', incomingCallData.id);
                await updateDoc(callRef, { status: 'ringing' });
                setActiveCall({ ...incomingCallData, status: 'ringing' });
                setCallStatus('ringing');
            } catch (err) {
                 console.error("Could not get media for incoming video call:", err);
                 const callRef = doc(firestore, 'videoCalls', incomingCallData.id);
                 await updateDoc(callRef, { status: 'declined' });
            }
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

  const toggleVideo = () => {
    if (localStream) {
        localStream.getVideoTracks().forEach(track => {
            track.enabled = !track.enabled;
        });
        setIsVideoEnabled(prev => !prev);
    }
  };

  useEffect(() => {
    if (callStatus === 'answered') {
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          setCallDuration(prev => prev + 1);
        }, 1000);
      }
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setCallDuration(0);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [callStatus]);


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
    startVideoCall: startCall,
    answerVideoCall: answerCall,
    declineVideoCall: declineCall,
    hangUpVideoCall: hangUp,
    toggleVideoMute: toggleMute,
    toggleVideo: toggleVideo,
    activeVideoCall: activeCall,
    videoCallStatus: callStatus,
    localVideoStream: localStream,
    remoteVideoStream: remoteStream,
    isVideoMuted: isMuted,
    isVideoEnabled,
    videoCallDuration: callDuration,
  };
}
