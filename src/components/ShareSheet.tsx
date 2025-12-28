

"use client";

import React, { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useFirebase, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc, writeBatch, increment, serverTimestamp } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import type { Conversation, Post, User, Message } from '@/lib/types';
import { WithId } from '@/firebase/firestore/use-collection';
import { Avatar, AvatarFallback } from './ui/avatar';
import { getInitials, cn } from '@/lib/utils';
import { Skeleton } from './ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Link as LinkIcon, Share2, Send, Check } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

const formatUserId = (uid: string | undefined) => {
    if (!uid) return "blur??????";
    return `blur${uid.substring(uid.length - 6)}`;
};

function ConversationItem({ conversation, onSend, sentStatus }: { conversation: WithId<Conversation>, onSend: (conversation: WithId<Conversation>) => void, sentStatus: boolean }) {
    const { user: currentUser, firestore } = useFirebase();
    const otherParticipantId = conversation.participantIds.find(p => p !== currentUser?.uid);

    const otherUserRef = useMemoFirebase(() => {
        if (!firestore || !otherParticipantId) return null;
        return doc(firestore, 'users', otherParticipantId);
    }, [firestore, otherParticipantId]);
    const { data: otherUser } = useDoc<User>(otherUserRef);

    const name = otherUser ? formatUserId(otherUser.id) : <div className="font-semibold text-sm"><Skeleton className="h-4 w-24" /></div>;

    return (
        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary">
            <div className="flex items-center space-x-3">
                <Avatar className="h-10 w-10">
                    <AvatarFallback>{otherUser ? getInitials(formatUserId(otherUser.id)) : '?'}</AvatarFallback>
                </Avatar>
                <div>
                    <div className="font-semibold text-sm">{name}</div>
                    <p className="text-xs text-muted-foreground">{conversation.lastMessage ? `Last: ${conversation.lastMessage.substring(0, 20)}...` : 'No messages yet'}</p>
                </div>
            </div>
            <Button size="sm" variant={sentStatus ? "secondary" : "default"} onClick={() => onSend(conversation)} disabled={sentStatus}>
                {sentStatus ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            </Button>
        </div>
    )
}

export function ShareSheet({ post, isOpen, onOpenChange }: { post: WithId<Post>, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
    const { firestore, user } = useFirebase();
    const { toast } = useToast();
    const [sentConversations, setSentConversations] = useState<string[]>([]);
    
    const conversationsQuery = useMemoFirebase(() => {
        if (!user || !firestore) return null;
        return query(
            collection(firestore, 'conversations'),
            where('participantIds', 'array-contains', user.uid),
            where('status', '==', 'accepted')
        );
    }, [user, firestore]);
    const { data: conversations, isLoading } = useCollection<Conversation>(conversationsQuery);
    
    const handleSend = (conversation: WithId<Conversation>) => {
        if (!firestore || !user || !post) return;
        
        const peerId = conversation.participantIds.find(id => id !== user.uid);
        if (!peerId) return;

        const messageRef = doc(collection(firestore, 'conversations', conversation.id, 'messages'));
        const conversationRef = doc(firestore, 'conversations', conversation.id);
        
        const postUrl = `${window.location.origin}/post/${post.id}`;

        const newMessage: Omit<Message, 'timestamp' | 'id'> = {
            senderId: user.uid,
            text: `Check out this post`,
            postId: post.id,
        };

        const batch = writeBatch(firestore);
        
        batch.set(messageRef, { ...newMessage, timestamp: serverTimestamp() });
        
        const updatePayload: any = {
            lastMessage: "Shared a post",
            lastUpdated: serverTimestamp(),
            [`unreadCounts.${peerId}`]: increment(1)
        };
        
        batch.update(conversationRef, updatePayload);

        batch.commit()
            .then(() => {
                setSentConversations(prev => [...prev, conversation.id]);
                toast({ title: "Post Sent!" });
            })
            .catch(error => {
                const permissionError = new FirestorePermissionError({
                    path: conversationRef.path,
                    operation: 'update',
                    requestResourceData: { message: newMessage, conversationUpdate: updatePayload },
                });
                errorEmitter.emit('permission-error', permissionError);
                toast({ variant: 'destructive', title: "Error", description: "Could not send the post."});
            });
    }

    const handleCopyLink = () => {
        const postUrl = `${window.location.origin}/post/${post.id}`;
        navigator.clipboard.writeText(postUrl);
        toast({ title: "Link Copied!" });
    }

    const handleShareVia = async () => {
         const shareData = {
            title: `Post by ${formatUserId(post.authorId)}`,
            text: post.content,
            url: `${window.location.origin}/post/${post.id}`,
        };
        try {
            await navigator.share(shareData);
        } catch (error: any) {
            if (error.name === 'AbortError') {
                return; // User cancelled the share sheet
            }
            console.error("Error sharing:", error);
            toast({
                variant: "destructive",
                title: "Could not share",
                description: "There was an error trying to share this post.",
            });
        }
    }


    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="rounded-t-2xl p-4 flex flex-col h-[75dvh]">
                <SheetHeader className="text-center pb-2">
                    <SheetTitle>Share Post</SheetTitle>
                </SheetHeader>
                
                <div className="border rounded-xl">
                    <Button variant="ghost" className="w-full justify-start gap-3 text-base h-14" onClick={handleCopyLink}>
                        <LinkIcon /> Copy Link
                    </Button>
                     {navigator.share && (
                        <>
                            <div className="border-t w-[calc(100%-2rem)] mx-auto"></div>
                             <Button variant="ghost" className="w-full justify-start gap-3 text-base h-14" onClick={handleShareVia}>
                                <Share2 /> Share via...
                            </Button>
                        </>
                    )}
                </div>

                <p className="text-sm font-medium text-muted-foreground pt-4 pb-2">Send in a message</p>

                <ScrollArea className="flex-grow">
                    <div className="space-y-2 pr-2">
                        {isLoading && Array.from({ length: 3 }).map((_, i) => (
                             <div key={i} className="flex items-center justify-between p-2">
                                <div className="flex items-center space-x-3">
                                    <Skeleton className="h-10 w-10 rounded-full" />
                                    <div className="space-y-1">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-3 w-32" />
                                    </div>
                                </div>
                                 <Skeleton className="h-9 w-16 rounded-md" />
                            </div>
                        ))}
                        {conversations && conversations.length === 0 && !isLoading && (
                            <div className="text-center text-muted-foreground py-10">
                                <p>No one to send to yet.</p>
                                <p className="text-xs">Start a conversation to share posts.</p>
                            </div>
                        )}
                        {conversations?.map(convo => (
                            <ConversationItem 
                                key={convo.id} 
                                conversation={convo} 
                                onSend={handleSend}
                                sentStatus={sentConversations.includes(convo.id)}
                            />
                        ))}
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    )
}
