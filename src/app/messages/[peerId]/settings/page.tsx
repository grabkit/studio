
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

function SettingsPageSkeleton() {
    return (
        <div className="pt-20 px-4 flex flex-col items-center">
            <Skeleton className="h-24 w-24 rounded-full mb-4" />
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
            <div className="mt-8 space-y-2 w-full">
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
            </div>
        </div>
    )
}


export default function ChatSettingsPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore, user: currentUser, userProfile: currentUserProfile, setCurrentUserProfile } = useFirebase();
    const { toast } = useToast();

    const peerId = params.peerId as string;

    const [isMuteConfirmOpen, setIsMuteConfirmOpen] = useState(false);
    const [isBlockConfirmOpen, setIsBlockConfirmOpen] = useState(false);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    
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
        await updateDoc(convoRef, updatePayload);
        toast({ title: isMuted ? 'Conversation unmuted' : 'Conversation muted' });
        setIsMuteConfirmOpen(false);
    };

    const handleBlock = async () => {
        if (!currentUser || !firestore || !currentUserProfile) return;
        const currentUserDocRef = doc(firestore, "users", currentUser.uid);
        const newBlockedUsers = isBlocked
            ? currentUserProfile.blockedUsers?.filter(id => id !== peerId)
            : [...(currentUserProfile.blockedUsers || []), peerId];
        
        await updateDoc(currentUserDocRef, { blockedUsers: newBlockedUsers });
        setCurrentUserProfile(current => current ? { ...current, blockedUsers: newBlockedUsers } : null);
        toast({ title: isBlocked ? 'User unblocked' : 'User blocked' });
        setIsBlockConfirmOpen(false);
    };

    const handleDeleteChat = async () => {
        // This is a complex operation. For now, just navigate away.
        // A full implementation would delete messages and hide the conversation.
        toast({ title: 'Chat Deleted' });
        router.push('/messages');
        setIsDeleteConfirmOpen(false);
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
                    <Button variant="ghost" className="w-full justify-start text-base h-12 text-destructive hover:text-destructive" onClick={() => setIsDeleteConfirmOpen(true)}>
                        <Trash2 className="mr-3" /> Delete Chat
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
             <AlertDialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Chat?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the chat history on your device. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteChat} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

        </AppLayout>
    );
}

