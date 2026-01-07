
"use client";

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { doc, updateDoc, arrayRemove, arrayUnion } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bell, BellOff, ShieldAlert, Trash2 } from 'lucide-react';
import { getAvatar, formatUserId } from '@/lib/utils';
import type { Conversation, User } from '@/lib/types';
import { WithId } from '@/firebase/firestore/use-collection';
import { useToast } from '@/hooks/use-toast';
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
import { Skeleton } from '@/components/ui/skeleton';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

function SettingsPageSkeleton() {
    return (
        <div className="pt-20 px-4 flex flex-col items-center">
            <Skeleton className="h-24 w-24 rounded-full mb-4" />
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
            <div className="mt-8 space-y-2 w-full">
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
            </div>
        </div>
    )
}


export default function ChatSettingsPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore, user: currentUser, userProfile: currentUserProfile, setUserProfile: setCurrentUserProfile } = useFirebase();
    const { toast } = useToast();

    const peerId = params.peerId as string;

    const [isMuteConfirmOpen, setIsMuteConfirmOpen] = useState(false);
    const [isBlockConfirmOpen, setIsBlockConfirmOpen] = useState(false);
    
    const conversationId = useMemo(() => {
        if (!currentUser || !peerId) return null;
        return [currentUser.uid, peerId].sort().join('_');
    }, [currentUser, peerId]);
    
    const conversationRef = useMemoFirebase(() => {
        if (!firestore || !conversationId) return null;
        return doc(firestore, 'conversations', conversationId);
    }, [firestore, conversationId]);

    const peerUserRef = useMemoFirebase(() => {
        if (!firestore || !peerId) return null;
        return doc(firestore, 'users', peerId);
    }, [firestore, peerId]);

    const { data: conversation, isLoading: isConversationLoading } = useDoc<Conversation>(conversationRef);
    const { data: peerUser, isLoading: isPeerUserLoading } = useDoc<User>(peerUserRef);

    const isMuted = useMemo(() => conversation?.mutedBy?.includes(currentUser?.uid || ''), [conversation, currentUser]);
     const isBlocked = useMemo(() => currentUserProfile?.blockedUsers?.includes(peerId) ?? false, [currentUserProfile, peerId]);

    const handleToggleMute = async () => {
        if (!firestore || !currentUser || !conversation) return;
        const convoRef = doc(firestore, 'conversations', conversation.id);
        const updatePayload = {
            mutedBy: isMuted ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
        };

        try {
            await updateDoc(convoRef, updatePayload);
            toast({ title: isMuted ? 'Conversation unmuted' : 'Conversation muted' });
        } catch(error) {
             const permissionError = new FirestorePermissionError({
                path: convoRef.path,
                operation: 'update',
                requestResourceData: updatePayload
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: 'Error', description: `Could not ${isMuted ? 'unmute' : 'mute'} conversation.`})
        } finally {
             setIsMuteConfirmOpen(false);
        }
    };

    const handleBlock = async () => {
        if (!currentUser || !firestore || !currentUserProfile) return;
        const currentUserDocRef = doc(firestore, "users", currentUser.uid);
        
        const originalBlockedUsers = currentUserProfile.blockedUsers || [];
        const newBlockedUsers = isBlocked
            ? originalBlockedUsers.filter(id => id !== peerId)
            : [...originalBlockedUsers, peerId];
        
        // Optimistic UI Update
        setCurrentUserProfile(current => current ? { ...current, blockedUsers: newBlockedUsers } : null);

        try {
            await updateDoc(currentUserDocRef, { blockedUsers: newBlockedUsers });
            toast({ title: isBlocked ? 'User unblocked' : 'User blocked' });
        } catch (error) {
            // Revert on failure
            setCurrentUserProfile(current => current ? { ...current, blockedUsers: originalBlockedUsers } : null);
            const permissionError = new FirestorePermissionError({
                path: currentUserDocRef.path,
                operation: 'update',
                requestResourceData: { blockedUsers: newBlockedUsers },
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: 'Error', description: `Could not ${isBlocked ? 'unblock' : 'block'} user.`})
        } finally {
            setIsBlockConfirmOpen(false);
        }
    };


    if (isPeerUserLoading || isConversationLoading) {
        return (
            <AppLayout showTopBar={false}>
                <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft />
                    </Button>
                    <h2 className="text-lg font-bold mx-auto -translate-x-4">Conversation Info</h2>
                </div>
                 <SettingsPageSkeleton />
            </AppLayout>
        )
    }

    if (!peerUser) {
        return <AppLayout showTopBar={false}><p>User not found.</p></AppLayout>
    }

    return (
        <AppLayout showTopBar={false}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">Conversation Info</h2>
            </div>
            <div className="pt-20 px-4 flex flex-col h-full">
                <div className="flex flex-col items-center text-center">
                    <Avatar className="h-24 w-24 mb-4">
                        <AvatarFallback className="text-4xl">{getAvatar(peerUser)}</AvatarFallback>
                    </Avatar>
                    <h2 className="text-2xl font-bold font-headline">{formatUserId(peerUser.id)}</h2>
                    <p className="text-muted-foreground">{peerUser.bio || "No bio yet."}</p>
                </div>

                <div className="mt-8 space-y-2">
                    <Button variant="ghost" className="w-full justify-start text-base h-12" onClick={() => setIsMuteConfirmOpen(true)}>
                        {isMuted ? <Bell className="mr-3"/> : <BellOff className="mr-3" />}
                        {isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
                    </Button>
                    <Button variant="ghost" className="w-full justify-start text-base h-12" onClick={() => setIsBlockConfirmOpen(true)}>
                        <ShieldAlert className="mr-3" />
                         {isBlocked ? 'Unblock User' : 'Block User'}
                    </Button>
                </div>
            </div>

             {/* Confirmation Dialogs */}
            <AlertDialog open={isMuteConfirmOpen} onOpenChange={setIsMuteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{isMuted ? 'Unmute' : 'Mute'} Conversation?</AlertDialogTitle>
                        <AlertDialogDescription>
                            You will {isMuted ? 'start receiving' : 'no longer receive'} notifications for messages from this chat.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleToggleMute}>Confirm</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <AlertDialog open={isBlockConfirmOpen} onOpenChange={setIsBlockConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{isBlocked ? 'Unblock' : 'Block'} {formatUserId(peerUser.id)}?</AlertDialogTitle>
                        <AlertDialogDescription>
                           {isBlocked 
                             ? "You will now be able to see this user's content and they will be able to message and call you."
                             : "Blocked users will not be able to call you or send you messages. They will not be notified that you've blocked them."
                           }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBlock}>{isBlocked ? 'Unblock' : 'Block'}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </AppLayout>
    );
}
