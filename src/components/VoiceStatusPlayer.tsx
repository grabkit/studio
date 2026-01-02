
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { User } from '@/lib/types';
import { getInitials } from '@/lib/utils';
import { WithId } from '@/firebase';

const formatUserId = (uid: string | undefined) => {
    if (!uid) return "blur??????";
    return `blur${uid.substring(uid.length - 6)}`;
};

export function VoiceStatusPlayer({ user, isOpen, onOpenChange }: { user: WithId<User>, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        if (isOpen && user.voiceStatusUrl && audioRef.current) {
            audioRef.current.src = user.voiceStatusUrl;
            audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
        } else if (!isOpen && audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
        }
    }, [isOpen, user.voiceStatusUrl]);

    const handleEnded = () => {
        setIsPlaying(false);
        onOpenChange(false);
    };

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="rounded-t-2xl h-[40dvh] flex flex-col items-center justify-center gap-6">
                 <SheetHeader className="sr-only">
                    <SheetTitle>Voice Status by {formatUserId(user.id)}</SheetTitle>
                </SheetHeader>
                 {user.voiceStatusUrl && (
                    <audio 
                        ref={audioRef}
                        onEnded={handleEnded}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                    />
                )}
                
                <div className="relative">
                    <Avatar className="h-28 w-28">
                        <AvatarFallback className="text-5xl">{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                </div>

                <div className="text-center">
                    <p className="text-2xl font-bold font-headline">{formatUserId(user.id)}</p>
                    <p className="text-muted-foreground">Playing voice status...</p>
                </div>

                <div className="flex items-center justify-center h-10 gap-1.5">
                    <div className="audio-wave-bar" />
                    <div className="audio-wave-bar" />
                    <div className="audio-wave-bar" />
                </div>

            </SheetContent>
        </Sheet>
    )
}
