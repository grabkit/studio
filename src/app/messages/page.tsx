

"use client";

import AppLayout from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials, formatMessageTimestamp } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MessageSquare, Mail, Trash2, BellOff, CheckCircle, User as UserIcon, Bell } from "lucide-react";
import { useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, getDocs } from "firebase/firestore";
import { useCollection, type WithId } from "@/firebase/firestore/use-collection";
import { useDoc } from "@/firebase/firestore/use-doc";
import type { Conversation, User } from "@/lib/types";
import { useMemo, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useRouter } from "next/navigation";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";
import { usePresence } from "@/hooks/usePresence";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const formatUserId = (uid: string | undefined) => {
    if (!uid) return "blur??????";
    return `blur${uid.substring(uid.length - 6)}`;
};

function UpvotedUserSkeleton() {
    return (
        <div className="flex flex-col items-center space-y-1 w-20">
            <Skeleton className="h-14 w-14 rounded-full" />
            <Skeleton className="h-4 w-16" />
        </div>
    )
}

function UpvotedUsers() {
    const { firestore, user: currentUser } = useFirebase();
    const [upvotedUsers, setUpvotedUsers] = useState<WithId<User>[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!firestore || !currentUser) {
            setIsLoading(false);
            return;
        };

        const fetchUpvotedUsers = async () => {
            setIsLoading(true);
            try {
                const usersQuery = query(
                    collection(firestore, 'users'),
                    where('upvotedBy', 'array-contains', currentUser.uid)
                );
                const querySnapshot = await getDocs(usersQuery);
                const users = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WithId<User>));
                setUpvotedUsers(users);
            } catch (error) {
                console.error("Error fetching upvoted users:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUpvotedUsers();
    }, [firestore, currentUser]);

    if (isLoading) {
        return (
            <div className="p-4">
                <h2 className="text-lg font-semibold font-headline mb-3">Upvoted Profiles</h2>
                <div className="flex space-x-4">
                    <UpvotedUserSkeleton />
                    <UpvotedUserSkeleton />
                    <UpvotedUserSkeleton />
                    <UpvotedUserSkeleton />
                </div>
            </div>
        );
    }
    
    if (upvotedUsers.length === 0) {
        return null; // Don't render anything if there are no upvoted users
    }

    return (
        <div className="p-4 border-b">
            <h2 className="text-lg font-semibold font-headline mb-3">Upvoted Profiles</h2>
            <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex space-x-4 pb-3">
                    {upvotedUsers.map(user => (
                         <Link key={user.id} href={`/profile/${user.id}`} className="flex-shrink-0">
                            <div className="flex flex-col items-center w-20">
                                 <Avatar className="h-14 w-14">
                                    <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                                </Avatar>
                                <p className="text-xs font-semibold truncate w-full text-center mt-1">{formatUserId(user.id)}</p>
                            </div>
                        </Link>
                    ))}
                </div>
                 <ScrollBar orientation="horizontal" />
            </ScrollArea>
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
                    <AvatarFallback>{getInitials(name)}</AvatarFallback>
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


    return (
        <div className="p-4 border-b flex justify-between items-center">
            <div className="flex items-center space-x-3">
                <Avatar className="h-12 w-12">
                    <AvatarFallback>{getInitials(name)}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold">{name}</p>
                    <p className="text-sm text-muted-foreground">Wants to message you</p>
                </div>
            </div>
            <Button size="sm" onClick={() => onAccept(request.id)}>Accept</Button>
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
    const emptyStateDescription = type === 'chats' ? "Accepted requests will appear here." : "When a user wants to chat, you'll see their request here.";
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
    const { firestore, user } = useFirebase();
    const { toast } = useToast();
    const router = useRouter();
    const [hasNewRequests, setHasNewRequests] = useState(false);
    const storageKey = `lastCheckedRequests_${user?.uid}`;

    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [selectedConvo, setSelectedConvo] = useState<WithId<Conversation> | null>(null);

    const conversationsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(
            collection(firestore, 'conversations'),
            where('participantIds', 'array-contains', user.uid)
        );
    }, [user, firestore]);

    const { data: conversations, isLoading } = useCollection<Conversation>(conversationsQuery);

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
        const updatePayload = { 
            mutedBy: isMuted ? arrayRemove(user.uid) : arrayUnion(user.uid)
        };

        updateDoc(convoRef, updatePayload)
            .then(() => {
                toast({ title: isMuted ? "Unmuted" : "Muted" });
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
            <UpvotedUsers />
            
            <div className="p-2">
                <Tabs defaultValue="chats" className="w-full" onValueChange={handleTabChange}>
                    <TabsList className="grid w-full grid-cols-2 rounded-full">
                        <TabsTrigger value="chats" className="relative flex items-center justify-center gap-2 rounded-full">
                             {hasUnreadChats && (
                                <div className="w-2 h-2 rounded-full bg-destructive"></div>
                            )}
                            Chats
                        </TabsTrigger>
                        <TabsTrigger value="requests" className="relative flex items-center justify-center gap-2 rounded-full">
                            {hasNewRequests && (
                                <div className="w-2 h-2 rounded-full bg-destructive"></div>
                            )}
                            Requests
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="chats">
                        <ConversationsList 
                            conversations={chats}
                            isLoading={isLoading}
                            type="chats"
                            currentUser={user}
                            onAcceptRequest={handleAcceptRequest}
                            onLongPress={handleLongPress}
                        />
                    </TabsContent>
                    <TabsContent value="requests">
                        <ConversationsList
                            conversations={requests}
                            isLoading={isLoading}
                            type="requests"
                            currentUser={user}
                            onAcceptRequest={handleAcceptRequest}
                            onLongPress={handleLongPress}
                        />
                    </TabsContent>
                </Tabs>
            </div>
            
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent side="bottom" className="rounded-t-lg">
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
