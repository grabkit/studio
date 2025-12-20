
"use client";

import AppLayout from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy } from "firebase/firestore";
import { useCollection, WithId } from "@/firebase/firestore/use-collection";
import type { Conversation, User } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { formatTimestamp, getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { updateDoc, doc, deleteDoc } from "firebase/firestore";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { useToast } from "@/hooks/use-toast";

const formatUserId = (uid: string) => `blur${uid.substring(uid.length - 6)}`;

function ConversationItem({ conversation, currentUserId }: { conversation: WithId<Conversation>, currentUserId: string }) {
    const otherParticipantId = conversation.participantIds.find(id => id !== currentUserId);
    if (!otherParticipantId) return null;

    const otherParticipant = conversation.participants[otherParticipantId];
    if (!otherParticipant) return null;

    return (
        <Link href={`/messages/${otherParticipantId}`} className="block hover:bg-accent">
            <div className="flex items-center space-x-4 p-4 border-b">
                <Avatar className="h-12 w-12">
                    <AvatarFallback>{getInitials(otherParticipant.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                        <p className="font-bold truncate">{formatUserId(otherParticipant.id)}</p>
                        {conversation.lastMessage && (
                            <p className="text-xs text-muted-foreground">
                                {formatTimestamp(conversation.lastMessage.timestamp.toDate())}
                            </p>
                        )}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                        {conversation.lastMessage?.text ?? "No messages yet."}
                    </p>
                </div>
            </div>
        </Link>
    )
}

function RequestItem({ request, currentUserId }: { request: WithId<Conversation>, currentUserId: string }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const requesterId = request.requesterId;
    const requester = request.participants[requesterId];

    if (!requester) return null;

    const handleAccept = () => {
        if (!firestore) return;
        const conversationRef = doc(firestore, 'conversations', request.id);
        updateDoc(conversationRef, { status: 'accepted' })
            .catch(err => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: conversationRef.path,
                    operation: 'update',
                    requestResourceData: { status: 'accepted' }
                }));
            });
    }
    
    const handleDelete = () => {
         if (!firestore) return;
        const conversationRef = doc(firestore, 'conversations', request.id);
        deleteDoc(conversationRef)
            .then(() => {
                toast({ title: "Request deleted." });
            })
            .catch(err => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: conversationRef.path,
                    operation: 'delete',
                }));
            });
    }

    return (
         <div className="block">
            <div className="flex items-center space-x-4 p-4 border-b">
                <Avatar className="h-12 w-12">
                    <AvatarFallback>{getInitials(requester.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{formatUserId(requester.id)}</p>
                    <p className="text-sm text-muted-foreground truncate">
                        {request.lastMessage?.text ?? "Sent you a message request."}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button size="sm" onClick={handleAccept}>Accept</Button>
                    <Button size="sm" variant="ghost" onClick={handleDelete}>Delete</Button>
                </div>
            </div>
        </div>
    )
}

function ConversationSkeleton() {
    return (
        <div className="flex items-center space-x-4 p-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
            </div>
        </div>
    );
}


export default function MessagesPage() {
    const { firestore, user } = useFirebase();

    const chatsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'conversations'),
            where('participantIds', 'array-contains', user.uid),
            where('status', '==', 'accepted'),
            orderBy('lastMessage.timestamp', 'desc')
        );
    }, [firestore, user]);

    const requestsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'conversations'),
            where('participantIds', 'array-contains', user.uid),
            where('status', '==', 'pending'),
            where('requesterId', '!=', user.uid),
            orderBy('lastMessage.timestamp', 'desc')
        );
    }, [firestore, user]);

    const { data: chats, isLoading: chatsLoading } = useCollection<Conversation>(chatsQuery);
    const { data: requests, isLoading: requestsLoading } = useCollection<Conversation>(requestsQuery);

    return (
        <AppLayout showTopBar={false}>
            <div className="p-4 border-b">
                <h1 className="text-2xl font-bold font-headline">Messages</h1>
            </div>
            <Tabs defaultValue="chats" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="chats">Chats</TabsTrigger>
                    <TabsTrigger value="requests">
                        Requests
                        {!requestsLoading && requests && requests.length > 0 && (
                            <span className="ml-2 h-5 w-5 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs">
                                {requests.length}
                            </span>
                        )}
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="chats" className="m-0">
                    <div className="divide-y">
                        {chatsLoading && Array.from({ length: 3 }).map((_, i) => <ConversationSkeleton key={i} />)}
                        {!chatsLoading && chats?.length === 0 && (
                            <div className="text-center py-20">
                                <h2 className="text-xl font-headline text-primary">No Chats Yet</h2>
                                <p className="text-muted-foreground mt-2">Your accepted conversations will appear here.</p>
                            </div>
                        )}
                        {!chatsLoading && user && chats?.map(convo => (
                            <ConversationItem key={convo.id} conversation={convo} currentUserId={user.uid} />
                        ))}
                    </div>
                </TabsContent>
                <TabsContent value="requests" className="m-0">
                     <div className="divide-y">
                        {requestsLoading && Array.from({ length: 2 }).map((_, i) => <ConversationSkeleton key={i} />)}
                        {!requestsLoading && requests?.length === 0 && (
                            <div className="text-center py-20">
                                <h2 className="text-xl font-headline text-primary">No Message Requests</h2>
                                <p className="text-muted-foreground mt-2">New requests will appear here.</p>
                            </div>
                        )}
                        {!requestsLoading && user && requests?.map(req => (
                            <RequestItem key={req.id} request={req} currentUserId={user.uid} />
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </AppLayout>
    )
}
