
'use client';

import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { User } from '@/lib/types';
import { getInitials } from '@/lib/utils';
import { WithId, useFirebase } from '@/firebase';

const formatUserId = (uid: string | undefined) => {
    if (!uid) return "blur??????";
    return `blur${uid.substring(uid.length - 6)}`;
};

export function VoiceStatusPlayer({ user, isOpen, onOpenChange }: { user: WithId<User>, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
    const { isVoicePlayerPlaying } = useFirebase();

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="rounded-t-2xl h-[40dvh] flex flex-col items-center justify-center gap-6">
                 <SheetHeader className="sr-only">
                    <SheetTitle>Voice Status by {formatUserId(user.id)}</SheetTitle>
                </SheetHeader>
                
                <div className="relative">
                    <Avatar className="h-28 w-28">
                        <AvatarFallback className="text-5xl">{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                </div>

                <div className="text-center">
                    <p className="text-2xl font-bold font-headline">{formatUserId(user.id)}</p>
                    <p className="text-muted-foreground">{ isVoicePlayerPlaying ? 'Playing voice status...' : 'Voice status'}</p>
                </div>

                {isVoicePlayerPlaying && (
                    <div className="flex items-center justify-center h-10 gap-1.5">
                        <div className="audio-wave-bar" />
                        <div className="audio-wave-bar" />
                        <div className="audio-wave-bar" />
                    </div>
                )}
            </SheetContent>
        </Sheet>
    )
}
