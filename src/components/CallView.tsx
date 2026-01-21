

'use client';

import React, { useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { cn, getAvatar, formatUserId } from '@/lib/utils.tsx';
import type { CallStatus } from '@/lib/types';
import { useFirebase } from '@/firebase';

const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
};


interface CallViewProps {
    status: CallStatus | null;
    calleeId?: string | null;
    callerId?: string | null;
    isMuted: boolean;
    localStream: MediaStream | null;
    remoteStream: MediaStream | null;
    onToggleMute: () => void;
    onAccept: () => void;
    onDecline: () => void;
    onHangUp: () => void;
    callDuration: number;
}

export function CallView({
    status,
    calleeId,
    callerId,
    isMuted,
    localStream,
    remoteStream,
    onToggleMute,
    onAccept,
    onDecline,
    onHangUp,
    callDuration
}: CallViewProps) {
    const { user } = useFirebase();
    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    const localAudioRef = useRef<HTMLAudioElement>(null);

    const isAnswered = status === 'answered';
    const isRinging = status === 'ringing' && user?.uid === calleeId;
    
    const otherPartyId = user?.uid === callerId ? calleeId : callerId;
    
    const avatar = getAvatar({id: otherPartyId});
    const isAvatarUrl = avatar.startsWith('http');


    useEffect(() => {
        if (remoteAudioRef.current && remoteStream) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.play().catch(e => {
                // Ignore AbortError which is common when playback is interrupted
                if (e.name !== 'AbortError') {
                    console.error("Error playing remote audio:", e);
                }
            });
        }
    }, [remoteStream]);
    
    useEffect(() => {
        if (localAudioRef.current && localStream) {
            localAudioRef.current.srcObject = localStream;
            localAudioRef.current.play().catch(e => {
                 // Ignore AbortError which is common when playback is interrupted
                if (e.name !== 'AbortError') {
                    console.error("Error playing local audio:", e);
                }
            });
        }
    }, [localStream]);


    const getStatusText = () => {
        if (isAnswered) {
            return <>{formatDuration(callDuration)}</>;
        }
        switch (status) {
            case 'offering':
                 return <>Calling {formatUserId(otherPartyId)}...</>;
            case 'ringing':
                 return <>{formatUserId(otherPartyId)} is calling...</>;
            case 'answered':
                return <>Connected</>;
            default:
                return <>...</>;
        }
    };
    
    return (
        <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-between p-8">
            <audio ref={remoteAudioRef} autoPlay />
            <audio ref={localAudioRef} autoPlay muted />

            <div className="text-center pt-20">
                <Avatar className="h-32 w-32 mx-auto mb-6">
                    <AvatarImage src={isAvatarUrl ? avatar : undefined} alt={String(formatUserId(otherPartyId))} />
                    <AvatarFallback className="text-5xl">{!isAvatarUrl ? avatar : ''}</AvatarFallback>
                </Avatar>
                <h1 className="text-3xl font-bold">{formatUserId(otherPartyId)}</h1>
                <p className="text-muted-foreground mt-2">{getStatusText()}</p>
            </div>

             <div className="flex flex-col items-center space-y-6 w-full">
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
                                <div className="flex flex-col items-center">
                                    <Button
                                        size="icon"
                                        className="rounded-full w-16 h-16 bg-green-500 hover:bg-green-600"
                                        onClick={onAccept}
                                    >
                                        <Phone />
                                    </Button>
                                    <span className="mt-2 text-sm">Accept</span>
                                </div>
                                <div className="flex flex-col items-center">
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
                             <div className="flex flex-col items-center">
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
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
