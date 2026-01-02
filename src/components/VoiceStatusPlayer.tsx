
'use client';

import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { User } from '@/lib/types';
import { getInitials } from '@/lib/utils';
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

export function VoiceStatusPlayer({ user: voiceUser, isOpen, onOpenChange, onDelete, isVoicePlayerPlaying }: { user: WithId<User>, isOpen: boolean, onOpenChange: (open: boolean) => void, onDelete: () => void, isVoicePlayerPlaying: boolean }) {
    const { user: currentUser } = useFirebase();
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = React.useState(false);

    const isOwnStatus = currentUser?.uid === voiceUser.id;

    const handleDeleteClick = () => {
        setIsDeleteAlertOpen(true);
    }
    
    const confirmDelete = () => {
        onDelete();
        setIsDeleteAlertOpen(false);
    }


    return (
        <>
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="rounded-t-2xl h-auto flex flex-col items-center justify-center gap-6 pb-10">
                 <SheetHeader className="sr-only">
                    <SheetTitle>Voice Status by {formatUserId(voiceUser.id)}</SheetTitle>
                </SheetHeader>
                
                <div className="relative">
                    <Avatar className="h-28 w-28">
                        <AvatarFallback className="text-5xl">{getInitials(voiceUser.name)}</AvatarFallback>
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
                
                {isOwnStatus && (
                    <Button variant="destructive" onClick={handleDeleteClick} className="mt-4">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Status
                    </Button>
                )}
            </SheetContent>
        </Sheet>
         <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will permanently delete your voice status. This action cannot be undone.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={confirmDelete} className={cn(buttonVariants({variant: 'destructive'}))}>
                    Delete
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
        </>
    )
}
