'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { Mic, MicOff, PhoneOff, Video, VideoOff, Loader2 } from "lucide-react";
import { getAvatar, formatUserId } from "@/lib/utils";
import type { User } from "@/lib/types";
import type { WithId } from "@/firebase";
import { type VideoCallStatus } from "@/lib/types";
import { AnimatePresence, motion } from 'framer-motion';

interface VideoCallViewProps {
  remoteUser: WithId<User> | null;
  status: VideoCallStatus | null;
  onHangUp: () => void;
  isMuted: boolean;
  toggleMute: () => void;
  isVideoEnabled: boolean;
  toggleVideo: () => void;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

function formatCallDuration(seconds: number) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export function VideoCallView({ 
    remoteUser, 
    status, 
    onHangUp, 
    isMuted, 
    toggleMute, 
    isVideoEnabled, 
    toggleVideo,
    localStream,
    remoteStream 
}: VideoCallViewProps) {
  const [duration, setDuration] = useState(0);
  
  const localVideoRef = useCallback((node: HTMLVideoElement | null) => {
    if (node && localStream) {
      node.srcObject = localStream;
    }
  }, [localStream]);

  const remoteVideoRef = useCallback((node: HTMLVideoElement | null) => {
    if (node && remoteStream) {
      node.srcObject = remoteStream;
    }
  }, [remoteStream]);


  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (status === 'answered') {
      timer = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => clearInterval(timer);
  }, [status]);
  
  if (!remoteUser) return null;

  const avatar = getAvatar(remoteUser);
  const isAvatarUrl = avatar.startsWith('http');
  
  const getStatusText = () => {
    if (status === 'answered' && !remoteStream) {
        return 'Connecting...';
    }
    switch(status) {
        case 'offering': return 'Calling...';
        case 'ringing': return 'Ringing...';
        case 'answered': return formatCallDuration(duration);
        case 'ended':
        case 'declined':
        case 'missed':
             return 'Call Ended';
        default: return 'Connecting...';
    }
  }
  
  const showActiveCallControls = status === 'answered' && !!remoteStream;

  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
        {/* Remote Video */}
        <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover absolute top-0 left-0" />
        
        {/* Remote user info overlay when their video is off */}
        <AnimatePresence>
            {(!remoteStream || remoteStream.getVideoTracks().every(t => !t.enabled)) && (
                 <motion.div 
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="absolute inset-0 flex flex-col items-center justify-center bg-background/50"
                >
                    <Avatar className="h-32 w-32 border-4 border-primary/50">
                        <AvatarImage src={isAvatarUrl ? avatar : undefined} alt={remoteUser.name} />
                        <AvatarFallback className="text-5xl">{!isAvatarUrl ? avatar : ''}</AvatarFallback>
                    </Avatar>
                     <div className="mt-4 text-center">
                        <h1 className="text-3xl font-bold font-headline text-white drop-shadow-md">{formatUserId(remoteUser.id)}</h1>
                        <p className="text-lg text-white/80 drop-shadow-md flex items-center justify-center gap-2">
                           {status === 'answered' && !remoteStream && <Loader2 className="h-5 w-5 animate-spin" />}
                           <span>{getStatusText()}</span>
                        </p>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        {/* Local Video */}
        <video ref={localVideoRef} autoPlay playsInline muted className="absolute top-6 right-6 h-48 w-36 rounded-lg object-cover border-2 border-white shadow-2xl transition-opacity duration-300" style={{ opacity: isVideoEnabled ? 1 : 0 }} />

        {/* Controls */}
       <div className="absolute bottom-8 flex items-center justify-center gap-6 w-full">
            {!showActiveCallControls ? (
                <Button onClick={onHangUp} variant="destructive" size="icon" className="h-16 w-16 rounded-full">
                    <PhoneOff className="h-7 w-7" />
                </Button>
            ) : (
                <>
                    <Button onClick={toggleMute} variant="secondary" size="icon" className="h-14 w-14 rounded-full bg-white/20 text-white backdrop-blur-md">
                        {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                    </Button>
                    <Button onClick={onHangUp} variant="destructive" size="icon" className="h-16 w-16 rounded-full">
                        <PhoneOff className="h-7 w-7" />
                    </Button>
                    <Button onClick={toggleVideo} variant="secondary" size="icon" className="h-14 w-14 rounded-full bg-white/20 text-white backdrop-blur-md">
                        {isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
                    </Button>
                </>
            )}
      </div>
    </div>
  );
}
