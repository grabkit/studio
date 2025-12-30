
'use client';

import React from 'react';
import { Button } from './ui/button';
import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react';
import { Avatar, AvatarFallback } from './ui/avatar';
import { cn, getInitials } from '@/lib/utils';
import type { CallStatus } from '@/lib/types';
import { useFirebase } from '@/firebase';

const formatUserId = (uid: string | undefined) => {
    if (!uid) return "blur??????";
    return `blur${uid.substring(uid.length - 6)}`;
};


interface CallViewProps {
    status: CallStatus | null;
    calleeId?: string | null;
    callerId?: string | null;
    isMuted: boolean;
    onToggleMute: () => void;
    onAccept: () => void;
    onDecline: () => void;
    onHangUp: () => void;
}

export function CallView({
    status,
    calleeId,
    callerId,
    isMuted,
    onToggleMute,
    onAccept,
    onDecline,
    onHangUp,
}: CallViewProps) {
    const { user } = useFirebase();
    
    const isAnswered = status === 'answered';
    const isRinging = status === 'ringing' && user?.uid === calleeId;
    const isOffering = status === 'offering' && user?.uid === callerId;
    const otherPartyId = user?.uid === callerId ? calleeId : callerId;


    const getStatusText = () => {
        switch (status) {
            case 'offering':
                return `Calling ${formatUserId(calleeId)}...`;
            case 'ringing':
                 return `${formatUserId(callerId)} is calling...`;
            case 'answered':
                return 'Connected';
            default:
                return '...';
        }
    };
    
    return (
        <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-between p-8">
            <div className="text-center pt-20">
                <Avatar className="h-32 w-32 mx-auto mb-6">
                    <AvatarFallback className="text-5xl">{getInitials(formatUserId(otherPartyId))}</AvatarFallback>
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
