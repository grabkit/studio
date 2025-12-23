
"use client";

import AppLayout from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials, formatMessageTimestamp } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MessageSquare, Mail } from "lucide-react";
import { useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, where, doc, updateDoc } from "firebase/firestore";
import { useCollection, type WithId } from "@/firebase/firestore/use-collection";
import { useDoc } from "@/firebase/firestore/use-doc";
import type { Conversation, User } from "@/lib/types";
import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";


function ConversationItem({ conversation, currentUser }: { conversation: WithId<Conversation>, currentUser: User }) {
    const otherParticipantId = conversation.participantIds.find(p => p !== currentUser.uid);
    const { firestore } = useFirebase();

    const otherUserRef = useMemoFirebase(() => {
        if (!firestore || !otherParticipantId) return null;
        return doc(firestore, 'users', otherParticipantId);
    }, [firestore, otherParticipantId]);

    const { data: otherUser } = useDoc<User>(otherUserRef);

    const name = otherUser?.name || 'User';
    const unreadCount = conversation.unreadCounts?.[currentUser.uid] ?? 0;
    const hasUnread = unreadCount > 0;

    const getUnreadMessageText = (count: number) => {
        if (count === 1) return "1 new message";
        if (count > 1 && count < 4) return `${count} new messages`;
        if (count >= 4) return "4+ new messages";
        return conversation.lastMessage || 'No messages yet';
    }

    return (
        <Link href={`/messages/${otherParticipantId}`} className="p-4 border-b flex justify-between items-center hover:bg-accent cursor-pointer">
            <div className="flex items-center space-x-3">
                <Avatar className="h-12 w-12">
                    <AvatarFallback>{getInitials(name)}</AvatarFallback>
                </Avatar>
                <div>
                    <p className={cn("font-semibold", hasUnread && "text-primary")}>{name}</p>
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
                {hasUnread && (
                    <div className="w-2.5 h-2.5 bg-blue-500 rounded-full mt-2"></div>
                )}
            </div>
        </Link>
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
    const name = requesterUser?.name || 'User';


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
    onAcceptRequest
}: {
    conversations: WithId<Conversation>[] | null;
    isLoading: boolean;
    type: 'chats' | 'requests';
    currentUser: User;
    onAcceptRequest: (id: string) => void;
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
                {sortedChats.map(convo => <ConversationItem key={convo.id} conversation={convo} currentUser={currentUser} />)}
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
    const [hasNewRequests, setHasNewRequests] = useState(false);
    const storageKey = `lastCheckedRequests_${user?.uid}`;

    const conversationsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        // This query is now secure and will be allowed by the new security rules.
        // It only fetches conversations where the current user is a participant.
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

    if (!user) {
        return (
             <AppLayout showTopBar={false}>
                <ListSkeleton />
             </AppLayout>
        )
    }

    return (
        <AppLayout showTopBar={false}>
            <div className="p-4 border-b">
                <h1 className="text-2xl font-bold font-headline">Messages</h1>
            </div>
            
            <Tabs defaultValue="chats" className="w-full" onValueChange={handleTabChange}>
                <div className="flex justify-center p-1">
                    <TabsList className="inline-flex h-10 items-center justify-center rounded-full bg-muted p-1 text-muted-foreground">
                        <TabsTrigger value="chats" className="rounded-full px-8 flex items-center">
                            Chats
                            {hasUnreadChats && (
                                <div className="ml-2 h-1.5 w-1.5 rounded-full bg-red-500"></div>
                            )}
                        </TabsTrigger>
                        <TabsTrigger value="requests" className="rounded-full px-8 flex items-center">
                            Requests
                            {hasNewRequests && (
                                <div className="ml-2 h-1.5 w-1.5 rounded-full bg-red-500"></div>
                            )}
                        </TabsTrigger>
                    </TabsList>
                </div>
                <TabsContent value="chats">
                    <ConversationsList 
                        conversations={chats}
                        isLoading={isLoading}
                        type="chats"
                        currentUser={user}
                        onAcceptRequest={handleAcceptRequest}
                    />
                </TabsContent>
                <TabsContent value="requests">
                    <ConversationsList
                        conversations={requests}
                        isLoading={isLoading}
                        type="requests"
                        currentUser={user}
                        onAcceptRequest={handleAcceptRequest}
                    />
                </TabsContent>
            </Tabs>

        </AppLayout>
    )
}

    