

"use client";

import { useMemo, useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { useFirebase, useMemoFirebase, useCollection } from '@/firebase';
import { doc, updateDoc, getDocs, writeBatch, collection, query, where, getDoc, documentId } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BellOff, ShieldAlert, MicOff, VideoOff, ChevronRight, PhoneCall, User as UserIcon, Bell, Flag, MessageCircleX, Link as LinkIcon, BarChart3, Palette, Image as ImageIcon } from 'lucide-react';
import { getAvatar, formatUserId } from '@/lib/utils';
import type { Conversation, User, Message, Post, Bookmark } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import Link from 'next/link';
import { ReportDialog } from '@/components/ReportDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WithId } from '@/firebase/firestore/use-collection';
import { PostItem as HomePostItem, PostSkeleton } from "@/app/home/page";
import { LinkPreviewCard } from '@/components/LinkPreviewCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { QrCodeDialog } from '@/components/QrCodeDialog';
import { Calendar, Badge } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

function SettingsPageSkeleton() {
    return (
        <div className="pt-20 px-4 flex flex-col items-center">
            <Skeleton className="h-24 w-24 rounded-full mb-4" />
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
            <div className="mt-8 w-full">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        </div>
    )
}

function SharedContent() {
    const { firestore, user: currentUser } = useFirebase();
    const params = useParams();
    const peerId = params.peerId as string;
    const [posts, setPosts] = useState<WithId<Post>[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const conversationId = useMemo(() => {
        if (!currentUser || !peerId) return null;
        return [currentUser.uid, peerId].sort().join('_');
    }, [currentUser, peerId]);

    const messagesQuery = useMemoFirebase(() => {
        if (!firestore || !conversationId) return null;
        return query(collection(firestore, 'conversations', conversationId, 'messages'));
    }, [firestore, conversationId]);

    const { data: messages, isLoading: messagesLoading } = useCollection<Message>(messagesQuery);
    
    useEffect(() => {
        const fetchSharedPosts = async () => {
            if (!firestore || !messages) {
                setIsLoading(messagesLoading);
                return;
            }

            const postIds = messages.map(m => m.postId).filter((id): id is string => !!id);
            
            if (postIds.length > 0) {
                const postsCollection = collection(firestore, 'posts');
                // Firestore 'in' query is limited to 30 items. For a real app with more items, batching would be better.
                const postsQuery = query(postsCollection, where(documentId(), 'in', postIds.slice(0, 30)));
                const snapshot = await getDocs(postsQuery);
                const fetchedPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WithId<Post>));
                setPosts(fetchedPosts);
            } else {
                setPosts([]);
            }
            setIsLoading(false);
        };

        fetchSharedPosts();

    }, [firestore, messages, messagesLoading]);

    const links = useMemo(() => {
        return messages?.filter(m => !!m.linkMetadata) || [];
    }, [messages]);

    const polls = useMemo(() => {
        return posts.filter(post => post.type === 'poll');
    }, [posts]);
    
     const bookmarksQuery = useMemoFirebase(() => {
        if (!firestore || !currentUser) return null;
        return collection(firestore, 'users', currentUser.uid, 'bookmarks');
    }, [firestore, currentUser]);

    const { data: bookmarks } = useCollection<Bookmark>(bookmarksQuery);

    return (
        <Tabs defaultValue="links">
            <div className="sticky top-0 bg-background z-10 border-b">
                <TabsList variant="underline" className="grid grid-cols-2">
                    <TabsTrigger value="links" variant="underline"><LinkIcon /></TabsTrigger>
                    <TabsTrigger value="polls" variant="underline"><BarChart3 /></TabsTrigger>
                </TabsList>
            </div>
            <TabsContent value="links" className="mt-4 space-y-3 px-4">
                {isLoading && (
                    <>
                        <Skeleton className="h-28 w-full rounded-lg" />
                        <Skeleton className="h-28 w-full rounded-lg" />
                    </>
                )}
                {!isLoading && links.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">No links shared in this conversation yet.</p>
                )}
                {!isLoading && links.map(message => (
                   message.linkMetadata ? <LinkPreviewCard key={message.id} metadata={message.linkMetadata} /> : null
                ))}
            </TabsContent>
            <TabsContent value="polls" className="mt-0">
                {isLoading && (
                    <>
                        <PostSkeleton />
                        <PostSkeleton />
                    </>
                )}
                {!isLoading && polls.length === 0 && (
                     <p className="text-center text-muted-foreground py-8">No polls shared in this conversation yet.</p>
                )}
                 {!isLoading && polls.map(post => (
                    <HomePostItem 
                        key={post.id} 
                        post={post} 
                        bookmarks={bookmarks || []}
                    />
                ))}
            </TabsContent>
        </Tabs>
    );
}

function AboutProfileSheet({ user, isOpen, onOpenChange }: { user: WithId<User>, isOpen: boolean, onOpenChange: (open: boolean) => void }) {

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="rounded-t-[10px]">
                <SheetHeader className="text-left mb-4">
                    <SheetTitle>About this account</SheetTitle>
                </SheetHeader>
                <div className="space-y-4">
                    <div className="flex items-center">
                        <UserIcon className="h-5 w-5 mr-3 text-muted-foreground" />
                        <div>
                            <p className="text-sm text-muted-foreground">User ID</p>
                            <p className="font-mono text-sm">{formatUserId(user.id)}</p>
                        </div>
                    </div>
                    {user.createdAt && (
                        <div className="flex items-center">
                            <Calendar className="h-5 w-5 mr-3 text-muted-foreground" />
                            <div>
                                <p className="text-sm text-muted-foreground">Joined</p>
                                <p className="font-semibold">{format(user.createdAt.toDate(), "MMMM yyyy")}</p>
                            </div>
                        </div>
                    )}
                    <div className="flex items-center">
                        <Badge className="h-5 w-5 mr-3 text-muted-foreground" />
                        <div>
                            <p className="text-sm text-muted-foreground">Account Status</p>
                            <p className="font-semibold capitalize">{user.status || 'Active'}</p>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}

export default function ChatSettingsPage() {
    const params = useParams();
    const router = useRouter();
    const { firestore, user: currentUser, userProfile: currentUserProfile, setUserProfile: setCurrentUserProfile } = useFirebase();
    const { toast } = useToast();
    const pageRef = useRef<HTMLDivElement>(null);

    const peerId = params.peerId as string;

    const [isBlockSheetOpen, setIsBlockSheetOpen] = useState(false);
    const [isClearSheetOpen, setIsClearSheetOpen] = useState(false);
    const [isCallControlsSheetOpen, setIsCallControlsSheetOpen] = useState(false);
    const [isAboutSheetOpen, setIsAboutSheetOpen] = useState(false);
    const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
    
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

    const { data: conversation, isLoading: isConversationLoading, setData: setConversation } = useDoc<Conversation>(conversationRef);
    const { data: peerUser, isLoading: isPeerUserLoading } = useDoc<User>(peerUserRef);

    const isMuted = useMemo(() => conversation?.mutedBy?.includes(currentUser?.uid || ''), [conversation, currentUser]);
    const isBlocked = useMemo(() => currentUserProfile?.blockedUsers?.includes(peerId) ?? false, [currentUserProfile, peerId]);
    
    const isVoiceDisabled = useMemo(() => conversation?.voiceCallsDisabledBy?.includes(currentUser?.uid || ''), [conversation, currentUser]);
    const isVideoDisabled = useMemo(() => conversation?.videoCallsDisabledBy?.includes(currentUser?.uid || ''), [conversation, currentUser]);

    const handleBackNavigation = () => {
        if (pageRef.current) {
            pageRef.current.classList.remove('animate-slide-in-right');
            pageRef.current.classList.add('animate-slide-out-right');
            setTimeout(() => {
                router.back();
            }, 300);
        } else {
            router.back();
        }
    };

    const handleToggleMute = async () => {
        if (!firestore || !currentUser || !conversation) return;
        const convoRef = doc(firestore, 'conversations', conversation.id);
        const newMutedBy = isMuted
            ? conversation.mutedBy?.filter(id => id !== currentUser.uid)
            : [...(conversation.mutedBy || []), currentUser.uid];

        setConversation(current => current ? { ...current, mutedBy: newMutedBy } : null);

        try {
            await updateDoc(convoRef, { mutedBy: newMutedBy });
            toast({ title: isMuted ? 'Conversation unmuted' : 'Conversation muted' });
        } catch(error) {
             const permissionError = new FirestorePermissionError({
                path: convoRef.path,
                operation: 'update',
                requestResourceData: { mutedBy: newMutedBy }
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: 'Error', description: `Could not ${isMuted ? 'unmute' : 'mute'} conversation.`});
            setConversation(current => current ? { ...current, mutedBy: conversation.mutedBy } : null);
        }
    };
    
    const handleToggleCall = async (type: 'voice' | 'video') => {
        if (!firestore || !currentUser || !conversation) return;
        const convoRef = doc(firestore, 'conversations', conversation.id);
        
        const field = type === 'voice' ? 'voiceCallsDisabledBy' : 'videoCallsDisabledBy';
        const currentDisabledList = conversation[field] || [];
        const isDisabled = currentDisabledList.includes(currentUser.uid);
        
        const newDisabledList = isDisabled
            ? currentDisabledList.filter(id => id !== currentUser.uid)
            : [...currentDisabledList, currentUser.uid];
        
        setConversation(current => current ? { ...current, [field]: newDisabledList } : null);

        try {
            await updateDoc(convoRef, { [field]: newDisabledList });
            toast({ title: isDisabled ? `${type.charAt(0).toUpperCase() + type.slice(1)} calls enabled` : `${type.charAt(0).toUpperCase() + type.slice(1)} calls disabled` });
        } catch(error) {
             const permissionError = new FirestorePermissionError({
                path: convoRef.path,
                operation: 'update',
                requestResourceData: { [field]: newDisabledList }
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: 'Error', description: `Could not update call settings.`});
             setConversation(current => current ? { ...current, [field]: currentDisabledList } : null);
        }
    };


    const handleBlock = async () => {
        if (!currentUser || !firestore || !currentUserProfile) return;
        const currentUserDocRef = doc(firestore, "users", currentUser.uid);
        
        const originalBlockedUsers = currentUserProfile.blockedUsers || [];
        const newBlockedUsers = isBlocked
            ? originalBlockedUsers.filter(id => id !== peerId)
            : [...originalBlockedUsers, peerId];
        
        setCurrentUserProfile(current => current ? { ...current, blockedUsers: newBlockedUsers } : null);

        try {
            await updateDoc(currentUserDocRef, { blockedUsers: newBlockedUsers });
            toast({ title: isBlocked ? 'User unblocked' : 'User blocked' });
        } catch (error) {
            setCurrentUserProfile(current => current ? { ...current, blockedUsers: originalBlockedUsers } : null);
            const permissionError = new FirestorePermissionError({
                path: currentUserDocRef.path,
                operation: 'update',
                requestResourceData: { blockedUsers: newBlockedUsers },
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: 'Error', description: `Could not ${isBlocked ? 'unblock' : 'block'} user.`})
        } finally {
            setIsBlockSheetOpen(false);
        }
    };

    const handleClearChat = async () => {
        if (!firestore || !conversationId) return;

        const messagesRef = collection(firestore, 'conversations', conversationId, 'messages');
        const conversationDocRef = doc(firestore, 'conversations', conversationId);
        
        try {
            const querySnapshot = await getDocs(messagesRef);
            if (querySnapshot.empty) {
                toast({ title: "Chat is already empty." });
                return;
            }
            const batch = writeBatch(firestore);
            querySnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            // Also clear the last message preview
            batch.update(conversationDocRef, { lastMessage: "" });
            
            await batch.commit();

            toast({ title: "Chat Cleared", description: "All messages have been deleted from this conversation." });

        } catch (error) {
            console.error("Error clearing chat:", error);
            const permissionError = new FirestorePermissionError({
                path: messagesRef.path,
                operation: 'delete',
                requestResourceData: { note: "Batch delete operation on subcollection" },
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: "Error", description: "Could not clear the chat history." });
        } finally {
            setIsClearSheetOpen(false);
        }
    }


    if (isPeerUserLoading || isConversationLoading) {
        return (
            <AppLayout showTopBar={false} showBottomNav={true}>
                 <div className="flex items-center p-2 bg-background/80 backdrop-blur-sm h-14 max-w-2xl mx-auto sm:px-4">
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
        return <AppLayout showTopBar={false} showBottomNav={true}><p>User not found.</p></AppLayout>
    }

    return (
        <AppLayout showTopBar={false} showBottomNav={false}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={handleBackNavigation}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">Conversation Info</h2>
            </div>
            <div ref={pageRef} className="h-full bg-background animate-slide-in-right">
                <ScrollArea className="h-full pt-14">
                    <div className="px-4 pt-6 flex flex-col items-center text-center">
                        <Link href={`/profile/${peerId}`}>
                            <Avatar className="h-24 w-24 mb-4">
                                <AvatarFallback className="text-4xl">{getAvatar(peerUser)}</AvatarFallback>
                            </Avatar>
                            <h2 className="text-2xl font-bold font-headline">{formatUserId(peerUser.id)}</h2>
                            <p className="text-muted-foreground">{peerUser.bio || "No bio yet."}</p>
                        </Link>
                    </div>
                    
                    <div className="mt-8 mx-4">
                        <Button asChild variant="ghost" className="w-full justify-start text-base h-12 px-4 gap-3">
                            <Link href={`/profile/${peerId}`}>
                                <UserIcon className="h-5 w-5" />
                                View Profile
                            </Link>
                        </Button>
                        <div className="flex items-center justify-between hover:bg-secondary rounded-md h-12 px-4 gap-3">
                            <Label htmlFor="mute-notifications" className="flex items-center text-base font-normal cursor-pointer gap-3">
                                <BellOff className="h-5 w-5" />
                                Mute Notifications
                            </Label>
                            <Switch id="mute-notifications" checked={isMuted} onCheckedChange={handleToggleMute} />
                        </div>
                    
                        <Sheet open={isCallControlsSheetOpen} onOpenChange={setIsCallControlsSheetOpen}>
                            <SheetTrigger asChild>
                            <Button variant="ghost" className="w-full justify-between text-base h-12 px-4">
                                    <div className="flex items-center gap-3">
                                        <PhoneCall className="h-5 w-5" />
                                        Call Controls
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="bottom" className="rounded-t-[10px]">
                                <SheetHeader>
                                    <SheetTitle>Call Controls</SheetTitle>
                                </SheetHeader>
                                <div className="mt-4">
                                    <div className="flex items-center justify-between p-3">
                                        <Label htmlFor="disable-voice" className="flex items-center gap-3 text-base font-normal">
                                            <MicOff /> Disable Voice Calls
                                        </Label>
                                        <Switch id="disable-voice" checked={isVoiceDisabled} onCheckedChange={() => handleToggleCall('voice')} />
                                    </div>
                                    <div className="flex items-center justify-between p-3">
                                        <Label htmlFor="disable-video" className="flex items-center gap-3 text-base font-normal">
                                            <VideoOff /> Disable Video Calls
                                        </Label>
                                        <Switch id="disable-video" checked={isVideoDisabled} onCheckedChange={() => handleToggleCall('video')} />
                                    </div>
                                </div>
                            </SheetContent>
                        </Sheet>
                        
                        <Button variant="ghost" className="w-full justify-start text-base h-12 px-4 gap-3" onClick={() => setIsClearSheetOpen(true)}>
                            <MessageCircleX className="h-5 w-5" />
                            Clear Chat
                        </Button>

                        <ReportDialog reportedUserId={peerUser.id} reportedUserName={formatUserId(peerUser.id).toString()}>
                            <Button variant="ghost" className="w-full justify-start text-base h-12 text-destructive hover:text-destructive px-4 gap-3">
                                <Flag className="h-5 w-5" />
                                Report
                            </Button>
                        </ReportDialog>
                        <Button variant="ghost" className="w-full justify-start text-base h-12 text-destructive hover:text-destructive px-4 gap-3" onClick={() => setIsBlockSheetOpen(true)}>
                            <ShieldAlert className="h-5 w-5" />
                            {isBlocked ? 'Unblock User' : 'Block User'}
                        </Button>
                    </div>
                    <div className="my-4">
                        <SharedContent />
                    </div>
                </ScrollArea>
            </div>

            <Sheet open={isBlockSheetOpen} onOpenChange={setIsBlockSheetOpen}>
                <SheetContent side="bottom" className="rounded-t-[10px]">
                    <SheetHeader className="text-center">
                        <SheetTitle>{isBlocked ? 'Unblock' : 'Block'} {formatUserId(peerUser.id)}?</SheetTitle>
                        <SheetDescription>
                        {isBlocked 
                            ? "You will now be able to see this user's content and they will be able to message and call you."
                            : "Blocked users will not be able to call you or send you messages. They will not be notified that you've blocked them."
                        }
                        </SheetDescription>
                    </SheetHeader>
                    <div className="p-4 flex flex-col gap-2">
                        <Button onClick={handleBlock} className={cn(buttonVariants({variant: isBlocked ? 'default' : 'destructive'}), "w-full rounded-full")}>{isBlocked ? 'Unblock' : 'Block'}</Button>
                        <SheetClose asChild>
                             <Button variant="outline" className="w-full rounded-full">Cancel</Button>
                        </SheetClose>
                    </div>
                </SheetContent>
            </Sheet>
            
            <Sheet open={isClearSheetOpen} onOpenChange={setIsClearSheetOpen}>
                 <SheetContent side="bottom" className="rounded-t-[10px]">
                    <SheetHeader className="text-center">
                        <SheetTitle>Clear this chat?</SheetTitle>
                        <SheetDescription>
                        This will permanently delete all messages in this conversation on your device. This action cannot be undone.
                        </SheetDescription>
                    </SheetHeader>
                    <div className="p-4 flex flex-col gap-2">
                         <Button onClick={handleClearChat} className={cn(buttonVariants({variant: 'destructive'}), "w-full rounded-full")}>Clear Chat</Button>
                        <SheetClose asChild>
                             <Button variant="outline" className="w-full rounded-full">Cancel</Button>
                        </SheetClose>
                    </div>
                </SheetContent>
            </Sheet>
            {peerUser && <AboutProfileSheet user={peerUser} isOpen={isAboutSheetOpen} onOpenChange={setIsAboutSheetOpen} />}
            <QrCodeDialog
                isOpen={isQrDialogOpen}
                onOpenChange={setIsQrDialogOpen}
                user={peerUser}
            />
        </AppLayout>
    );
}
