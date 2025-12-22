
"use client";

import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, setDoc, serverTimestamp, updateDoc, writeBatch, increment } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import React, { useMemo, useEffect } from 'react';

import AppLayout from '@/components/AppLayout';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Send } from 'lucide-react';
import { cn, getInitials, formatTimestamp } from '@/lib/utils';
import type { Conversation, Message, User } from '@/lib/types';
import { WithId } from '@/firebase/firestore/use-collection';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { formatDistanceToNowStrict } from 'date-fns';

const messageFormSchema = z.object({
  text: z.string().min(1, "Message cannot be empty").max(1000),
});

const formatUserId = (uid: string | undefined) => {
    if (!uid) return "blur??????";
    return `blur${uid.substring(uid.length - 6)}`;
};

function MessageBubble({ message, isOwnMessage }: { message: WithId<Message>, isOwnMessage: boolean }) {
    return (
        <div className={cn("flex items-end gap-2", isOwnMessage ? "justify-end" : "justify-start")}>
            <div className={cn(
                "max-w-[70%] rounded-2xl px-4 py-2",
                isOwnMessage ? "bg-primary text-primary-foreground rounded-br-none" : "bg-secondary rounded-bl-none"
            )}>
                <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                 {message.timestamp?.toDate && (
                     <p className={cn("text-xs mt-1", isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground")}>
                        {formatTimestamp(message.timestamp.toDate())}
                     </p>
                 )}
            </div>
        </div>
    )
}

function ChatHeader({ peerId }: { peerId: string }) {
    const router = useRouter();
    const { firestore } = useFirebase();

    const peerUserRef = useMemoFirebase(() => {
        if (!firestore || !peerId) return null;
        return doc(firestore, 'users', peerId);
    }, [firestore, peerId]);

    const { data: peerUser, isLoading } = useDoc<User>(peerUserRef);
    
    return (
        <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background/80 backdrop-blur-sm border-b h-14 max-w-2xl mx-auto sm:px-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft />
            </Button>
            <div className="flex items-center gap-3 ml-2">
                <Avatar className="h-8 w-8">
                    <AvatarFallback>{isLoading || !peerUser ? <Skeleton className="h-8 w-8 rounded-full" /> : getInitials(peerUser?.name)}</AvatarFallback>
                </Avatar>
                <div>
                    <h2 className="text-base font-bold">
                        {isLoading || !peerUser ? <Skeleton className="h-5 w-24" /> : peerUser?.name || formatUserId(peerId)}
                    </h2>
                </div>
            </div>
        </div>
    )
}

function ChatMessages({ conversationId, conversation }: { conversationId: string, conversation: WithId<Conversation> | null }) {
    const { firestore, user } = useFirebase();
    const messagesEndRef = React.useRef<HTMLDivElement | null>(null);

    const messagesQuery = useMemoFirebase(() => {
        if (!firestore || !conversationId) return null;
        return query(
            collection(firestore, 'conversations', conversationId, 'messages'),
            orderBy('timestamp', 'asc')
        );
    }, [firestore, conversationId]);

    const { data: messages, isLoading } = useCollection<Message>(messagesQuery);
    
    const seenStatus = useMemo(() => {
        if (!conversation || !messages || messages.length === 0 || !user) return null;

        const lastMessage = messages[messages.length - 1];
        if (lastMessage.senderId !== user.uid) return null; // Only show seen for user's own messages

        const peerId = conversation.participantIds.find(id => id !== user.uid);
        if (!peerId) return null;
        
        const peerLastReadTimestamp = conversation.lastReadTimestamps?.[peerId]?.toDate();
        const lastMessageTimestamp = lastMessage.timestamp?.toDate();

        if (peerLastReadTimestamp && lastMessageTimestamp && peerLastReadTimestamp >= lastMessageTimestamp) {
             const timeAgo = formatDistanceToNowStrict(peerLastReadTimestamp, { addSuffix: true });
             return `Seen ${timeAgo}`;
        }
        
        return null;

    }, [messages, conversation, user]);


    React.useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);
    
    if (isLoading) {
        return (
            <div className="space-y-4 p-4">
                <Skeleton className="h-10 w-3/5" />
                <Skeleton className="h-10 w-3/5 ml-auto" />
                <Skeleton className="h-16 w-4/5" />
            </div>
        )
    }

    return (
        <div className="p-4">
            <div className="space-y-4">
                {messages?.map(message => (
                    <MessageBubble key={message.id} message={message} isOwnMessage={message.senderId === user?.uid} />
                ))}
            </div>
             <div ref={messagesEndRef} />
             {seenStatus && (
                <div className="text-right text-xs text-muted-foreground pr-2 pt-1">
                    {seenStatus}
                </div>
            )}
        </div>
    )
}


function MessageInput({ conversationId, conversation }: { conversationId: string, conversation: WithId<Conversation> | null }) {
    const { firestore, user } = useFirebase();
    const form = useForm<z.infer<typeof messageFormSchema>>({
        resolver: zodResolver(messageFormSchema),
        defaultValues: { text: "" },
    });

    const onSubmit = async (values: z.infer<typeof messageFormSchema>) => {
        if (!firestore || !user || !conversationId || !conversation) return;

        form.reset();
        
        const peerId = conversation.participantIds.find(id => id !== user.uid);
        if (!peerId) return;


        const messageRef = doc(collection(firestore, 'conversations', conversationId, 'messages'));
        const conversationRef = doc(firestore, 'conversations', conversationId);

        const newMessage: Omit<Message, 'timestamp'> = {
            id: messageRef.id,
            senderId: user.uid,
            text: values.text,
        };
        
        try {
            const batch = writeBatch(firestore);
            
            batch.set(messageRef, { ...newMessage, timestamp: serverTimestamp() });
            
            // Update conversation's last message, timestamp, and peer's unread count
            const updatePayload: any = {
                lastMessage: values.text,
                lastUpdated: serverTimestamp(),
                [`unreadCounts.${peerId}`]: increment(1)
            };
            
            batch.update(conversationRef, updatePayload);

            await batch.commit();

        } catch (error) {
             const permissionError = new FirestorePermissionError({
                path: messageRef.path,
                operation: 'create',
                requestResourceData: newMessage,
            });
            errorEmitter.emit('permission-error', permissionError);
        }
    }
    
    if (conversation && conversation.status !== 'accepted') {
        return (
             <div className="fixed bottom-0 left-0 right-0 bg-background border-t z-10 max-w-2xl mx-auto sm:px-4">
                <div className="p-4 text-center text-sm text-muted-foreground">
                    The user has not accepted your message request yet.
                </div>
            </div>
        )
    }

    return (
         <div className="fixed bottom-0 left-0 right-0 bg-background border-t z-10 max-w-2xl mx-auto sm:px-4">
            <div className="p-2">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-center space-x-2">
                        <FormField
                            control={form.control}
                            name="text"
                            render={({ field }) => (
                            <FormItem className="flex-1">
                                <FormControl>
                                <Textarea
                                    placeholder="Start a new message..."
                                    className="text-base border-none focus-visible:ring-0 shadow-none p-2"
                                    rows={1}
                                    {...field}
                                />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <Button type="submit" size="icon" disabled={form.formState.isSubmitting}>
                            <Send className="h-5 w-5" />
                        </Button>
                    </form>
                </Form>
            </div>
        </div>
    )
}


export default function ChatPage() {
    const { firestore, user } = useFirebase();
    const params = useParams();
    const peerId = params.peerId as string;

    const conversationId = useMemo(() => {
        if (!user || !peerId) return null;
        return [user.uid, peerId].sort().join('_');
    }, [user, peerId]);
    
    const conversationRef = useMemoFirebase(() => {
        if (!firestore || !conversationId) return null;
        return doc(firestore, 'conversations', conversationId);
    }, [firestore, conversationId]);

    const { data: conversation, isLoading: isConversationLoading } = useDoc<Conversation>(conversationRef);

     // Effect to mark messages as read
    useEffect(() => {
        if (firestore && user && conversationRef && conversation) {
            // Check if current user has unread messages
            const userUnreadCount = conversation.unreadCounts?.[user.uid] ?? 0;
            
            if (userUnreadCount > 0) {
                const updatePayload = {
                    [`unreadCounts.${user.uid}`]: 0,
                    [`lastReadTimestamps.${user.uid}`]: serverTimestamp()
                };
                updateDoc(conversationRef, updatePayload).catch(error => {
                    // This can fail if rules are restrictive, but we can fail silently.
                    console.warn("Could not mark messages as read:", error.message);
                });
            } else if (conversation.status === 'accepted') {
                // Even if there are no "new" messages, we should update the read timestamp
                // to signal "seen" status. We only do this for accepted chats.
                 const updatePayload = {
                    [`lastReadTimestamps.${user.uid}`]: serverTimestamp()
                };
                updateDoc(conversationRef, updatePayload).catch(error => {
                    console.warn("Could not update last read timestamp:", error.message);
                });
            }
        }
    }, [conversation, conversationRef, firestore, user]);


    return (
        <AppLayout showTopBar={false} showBottomNav={false}>
            <ChatHeader peerId={peerId} />

            <div className="pt-14 pb-24">
                {conversationId && <ChatMessages conversationId={conversationId} conversation={conversation} />}
            </div>

            {conversationId && <MessageInput conversationId={conversationId} conversation={conversation}/>}
        </AppLayout>
    )
}
