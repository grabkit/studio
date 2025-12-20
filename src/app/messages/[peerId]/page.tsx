
"use client";

import { useParams, useRouter } from 'next/navigation';
import AppLayout from "@/components/AppLayout";
import { useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, where, orderBy, limit, getDoc, writeBatch, serverTimestamp, addDoc, getDocs } from "firebase/firestore";
import { useCollection, WithId } from "@/firebase/firestore/use-collection";
import { type Conversation, type Message, type User } from "@/lib/types";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials, cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc } from 'firebase/firestore';

const formatUserId = (uid: string) => `blur${uid.substring(uid.length - 6)}`;

const getConversationId = (uid1: string, uid2: string) => {
    return [uid1, uid2].sort().join('_');
}

function MessageBubble({ message, isOwnMessage }: { message: WithId<Message>, isOwnMessage: boolean }) {
    return (
        <div className={cn("flex items-end gap-2", isOwnMessage ? "justify-end" : "justify-start")}>
            <div className={cn(
                "max-w-[70%] rounded-2xl px-4 py-2",
                isOwnMessage ? "bg-primary text-primary-foreground rounded-br-none" : "bg-secondary rounded-bl-none"
            )}>
                <p className="text-sm">{message.text}</p>
            </div>
        </div>
    );
}

function ChatHeader({ peerUser }: { peerUser: User | null }) {
    const router = useRouter();

    return (
        <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft />
            </Button>
            <div className="flex items-center gap-3 ml-2">
                <Avatar>
                    <AvatarFallback>{getInitials(peerUser?.name)}</AvatarFallback>
                </Avatar>
                <div>
                    <h2 className="text-base font-bold">{formatUserId(peerUser?.id ?? '')}</h2>
                </div>
            </div>
        </div>
    )
}

function MessageInput({ onSendMessage, conversation }: { onSendMessage: (text: string) => Promise<void>, conversation: WithId<Conversation> | null }) {
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const { firestore, user } = useFirebase();

    // Memoize the query to avoid re-running on every render
    const messagesQuery = useMemoFirebase(() => {
        if (!firestore || !conversation) return null;
        return query(collection(doc(collection(firestore, 'conversations'), conversation.id), 'messages'));
    }, [firestore, conversation]);

    const { data: sentMessages } = useCollection(messagesQuery);
    const messagesSentCount = sentMessages?.length ?? 0;

    const isRequest = conversation?.status === 'pending';
    const limitReached = isRequest && user?.uid === conversation.requesterId && messagesSentCount >= 3;
    const peerParticipant = conversation ? Object.values(conversation.participants).find(p => p.id !== user?.uid) : null;


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || isSending || limitReached) return;
        setIsSending(true);
        await onSendMessage(message);
        setMessage('');
        setIsSending(false);
    }
    
    return (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t z-10 max-w-2xl mx-auto sm:px-4">
            {isRequest && user?.uid === conversation?.requesterId && peerParticipant && (
                 <div className="p-3 text-center text-xs bg-secondary text-secondary-foreground">
                    <p><b>Send a message request to {formatUserId(peerParticipant.id)}</b></p>
                    <p className="text-secondary-foreground/80">You can send up to {3 - messagesSentCount} more messages before they accept your request.</p>
                 </div>
            )}
            <div className="p-4">
                <form onSubmit={handleSubmit} className="flex items-center space-x-3">
                    <Input 
                        placeholder={limitReached ? "Wait for a response..." : "Send a message..."}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="flex-1 rounded-full bg-secondary h-11"
                        disabled={isSending || limitReached}
                    />
                    <Button type="submit" size="icon" className="rounded-full h-11 w-11" disabled={isSending || !message.trim() || limitReached}>
                        <Send />
                    </Button>
                </form>
            </div>
        </div>
    )
}


export default function ConversationPage() {
    const params = useParams();
    const peerId = params.peerId as string;
    const { firestore, user: currentUser } = useFirebase();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const {data: peerUser, isLoading: peerUserLoading} = useDoc<User>(firestore && peerId ? doc(firestore, 'users', peerId) : null);
    
    const conversationId = useMemo(() => {
        if (!currentUser || !peerId) return null;
        return getConversationId(currentUser.uid, peerId);
    }, [currentUser, peerId]);
    
    const conversationRef = useMemoFirebase(() => {
        if (!firestore || !conversationId) return null;
        return doc(firestore, 'conversations', conversationId);
    }, [firestore, conversationId]);

    const {data: conversation, isLoading: isConversationLoading} = useDoc<Conversation>(conversationRef);

    const messagesQuery = useMemoFirebase(() => {
        if (!firestore || !conversation) return null;
        return query(
            collection(firestore, 'conversations', conversation.id, 'messages'),
            orderBy('timestamp', 'asc')
        );
    }, [firestore, conversation]);

    const { data: messages, isLoading: messagesLoading } = useCollection<Message>(messagesQuery);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);


    const handleSendMessage = async (text: string) => {
        if (!firestore || !currentUser || !peerUser || !conversationId) return;
        
        const conversationDocRef = doc(firestore, 'conversations', conversationId);

        try {
            const conversationDoc = await getDoc(conversationDocRef);
            const batch = writeBatch(firestore);

            if (!conversationDoc.exists()) {
                // Create conversation if it doesn't exist
                const newConversationData: Omit<Conversation, 'id'> = {
                    participantIds: [currentUser.uid, peerId].sort(),
                    participants: {
                        [currentUser.uid]: { id: currentUser.uid, name: currentUser.displayName || "Anonymous" },
                        [peerId]: { id: peerUser.id, name: peerUser.name || "Anonymous" },
                    },
                    lastMessage: null,
                    status: 'pending',
                    requesterId: currentUser.uid,
                };
                batch.set(conversationDocRef, {...newConversationData, id: conversationId });
            }

            // Add the new message
            const messageCollectionRef = collection(conversationDocRef, 'messages');
            const newMessageRef = doc(messageCollectionRef);
            
            const newMessageData = {
                id: newMessageRef.id,
                conversationId: conversationId,
                senderId: currentUser.uid,
                text,
                timestamp: serverTimestamp(),
            };

            const lastMessageData = {
                text,
                timestamp: serverTimestamp(),
                senderId: currentUser.uid,
            };

            batch.set(newMessageRef, newMessageData);
            batch.update(conversationDocRef, { lastMessage: lastMessageData });

            await batch.commit();

        } catch (err) {
             errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: conversationDocRef.path,
                operation: 'write', // Generic write operation for batch
            }))
        }
    }

    const conversationExists = conversation !== null;
    const isAccepted = conversation?.status === 'accepted';
    const amIRequester = conversation?.requesterId === currentUser?.uid;

    if (isConversationLoading || peerUserLoading) {
         return (
             <AppLayout showTopBar={false} showBottomNav={false}>
                <ChatHeader peerUser={null} />
                <div className="pt-14 pb-40 px-4 space-y-4">
                   <Skeleton className="h-10 w-3/4 rounded-2xl" />
                   <Skeleton className="h-16 w-1/2 rounded-2xl self-end ml-auto" />
                   <Skeleton className="h-10 w-2/3 rounded-2xl" />
                </div>
             </AppLayout>
         )
    }

    return (
        <AppLayout showTopBar={false} showBottomNav={false}>
            <ChatHeader peerUser={peerUser} />
            <div className="pt-14 pb-40 px-4 space-y-4">
                 {(isAccepted || amIRequester || (conversationExists && messages && messages.length > 0)) && messages?.map(msg => (
                     <MessageBubble key={msg.id} message={msg} isOwnMessage={msg.senderId === currentUser?.uid} />
                 ))}
                 
                {!conversationExists && (
                     <div className="text-center pt-20 text-muted-foreground">
                        <p>Start the conversation.</p>
                    </div>
                )}
                 
                {conversationExists && conversation.status === 'pending' && !amIRequester && (!messages || messages.length === 0) && (
                     <div className="text-center pt-20 text-muted-foreground">
                        <p>Accept the request to see the message.</p>
                    </div>
                )}

                 <div ref={messagesEndRef} />
            </div>

            {(isAccepted || !conversationExists || amIRequester ) && (
                 <MessageInput onSendMessage={handleSendMessage} conversation={conversation} />
            )}
        </AppLayout>
    )
}

    