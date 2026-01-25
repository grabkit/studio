
"use client";

import AppLayout from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatar, formatMessageTimestamp, formatUserId } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MessageSquare, Mail, Trash2, BellOff, CheckCircle, User as UserIcon, Bell, Mic, Loader2, Radio } from "lucide-react";
import { useFirebase, useMemoFirebase, useDoc } from "@/firebase";
import { collection, query, where, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, getDocs, documentId, getDocsFromCache, orderBy } from "firebase/firestore";
import type { Conversation, User } from "@/lib/types";
import React, { useMemo, useState, useEffect, useRef, useCallback, type TouchEvent } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useRouter } from "next/navigation";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";
import { usePresence } from "@/hooks/usePresence";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { eventBus } from "@/lib/event-bus";
import { WithId, useCollection } from "@/firebase/firestore/use-collection";
import { RoomCard } from "@/components/RoomCard";


function FollowedUserSkeleton() {
    return (
        <div className="flex flex-col items-center w-20">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-4 w-16 mt-2" />
        </div>
    )
}

function FollowedUsers({ users, isLoading, currentUser, showVoiceStatusPlayer }: { users: WithId<User>[], isLoading: boolean, currentUser: User | null, showVoiceStatusPlayer: (user: WithId<User>) => void }) {
    if (isLoading) {
        return (
            <div className="p-4 border-b">
                <h2 className="text-lg font-semibold font-headline mb-3">Following</h2>
                <div className="flex space-x-4">
                    <FollowedUserSkeleton />
                    <FollowedUserSkeleton />
                    <FollowedUserSkeleton />
                    <FollowedUserSkeleton />
                </div>
            </div>
        );
    }
    
    if (users.length === 0) {
        return null;
    }

    return (
        <div className="p-4 border-b">
            <h2 className="text-lg font-semibold font-headline mb-3">Following</h2>
             <div className="overflow-x-auto pb-2 -mb-2 no-scrollbar">
                <div className="flex space-x-4">
                    {users.map(user => {
                        const isCurrentUser = user.id === currentUser?.uid;
                        const href = isCurrentUser ? '/account' : `/profile/${user.id}`;
                        const name = isCurrentUser ? 'Your Profile' : formatUserId(user.id);
                        
                        const hasVoiceStatus = user?.voiceStatusUrl && user?.voiceStatusTimestamp && (Date.now() - user.voiceStatusTimestamp.toMillis() < 24 * 60 * 60 * 1000);
                        const avatar = getAvatar(user);
                        const isAvatarUrl = avatar.startsWith('http');

                        return (
                         <div key={user.id} className="flex-shrink-0 flex flex-col items-center w-20">
                             <div className="relative">
                                <Link href={href}>
                                    <Avatar className="h-16 w-16">
                                        <AvatarImage src={isAvatarUrl ? avatar : undefined} alt={String(name)} />
                                        <AvatarFallback>{!isAvatarUrl ? avatar : ''}</AvatarFallback>
                                    </Avatar>
                                </Link>
                                 {isCurrentUser ? (
                                    <Link href="/voice-note">
                                        <div className="absolute -bottom-1 -right-1 bg-background p-1 rounded-full border-2 cursor-pointer hover:bg-secondary">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-primary">
                                                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" fill="currentColor"></path>
                                                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                                                <line x1="12" x2="12" y1="19" y2="22"></line>
                                            </svg>
                                        </div>
                                    </Link>
                                ) : hasVoiceStatus && (
                                     <div 
                                        className="absolute -right-1 -bottom-1 bg-background p-1 rounded-full border-2 cursor-pointer" 
                                        onClick={() => showVoiceStatusPlayer(user)} 
                                        role="button"
                                    >
                                        <div className="flex items-center justify-center h-4 w-4 gap-0.5">
                                            <div className="audio-wave-bar-avatar" />
                                            <div className="audio-wave-bar-avatar" />
                                            <div className="audio-wave-bar-avatar" />
                                            <div className="audio-wave-bar-avatar" />
                                            <div className="audio-wave-bar-avatar" />
                                        </div>
                                    </div>
                                )}
                            </div>
                            <Link href={href} className="w-full">
                                <p className="text-xs font-semibold text-center mt-2 truncate max-w-full">{name}</p>
                            </Link>
                        </div>
                        )
                    })}
                </div>
            </div>
            <style jsx>{`
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
}

function ConversationItem({ conversation, currentUser, onLongPress }: { conversation: WithId<Conversation>, currentUser: User, onLongPress: (conversation: WithId<Conversation>) => void }) {
    const otherParticipantId = conversation.participantIds.find(p => p !== currentUser.uid);
    const { firestore } = useFirebase();
    const router = useRouter();
    const pressTimer = useRef<NodeJS.Timeout | null>(null);
    const { isOnline } = usePresence(otherParticipantId);


    const otherUserRef = useMemoFirebase(() => {
        if (!firestore || !otherParticipantId) return null;
        return doc(firestore, 'users', otherParticipantId);
    }, [firestore, otherParticipantId]);

    const { data: otherUser } = useDoc<User>(otherUserRef);

    const name = otherUser ? formatUserId(otherUser.id) : 'User';
    const unreadCount = conversation.unreadCounts?.[currentUser.uid] ?? 0;
    const hasUnread = unreadCount > 0;
    const isMuted = useMemo(() => conversation.mutedBy?.includes(currentUser.uid) || false, [conversation, currentUser]);

    const avatar = getAvatar(otherUser);
    const isAvatarUrl = avatar.startsWith('http');

    const getUnreadMessageText = (count: number) => {
        if (count === 1) return "1 new message";
        if (count > 1 && count < 4) return `${count} new messages`;
        if (count >= 4) return "4+ new messages";
        return conversation.lastMessage || 'No messages yet';
    }

    const handlePointerDown = () => {
      pressTimer.current = setTimeout(() => {
        onLongPress(conversation);
      }, 500); // 500ms for a long press
    };

    const handlePointerUp = () => {
      if (pressTimer.current) {
        clearTimeout(pressTimer.current);
        pressTimer.current = null;
      }
    };
    
    const handlePointerMove = () => {
        // Cancel long press if pointer moves
        handlePointerUp();
    }

    const handleClick = () => {
        if (otherParticipantId) {
            router.push(`/messages/${otherParticipantId}`);
        }
    }


    return (
        <div
            onClick={handleClick}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerMove={handlePointerMove}
            className="p-4 border-b flex justify-between items-center hover:bg-accent cursor-pointer"
        >
            <div className="flex items-center space-x-3">
                <Avatar className="h-12 w-12" showStatus={true} isOnline={isOnline}>
                    <AvatarImage src={isAvatarUrl ? avatar : undefined} alt={String(name)} />
                    <AvatarFallback>{!isAvatarUrl ? avatar : '?'}</AvatarFallback>
                </Avatar>
                <div>
                    <div className="flex items-center gap-2">
                        <p className={cn("font-semibold", hasUnread && "text-primary")}>{name}</p>
                        {isMuted && <BellOff className="h-3 w-3 text-muted-foreground" />}
                    </div>
                    <p className={cn(
                        "text-sm text-muted-foreground truncate max-w-xs",
                        hasUnread && "text-primary font-medium"
                    )}>
                        {getUnreadMessageText(unreadCount)}
                    </p>
                </div>
            </div>
            <div className="flex flex-col items-end self-start shrink-0">
                 {conversation.lastUpdated?.toDate && (
                    <p className="text-xs text-muted-foreground">
                        {formatMessageTimestamp(conversation.lastUpdated.toDate())}
                    </p>
                )}
                {hasUnread && !isMuted && (
                    <div className="w-2.5 h-2.5 bg-foreground rounded-full mt-2"></div>
                )}
            </div>
        </div>
    );
}

function RequestItem({ request, onAccept }: { request: WithId<Conversation>, onAccept: (id: string) => void }) {
     const requesterId = request.requesterId;
     const { firestore } = useFirebase();

    const requesterUserRef = useMemoFirebase(() => {
        if (!firestore || !requesterId) return null;
        return doc(firestore, 'users', requesterId);
    }, [firestore, requesterId]);

    const { data: requesterUser } = useDoc<User>(requesterUserRef);
    const name = requesterUser ? formatUserId(requesterUser.id) : 'User';
    const avatar = getAvatar(requesterUser);
    const isAvatarUrl = avatar.startsWith('http');


    return (
        <div className="p-4 border-b flex justify-between items-center">
            <div className="flex items-center space-x-3">
                <Avatar className="h-12 w-12">
                    <AvatarImage src={isAvatarUrl ? avatar : undefined} alt={String(name)} />
                    <AvatarFallback>{!isAvatarUrl ? avatar : ''}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold">{name}</p>
                    <p className="text-sm text-muted-foreground">Wants to message you</p>
                </div>
            </div>
            <Button size="sm" onClick={() => onAccept(request.id)} className="rounded-[20px]">Accept</Button>
        </div>
    );
}

function ListSkeleton() {
    return (
        <div className="divide-y">
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4 flex items-center space-x-3">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-48" />
                    </div>
                </div>
            ))}
        </div>
    )
}

function ConversationsList({
    conversations,
    isLoading,
    type,
    currentUser,
    onAcceptRequest,
    onLongPress,
}: {
    conversations: WithId<Conversation>[] | null;
    isLoading: boolean;
    type: 'chats' | 'requests';
    currentUser: User;
    onAcceptRequest: (id: string) => void;
    onLongPress: (conversation: WithId<Conversation>) => void;
}) {
    const emptyStateTitle = type === 'chats' ? "No Chats Yet" : "No New Requests";
    const emptyStateDescription = type === 'chats' 
        ? "Start a chat by sending a request to others. Your first anonymous chat is one tap away." 
        : "When a user wants to chat, you'll see their request here.";
    const EmptyIcon = type === 'chats' ? MessageSquare : Mail;

    if (isLoading) {
        return <ListSkeleton />;
    }

    if (!conversations || conversations.length === 0) {
        return (
             <div className="text-center py-20 px-4">
                <div className="inline-block p-4 bg-secondary rounded-full">
                    <EmptyIcon className="h-10 w-10 text-primary" />
                </div>
                <h2 className="mt-6 text-xl font-headline text-primary">{emptyStateTitle}</h2>
                <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                   {emptyStateDescription}
                </p>
                {type === 'chats' && (
                    <Button asChild className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90 rounded-full font-bold">
                        <Link href="/home">Start a New Chat</Link>
                    </Button>
                )}
            </div>
        )
    }
    
    if (type === 'chats') {
         const sortedChats = [...conversations].sort((a, b) => {
            if (!a.lastUpdated?.toMillis) return 1;
            if (!b.lastUpdated?.toMillis) return -1;
            return b.lastUpdated.toMillis() - a.lastUpdated.toMillis();
        });
        return (
            <div className="divide-y">
                {sortedChats.map(convo => <ConversationItem key={convo.id} conversation={convo} currentUser={currentUser} onLongPress={onLongPress} />)}
            </div>
        )
    }

    // Filter out requests sent by the current user for the 'requests' tab
    const filteredRequests = conversations.filter(request => request.requesterId !== currentUser.uid);

    if (filteredRequests.length === 0) {
        return (
            <div className="text-center py-20 px-4">
               <div className="inline-block p-4 bg-secondary rounded-full">
                   <EmptyIcon className="h-10 w-10 text-primary" />
               </div>
               <h2 className="mt-6 text-xl font-headline text-primary">{emptyStateTitle}</h2>
               <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                  {emptyStateDescription}
               </p>
           </div>
       )
    }


    return (
        <div className="divide-y">
            {filteredRequests.map(request => (
                <RequestItem key={request.id} request={request} onAccept={onAcceptRequest} />
            ))}
        </div>
    )
}


export default function MessagesPage() {
    const { firestore, user, userProfile, showVoiceStatusPlayer } = useFirebase();
    const { toast } = useToast();
    const router = useRouter();
    const [hasNewRequests, setHasNewRequests] = useState(false);
    const storageKey = `lastCheckedRequests_${user?.uid}`;

    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [selectedConvo, setSelectedConvo] = useState<WithId<Conversation> | null>(null);

    // State for refresh and data
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [followedUsers, setFollowedUsers] = useState<WithId<User>[]>([]);
    const [followedUsersLoading, setFollowedUsersLoading] = useState(true);
    const [conversations, setConversations] = useState<WithId<Conversation>[] | null>(null);
    const [conversationsLoading, setConversationsLoading] = useState(true);

    const followingIds = useMemo(() => userProfile?.following || [], [userProfile]);

    const fetchFollowedUsers = useCallback(async () => {
        if (!firestore || !user) return;
        setFollowedUsersLoading(true);
         try {
            const usersToFetch = [...followingIds];
            const fetchedUsers: WithId<User>[] = [];

            if (userProfile) {
                const currentUserAsUser = { id: user.uid, ...userProfile } as WithId<User>;
                fetchedUsers.push(currentUserAsUser);
            }
            
            if (usersToFetch.length > 0) {
                const userQuery = query(collection(firestore, "users"), where(documentId(), 'in', usersToFetch.slice(0,30)));
                const querySnapshot = await getDocs(userQuery);
                querySnapshot.forEach(doc => fetchedUsers.push({ id: doc.id, ...doc.data() } as WithId<User>));
            }
            
            const finalUsers = fetchedUsers.sort((a, b) => a.id === user.uid ? -1 : b.id === user.uid ? 1 : 0);
            setFollowedUsers(finalUsers);
        } catch (error) {
            console.error("Error fetching followed users:", error);
        } finally {
            setFollowedUsersLoading(false);
        }
    }, [firestore, user, userProfile, followingIds]);

    const conversationsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(
            collection(firestore, 'conversations'),
            where('participantIds', 'array-contains', user.uid)
        );
    }, [user, firestore]);

    const fetchConversations = useCallback(async () => {
        if (!conversationsQuery) return;
        setConversationsLoading(true);
        try {
            const snapshot = await getDocs(conversationsQuery);
            setConversations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WithId<Conversation>)));
        } catch (error) {
            console.error("Error fetching conversations:", error);
        } finally {
            setConversationsLoading(false);
        }
    }, [conversationsQuery]);
    
    const handleRefresh = useCallback(async () => {
        eventBus.emit('scroll-main-to-top');
        setIsRefreshing(true);
        await Promise.all([fetchFollowedUsers(), fetchConversations()]);
        // Short delay for better UX
        await new Promise(resolve => setTimeout(resolve, 750));
        setIsRefreshing(false);
    }, [fetchFollowedUsers, fetchConversations]);

    useEffect(() => {
        fetchFollowedUsers();
        fetchConversations();
    }, [fetchFollowedUsers, fetchConversations]);

    useEffect(() => {
        const refreshHandler = () => handleRefresh();
        eventBus.on('refresh-messages', refreshHandler);
        return () => {
            eventBus.off('refresh-messages', refreshHandler);
        };
    }, [handleRefresh]);


    const { chats, requests } = useMemo(() => {
        const chats: WithId<Conversation>[] = [];
        const requests: WithId<Conversation>[] = [];
        conversations?.forEach(c => {
            if (c.status === 'accepted') {
                chats.push(c);
            } else if (c.status === 'pending') {
                requests.push(c);
            }
        });
        return { chats, requests };
    }, [conversations]);
    
    const hasUnreadChats = useMemo(() => {
        if (!chats || !user) return false;
        return chats.some(chat => (chat.unreadCounts?.[user.uid] ?? 0) > 0);
    }, [chats, user]);


    useEffect(() => {
        if (requests && user) {
            const lastChecked = localStorage.getItem(storageKey);
            const lastCheckedTimestamp = lastChecked ? parseInt(lastChecked, 10) : 0;
            
            const newRequestExists = requests.some(req =>
                req.requesterId !== user.uid &&
                req.lastUpdated?.toMillis() > lastCheckedTimestamp
            );

            setHasNewRequests(newRequestExists);
        }
    }, [requests, user, storageKey]);


    const handleTabChange = (value: string) => {
        if (value === 'requests') {
            localStorage.setItem(storageKey, Date.now().toString());
            setHasNewRequests(false);
        }
    };

    const handleAcceptRequest = async (conversationId: string) => {
        if (!firestore) return;
        const convoRef = doc(firestore, 'conversations', conversationId);
        try {
            await updateDoc(convoRef, { status: 'accepted' });
            // Manually update local state for immediate feedback
            setConversations(prev => prev?.map(c => c.id === conversationId ? { ...c, status: 'accepted' } : c) || null);
            toast({
                title: "Request Accepted",
                description: "You can now chat with this user.",
            });
        } catch (error) {
            console.error("Error accepting request:", error);
             toast({
                variant: "destructive",
                title: "Error",
                description: "Could not accept the request.",
            });
        }
    }
    
    const handleLongPress = (conversation: WithId<Conversation>) => {
        setSelectedConvo(conversation);
        setIsSheetOpen(true);
    };

    const handleDeleteChat = () => {
        if (!firestore || !selectedConvo) return;
        const convoRef = doc(firestore, 'conversations', selectedConvo.id);
        
        deleteDoc(convoRef)
            .then(() => {
                setConversations(prev => prev?.filter(c => c.id !== selectedConvo.id) || null);
                toast({ title: "Chat Deleted", description: "The conversation has been removed." });
            })
            .catch(serverError => {
                const permissionError = new FirestorePermissionError({
                    path: convoRef.path,
                    operation: 'delete',
                });
                errorEmitter.emit('permission-error', permissionError);
            })
            .finally(() => {
                setIsSheetOpen(false);
            });
    }
    
    const handleMarkAsUnread = () => {
        if (!firestore || !selectedConvo || !user) return;
        const convoRef = doc(firestore, 'conversations', selectedConvo.id);
        const updatePayload = { [`unreadCounts.${user.uid}`]: 1 };
        
        updateDoc(convoRef, updatePayload)
            .then(() => {
                 setConversations(prev => prev?.map(c => c.id === selectedConvo.id ? { ...c, unreadCounts: { ...c.unreadCounts, [user.uid]: 1 } } : c) || null);
                 toast({ title: "Marked as Unread" });
            })
            .catch(serverError => {
                const permissionError = new FirestorePermissionError({
                    path: convoRef.path,
                    operation: 'update',
                    requestResourceData: updatePayload,
                });
                errorEmitter.emit('permission-error', permissionError);
            })
            .finally(() => {
                setIsSheetOpen(false);
            });
    }
    
    const handleViewProfile = () => {
        if (!selectedConvo || !user) return;
        const otherParticipantId = selectedConvo.participantIds.find(p => p !== user.uid);
        if (otherParticipantId) {
            router.push(`/profile/${otherParticipantId}`);
        }
        setIsSheetOpen(false);
    }
    
     const handleMute = () => {
        if (!firestore || !selectedConvo || !user) return;
        
        const convoRef = doc(firestore, 'conversations', selectedConvo.id);
        const isMuted = selectedConvo.mutedBy?.includes(user.uid);
        const newMutedBy = isMuted ? arrayRemove(user.uid) : arrayUnion(user.uid);

        updateDoc(convoRef, { mutedBy: newMutedBy })
            .then(() => {
                setConversations(prev => prev?.map(c => {
                    if (c.id === selectedConvo.id) {
                        const currentMutedBy = c.mutedBy || [];
                        const updatedMutedBy = isMuted ? currentMutedBy.filter(id => id !== user.uid) : [...currentMutedBy, user.uid];
                        return { ...c, mutedBy: updatedMutedBy };
                    }
                    return c;
                }) || null);
                toast({ title: isMuted ? "Unmuted" : "Muted" });
            })
            .catch(serverError => {
                const permissionError = new FirestorePermissionError({
                    path: convoRef.path,
                    operation: 'update',
                    requestResourceData: { mutedBy: newMutedBy },
                });
                errorEmitter.emit('permission-error', permissionError);
            })
            .finally(() => {
                setIsSheetOpen(false);
            });
    }

    const isSelectedConvoMuted = useMemo(() => {
        if (!selectedConvo || !user) return false;
        return selectedConvo.mutedBy?.includes(user.uid) || false;
    }, [selectedConvo, user]);


    if (!user) {
        return (
             <AppLayout showTopBar={false}>
                <ListSkeleton />
             </AppLayout>
        )
    }

    return (
        <AppLayout showTopBar={false}>
            <div className="relative h-full">
                <AnimatePresence>
                    {isRefreshing && (
                        <motion.div
                            key="messages-refresh-indicator"
                            initial={{ height: 0 }}
                            animate={{ height: 60 }}
                            exit={{ height: 0, transition: { duration: 0.2 } }}
                            transition={{ duration: 0.4, ease: "easeInOut" }}
                            className="bg-blue-500 flex items-center justify-center overflow-hidden absolute top-0 left-0 right-0 z-10"
                        >
                            <Loader2 className="h-6 w-6 animate-spin text-white" />
                        </motion.div>
                    )}
                </AnimatePresence>
                
                <motion.div
                    className="h-full flex flex-col"
                    animate={{ paddingTop: isRefreshing ? 60 : 0 }}
                    transition={{ duration: 0.4, ease: "easeInOut" }}
                >
                    <div className="flex-shrink-0">
                        <FollowedUsers 
                            users={followedUsers}
                            isLoading={followedUsersLoading}
                            currentUser={user}
                            showVoiceStatusPlayer={showVoiceStatusPlayer}
                        />
                    </div>
                    
                    <div className="flex-grow flex flex-col p-2 overflow-hidden">
                        <Tabs defaultValue="rooms" className="w-full flex flex-col flex-grow" onValueChange={handleTabChange}>
                            <TabsList className="grid w-full grid-cols-3 rounded-full flex-shrink-0">
                                <TabsTrigger value="rooms" className="relative flex items-center justify-center gap-2 rounded-full font-bold">
                                    Rooms
                                </TabsTrigger>
                                <TabsTrigger value="chats" className="relative flex items-center justify-center gap-2 rounded-full font-bold">
                                    {hasUnreadChats && (
                                        <div className="w-2 h-2 rounded-full bg-destructive"></div>
                                    )}
                                    Chats
                                </TabsTrigger>
                                <TabsTrigger value="requests" className="relative flex items-center justify-center gap-2 rounded-full font-bold">
                                    {hasNewRequests && (
                                        <div className="w-2 h-2 rounded-full bg-destructive"></div>
                                    )}
                                    Requests
                                </TabsTrigger>
                            </TabsList>
                            <div className="flex-grow overflow-y-auto">
                                <TabsContent value="rooms" className="p-4 space-y-6">
                                     <div>
                                        <h2 className="text-lg font-bold font-headline mb-3">Insomnia</h2>
                                        <RoomCard 
                                            title="After Dark"
                                            description="Join late-night conversations from 12 AM to 4 AM — meet new people and enjoy real-time chats."
                                            attendees={345}
                                            avatars={[
                                                "https://i.pravatar.cc/150?u=a042581f4e29026704d",
                                                "https://i.pravatar.cc/150?u=a042581f4e29026705d",
                                                "https://i.pravatar.cc/150?u=a042581f4e29026706d"
                                            ]}
                                            theme="violet"
                                        />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold font-headline mb-3">Ask Space</h2>
                                        <RoomCard 
                                            title="Ask Space"
                                            description="A place for curious minds. Ask questions, get answers, and learn something new."
                                            attendees={123}
                                            avatars={[
                                                "https://i.pravatar.cc/150?u=a042581f4e29026707d",
                                                "https://i.pravatar.cc/150?u=a042581f4e29026708d",
                                                "https://i.pravatar.cc/150?u=a042581f4e29026709d"
                                            ]}
                                            theme="teal"
                                        />
                                    </div>
                                </TabsContent>
                                <TabsContent value="chats">
                                    <ConversationsList 
                                        conversations={chats}
                                        isLoading={conversationsLoading}
                                        type="chats"
                                        currentUser={user}
                                        onAcceptRequest={handleAcceptRequest}
                                        onLongPress={handleLongPress}
                                    />
                                </TabsContent>
                                <TabsContent value="requests">
                                    <ConversationsList
                                        conversations={requests}
                                        isLoading={conversationsLoading}
                                        type="requests"
                                        currentUser={user}
                                        onAcceptRequest={handleAcceptRequest}
                                        onLongPress={handleLongPress}
                                    />
                                </TabsContent>
                            </div>
                        </Tabs>
                    </div>
                </motion.div>
            </div>
            
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent side="bottom" className="rounded-t-2xl">
                    <SheetHeader className="text-left mb-4">
                        <SheetTitle>Chat Options</SheetTitle>
                    </SheetHeader>
                    <div className="grid gap-2">
                        <Button variant="ghost" className="justify-start gap-3 text-base p-4" onClick={handleViewProfile}>
                            <UserIcon /> View Profile
                        </Button>
                        <Button variant="ghost" className="justify-start gap-3 text-base p-4" onClick={handleMarkAsUnread}>
                            <CheckCircle /> Mark as Unread
                        </Button>
                        <Button variant="ghost" className="justify-start gap-3 text-base p-4" onClick={handleMute}>
                           {isSelectedConvoMuted ? <Bell /> : <BellOff />} 
                           {isSelectedConvoMuted ? "Unmute" : "Mute"}
                        </Button>
                         <Button variant="ghost" className="justify-start gap-3 text-base p-4 text-destructive hover:text-destructive" onClick={handleDeleteChat}>
                            <Trash2 /> Delete Chat
                        </Button>
                    </div>
                </SheetContent>
            </Sheet>

        </AppLayout>
    )
}
