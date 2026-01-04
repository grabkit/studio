
'use client';

import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { User } from '@/lib/types';
import { getAvatar } from '@/lib/utils';
import { WithId, useFirebase } from '@/firebase';
import { Button } from './ui/button';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';
import { buttonVariants } from './ui/button';


const formatUserId = (uid: string | undefined) => {
    if (!uid) return "blur??????";
    return `blur${uid.substring(uid.length - 6)}`;
};

export function VoiceStatusPlayer({ user: voiceUser, isOpen, onOpenChange, onDelete, isVoicePlayerPlaying }: { user: WithId<User>, isOpen: boolean, onOpenChange: (open: boolean) => void, onDelete: () => Promise<void>, isVoicePlayerPlaying: boolean }) {
    const { user: currentUser } = useFirebase();

    const isOwnStatus = currentUser?.uid === voiceUser.id;

    const handleDeleteClick = async () => {
        await onDelete();
        onOpenChange(false); // Close the sheet after deletion
    }

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="rounded-t-2xl h-auto flex flex-col items-center justify-center gap-6 pb-10">
                 {isOwnStatus && (
                    <Button variant="ghost" size="icon" onClick={handleDeleteClick} className="absolute top-4 left-4 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-5 w-5" />
                    </Button>
                )}
                
                 <SheetHeader className="sr-only">
                    <SheetTitle>Voice Status by {formatUserId(voiceUser.id)}</SheetTitle>
                </SheetHeader>
                
                <div className="relative">
                    <Avatar className="h-28 w-28">
                        <AvatarFallback className="text-5xl">{getAvatar(voiceUser.id)}</AvatarFallback>
                    </Avatar>
                </div>

                <div className="text-center">
                    <p className="text-2xl font-bold font-headline">{formatUserId(voiceUser.id)}</p>
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
