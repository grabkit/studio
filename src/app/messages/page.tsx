
"use client";

import AppLayout from "@/components/AppLayout";
import { useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy, updateDoc, doc } from "firebase/firestore";
import { useCollection, type WithId } from "@/firebase/firestore/use-collection";
import type { Conversation, User } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNowStrict } from 'date-fns';
import { getInitials } from "@/lib/utils";
import Link from "next/link";
import { useDoc } from "@/firebase/firestore/use-doc";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Mail } from "lucide-react";

function OtherParticipantDetails({ participantIds }: { participantIds: string[] }) {
    const { firestore, user: currentUser } = useFirebase();
    const otherUserId = participantIds.find(id => id !== currentUser?.uid);

    const userRef = useMemoFirebase(() => {
        if (!firestore || !otherUserId) return null;
        return doc(firestore, 'users', otherUserId);
    }, [firestore, otherUserId]);

    const { data: otherUser, isLoading } = useDoc<User>(userRef);

    if (isLoading) {
        return (
            <div className="flex items-center space-x-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-40" />
                </div>
            </div>
        );
    }
    
    if (!otherUser) {
        return (
            <div className="flex items-center space-x-3">
                 <Avatar className="h-12 w-12">
                    <AvatarFallback>?</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold">Unknown User</p>
                    <p className="text-sm text-muted-foreground">...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center space-x-3">
            <Avatar className="h-12 w-12">
                <AvatarFallback>{getInitials(otherUser.name)}</AvatarFallback>
            </Avatar>
            <div>
                <p className="font-semibold">{otherUser.name}</p>
                <p className="text-sm text-muted-foreground truncate">
                    {/* Placeholder for last message */}
                </p>
            </div>
        </div>
    );
}

function ConversationItem({ conversation }: { conversation: WithId<Conversation> }) {
    const { user: currentUser } = useFirebase();
    const lastMessageText = conversation.lastMessage ? 
        (conversation.lastMessage.senderId === currentUser?.uid ? 'You: ' : '') + conversation.lastMessage.text :
        'No messages yet';
    
    const lastMessageTimestamp = conversation.lastMessage?.timestamp?.toDate();

    return (
         <Link href={`/messages/${conversation.participantIds.find(id => id !== currentUser?.uid)}`}>
            <div className="p-4 border-b flex justify-between items-center hover:bg-accent">
                <OtherParticipantDetails participantIds={conversation.participantIds} />
                {lastMessageTimestamp && (
                     <p className="text-xs text-muted-foreground self-start shrink-0">
                        {formatDistanceToNowStrict(lastMessageTimestamp, { addSuffix: false })}
                    </p>
                )}
            </div>
        </Link>
    );
}

function RequestItem({ conversation }: { conversation: WithId<Conversation> }) {
    const { firestore, user: currentUser } = useFirebase();
    const { toast } = useToast();

    const handleAcceptRequest = async () => {
        if (!firestore) return;
        const conversationRef = doc(firestore, 'conversations', conversation.id);
        try {
            await updateDoc(conversationRef, { status: 'accepted' });
            toast({
                title: "Request Accepted",
                description: "You can now chat with this user.",
            });
        } catch (error: any) {
            console.error("Error accepting request:", error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Could not accept the request.",
            });
        }
    };

    return (
        <div className="p-4 border-b flex justify-between items-center">
            <OtherParticipantDetails participantIds={conversation.participantIds} />
             {conversation.initiatedBy !== currentUser?.uid && (
                <Button onClick={handleAcceptRequest} size="sm">Accept</Button>
            )}
        </div>
    );
}


function ConversationsList({ status }: { status: 'accepted' | 'pending' }) {
    const { firestore, user } = useFirebase();

    const conversationsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'conversations'),
            where('participantIds', 'array-contains', user.uid),
            where('status', '==', status),
            orderBy('lastUpdatedAt', 'desc')
        );
    }, [firestore, user, status]);

    const { data: conversations, isLoading } = useCollection<Conversation>(conversationsQuery);
    
    const ItemComponent = status === 'accepted' ? ConversationItem : RequestItem;
    const emptyStateTitle = status === 'accepted' ? "No Chats Yet" : "No New Requests";
    const emptyStateDescription = status === 'accepted' ? "Start a conversation from a user's post." : "When a user wants to chat, you'll see their request here.";


    if (isLoading) {
        return (
            <div className="p-4 space-y-4">
                <div className="flex items-center space-x-3">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-40" />
                    </div>
                </div>
                 <div className="flex items-center space-x-3">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-3 w-40" />
                    </div>
                </div>
            </div>
        );
    }
    
    if (conversations?.length === 0) {
        return (
             <div className="text-center py-20 px-4">
                <div className="inline-block p-4 bg-secondary rounded-full">
                    {status === 'accepted' ? <MessageSquare className="h-10 w-10 text-primary" /> : <Mail className="h-10 w-10 text-primary" />}
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
            {conversations?.map(convo => <ItemComponent key={convo.id} conversation={convo} />)}
        </div>
    )
}


export default function MessagesPage() {

    return (
        <AppLayout showTopBar={false}>
            <div className="p-4 border-b">
                <h1 className="text-2xl font-bold font-headline">Messages</h1>
            </div>
            
            <Tabs defaultValue="chats" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="chats">Chats</TabsTrigger>
                    <TabsTrigger value="requests">Requests</TabsTrigger>
                </TabsList>
                <TabsContent value="chats">
                    <ConversationsList status="accepted" />
                </TabsContent>
                <TabsContent value="requests">
                    <ConversationsList status="pending" />
                </TabsContent>
            </Tabs>

        </AppLayout>
    )
}
