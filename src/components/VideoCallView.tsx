'use client';

import React, { useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { cn, getInitials } from '@/lib/utils';
import type { CallStatus } from '@/lib/types';
import { useFirebase } from '@/firebase';

const formatUserId = (uid: string | undefined) => {
    if (!uid) return "blur??????";
    return `blur${uid.substring(uid.length - 6)}`;
};

const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};


interface VideoCallViewProps {
    status: CallStatus | null;
    calleeId?: string | null;
    callerId?: string | null;
    isMuted: boolean;
    isVideoEnabled: boolean;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    onToggleMute: () => void;
    onToggleVideo: () => void;
    onAccept: () => void;
    onDecline: () => void;
    onHangUp: () => void;
    callDuration: number;
}

export function VideoCallView({
    status,
    calleeId,
    callerId,
    isMuted,
    isVideoEnabled,
    localStream,
    remoteStream,
    onToggleMute,
    onToggleVideo,
    onAccept,
    onDecline,
    onHangUp,
    callDuration
}: VideoCallViewProps) {
    const { user } = useFirebase();
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);

    const isAnswered = status === 'answered';
    const isRinging = status === 'ringing' && user?.uid === calleeId;
    
    const otherPartyId = user?.uid === callerId ? calleeId : callerId;


    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.play().catch(e => {
                if (e.name !== 'AbortError') {
                    console.error("Error playing remote video:", e);
                }
            });
        }
    }, [remoteStream]);
    
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
            localVideoRef.current.play().catch(e => {
                if (e.name !== 'AbortError') {
                    console.error("Error playing local video:", e);
                }
            });
        }
    }, [localStream]);


    const getStatusText = () => {
        if (isAnswered) {
            return formatDuration(callDuration);
        }
        switch (status) {
            case 'offering':
                 return `Calling ${formatUserId(otherPartyId)}...`;
            case 'ringing':
                 return `${formatUserId(otherPartyId)} is calling...`;
            case 'answered':
                return 'Connected';
            default:
                return '...';
        }
    };
    
    return (
        <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-between p-8">
            {/* Remote Video */}
            <video ref={remoteVideoRef} className="absolute top-0 left-0 w-full h-full object-cover z-0" />
            <div className="absolute top-0 left-0 w-full h-full bg-black/50 z-10"></div>
            
            {/* Local Video */}
            <video ref={localVideoRef} className="absolute top-4 right-4 w-1/4 max-w-[120px] rounded-lg z-20" muted />

            <div className="text-center pt-20 z-20">
                {!remoteStream && (
                     <Avatar className="h-32 w-32 mx-auto mb-6">
                        <AvatarFallback className="text-5xl">{getInitials(formatUserId(otherPartyId))}</AvatarFallback>
                    </Avatar>
                )}
                <h1 className="text-3xl font-bold text-white">{formatUserId(otherPartyId)}</h1>
                <p className="text-white/80 mt-2">{getStatusText()}</p>
            </div>

             <div className="flex flex-col items-center space-y-6 w-full z-20">
                {isAnswered ? (
                     <div className="flex items-center space-x-6">
                         <Button
                            variant="secondary"
                            size="icon"
                            className="rounded-full w-16 h-16"
                            onClick={onToggleMute}
                        >
                            {isMuted ? <MicOff /> : <Mic />}
                        </Button>
                         <Button
                            variant="secondary"
                            size="icon"
                            className="rounded-full w-16 h-16"
                            onClick={onToggleVideo}
                        >
                            {isVideoEnabled ? <Video /> : <VideoOff />}
                        </Button>
                         <Button
                            variant="destructive"
                            size="icon"
                            className="rounded-full w-16 h-16"
                            onClick={onHangUp}
                        >
                            <PhoneOff />
                        </Button>
                    </div>
                ) : (
                    <div className="flex justify-around w-full max-w-xs">
                        {isRinging ? (
                            <>
                                <div className="flex flex-col items-center text-white">
                                    <Button
                                        size="icon"
                                        className="rounded-full w-16 h-16 bg-green-500 hover:bg-green-600"
                                        onClick={onAccept}
                                    >
                                        <Video />
                                    </Button>
                                    <span className="mt-2 text-sm">Accept</span>
                                </div>
                                <div className="flex flex-col items-center text-white">
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        className="rounded-full w-16 h-16"
                                        onClick={onDecline}
                                    >
                                        <PhoneOff />
                                    </Button>
                                    <span className="mt-2 text-sm">Decline</span>
                                </div>
                            </>
                        ) : (
                             <div className="flex flex-col items-center text-white">
                                <Button
                                    variant="destructive"
                                    size="icon"
                                    className="rounded-full w-16 h-16"
                                    onClick={onDecline}
                                >
                                    <PhoneOff />
                                </Button>
                                <span className="mt-2 text-sm">Cancel</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
