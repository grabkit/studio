

"use client";

import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, setDoc, serverTimestamp, updateDoc, writeBatch, increment, deleteDoc, getDoc } from 'firebase/firestore';
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import React, { useMemo, useEffect, useRef, useState } from 'react';

import AppLayout from '@/components/AppLayout';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Send, Reply, Forward, Copy, Trash2, X, Heart, MessageCircle, ExternalLink } from 'lucide-react';
import { cn, getInitials, formatMessageTimestamp, formatLastSeen, formatTimestamp } from '@/lib/utils';
import type { Conversation, Message, User, Post } from '@/lib/types';
import { WithId } from '@/firebase/firestore/use-collection';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { usePresence } from '@/hooks/usePresence';
import Link from 'next/link';

const messageFormSchema = z.object({
  text: z.string().min(1, "Message cannot be empty").max(1000),
});

const formatUserId = (uid: string | undefined) => {
    if (!uid) return "blur??????";
    return `blur${uid.substring(uid.length - 6)}`;
};

function PostPreviewCard({ postId }: { postId: string }) {
    const { firestore } = useFirebase();
    const postRef = useMemoFirebase(() => doc(firestore, 'posts', postId), [firestore, postId]);
    const { data: post, isLoading } = useDoc<Post>(postRef);

    if (isLoading) {
        return <Skeleton className="h-24 w-full rounded-lg" />;
    }

    if (!post) {
        return (
            <div className="p-3 border rounded-lg text-center text-sm text-muted-foreground">
                This post is no longer available.
            </div>
        );
    }
    
    return (
        <div className="block border rounded-lg overflow-hidden transition-colors bg-secondary/20 hover:bg-secondary/50">
            <div className="p-3">
                <div className="flex items-center gap-2 mb-2">
                    <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">{getInitials(post.authorId)}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-semibold text-foreground">{formatUserId(post.authorId)}</span>
                </div>
                <p className="text-sm line-clamp-3 text-foreground">{post.content}</p>
                 <div className="flex items-center gap-4 text-xs mt-2 text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {post.likeCount}
                    </div>
                     <div className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {post.commentCount}
                    </div>
                </div>
            </div>
        </div>
    )
}


function MessageBubble({ message, isOwnMessage, conversationId, onSetReply }: { message: WithId<Message>, isOwnMessage: boolean, conversationId: string, onSetReply: (message: WithId<Message>) => void }) {
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const router = useRouter();

    const handleCopy = () => {
        navigator.clipboard.writeText(message.text);
        toast({ title: "Copied to clipboard" });
    }

    const handleUnsend = () => {
        if (!firestore || !isOwnMessage) return;

        const messageRef = doc(firestore, 'conversations', conversationId, 'messages', message.id);
        deleteDoc(messageRef).catch(serverError => {
            const permissionError = new FirestorePermissionError({
                path: messageRef.path,
                operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
             toast({
                variant: "destructive",
                title: "Error",
                description: "Could not unsend message.",
            });
        });
    }

    const handleOpenPost = () => {
        if (message.postId) {
            router.push(`/post/${message.postId}`);
        }
    }
    
    const isPostShare = !!message.postId;

    return (
        <div className={cn("flex items-end gap-2 group", isOwnMessage ? "justify-end" : "justify-start")}>
             <div className={cn(
                "flex items-center max-w-[70%]",
                isOwnMessage ? "flex-row-reverse" : "flex-row"
            )}>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <div className="cursor-pointer">
                        {isPostShare && message.postId ? (
                            <div onClick={(e) => e.preventDefault()}>
                                <PostPreviewCard postId={message.postId} />
                            </div>
                        ) : (
                        <div 
                            className={cn(
                                "max-w-fit rounded-2xl px-3 py-2",
                                isOwnMessage ? "bg-primary text-primary-foreground rounded-br-none" : "bg-secondary rounded-bl-none"
                            )}
                        >
                            {message.replyToMessageText && (
                                <div className={cn(
                                    "p-2 rounded-md mb-2",
                                    isOwnMessage ? "bg-black/10" : "bg-black/5"
                                )}>
                                    <p className="text-xs font-semibold truncate">{formatUserId(message.replyToMessageId === message.senderId ? message.senderId : undefined)}</p>
                                    <p className="text-xs opacity-80 whitespace-pre-wrap break-words">{message.replyToMessageText}</p>
                                </div>
                            )}

                            <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                            
                            {message.timestamp?.toDate && (
                                <p className={cn("text-xs mt-1 text-right", isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground")}>
                                    {formatMessageTimestamp(message.timestamp.toDate())}
                                </p>
                            )}
                        </div>
                        )}
                        </div>
                    </DropdownMenuTrigger>
                     <DropdownMenuContent align={isOwnMessage ? "end" : "start"} className="w-56">
                        {isPostShare ? (
                            <>
                                <DropdownMenuItem onClick={handleOpenPost}>
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    <span>Open Post</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onSetReply(message)}>
                                    <Reply className="mr-2 h-4 w-4" />
                                    <span>Reply</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                    <Forward className="mr-2 h-4 w-4" />
                                    <span>Forward</span>
                                </DropdownMenuItem>
                            </>
                        ) : (
                            <>
                                <DropdownMenuItem onClick={() => onSetReply(message)}>
                                    <Reply className="mr-2 h-4 w-4" />
                                    <span>Reply</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                    <Forward className="mr-2 h-4 w-4" />
                                    <span>Forward</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={handleCopy}>
                                    <Copy className="mr-2 h-4 w-4" />
                                    <span>Copy</span>
                                </DropdownMenuItem>
                            </>
                        )}
                        {isOwnMessage && (
                            <DropdownMenuItem className="text-destructive" onClick={handleUnsend}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                <span>Unsend</span>
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )
}

function ChatHeader({ peerId }: { peerId: string }) {
    const router = useRouter();
    const { firestore } = useFirebase();
    const { isOnline, lastSeen } = usePresence(peerId);


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
                <Link href={`/profile/${peerId}`}>
                    <Avatar className="h-8 w-8">
                        <AvatarFallback>{isLoading || !peerUser ? <Skeleton className="h-8 w-8 rounded-full" /> : getInitials(formatUserId(peerId))}</AvatarFallback>
                    </Avatar>
                </Link>
                <div>
                     <h2 className="text-base font-bold leading-tight">
                        {isLoading || !peerUser ? <Skeleton className="h-5 w-24" /> : formatUserId(peerId)}
                    </h2>
                    <p className="text-xs text-muted-foreground leading-tight">
                        {isOnline ? "Online" : formatLastSeen(lastSeen)}
                    </p>
                </div>
            </div>
        </div>
    )
}

function ChatMessages({ conversationId, conversation, onSetReply, replyingTo }: { conversationId: string, conversation: WithId<Conversation> | null, onSetReply: (message: WithId<Message>) => void, replyingTo: WithId<Message> | null }) {
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
        if (lastMessage.senderId !== user.uid) return null; 

        const peerId = conversation.participantIds.find(id => id !== user.uid);
        if (!peerId) return null;
        
        const peerLastReadTimestamp = conversation.lastReadTimestamps?.[peerId]?.toDate();
        const lastMessageTimestamp = lastMessage.timestamp?.toDate();

        if (peerLastReadTimestamp && lastMessageTimestamp && peerLastReadTimestamp >= lastMessageTimestamp) {
             return 'Seen';
        }
        
        return null;

    }, [messages, conversation, user]);


    React.useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
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
                    <MessageBubble key={message.id} message={message} isOwnMessage={message.senderId === user?.uid} conversationId={conversationId} onSetReply={onSetReply} />
                ))}
            </div>
             <div ref={messagesEndRef} />
             {seenStatus && (
                <div className="text-right text-xs text-muted-foreground pr-2 pt-1">
                    {seenStatus}
                </div>
            )}
            <div className={cn(replyingTo ? "h-24" : "h-14")} />
        </div>
    )
}


function MessageInput({ conversationId, conversation, replyingTo, onCancelReply }: { conversationId: string, conversation: WithId<Conversation> | null, replyingTo: WithId<Message> | null, onCancelReply: () => void }) {
    const { firestore, user } = useFirebase();
    const form = useForm<z.infer<typeof messageFormSchema>>({
        resolver: zodResolver(messageFormSchema),
        defaultValues: { text: "" },
    });

    const onSubmit = (values: z.infer<typeof messageFormSchema>) => {
        if (!firestore || !user || !conversationId || !conversation) return;

        form.reset();
        onCancelReply();
        
        const peerId = conversation.participantIds.find(id => id !== user.uid);
        if (!peerId) return;

        const messageRef = doc(collection(firestore, 'conversations', conversationId, 'messages'));
        const conversationRef = doc(firestore, 'conversations', conversationId);

        const newMessage: Omit<Message, 'timestamp' | 'id'> & { id?: string, replyToMessageId?: string, replyToMessageText?: string } = {
            id: messageRef.id,
            senderId: user.uid,
            text: values.text,
        };

        if (replyingTo) {
            newMessage.replyToMessageId = replyingTo.id;
            newMessage.replyToMessageText = replyingTo.text;
        }
        
        const batch = writeBatch(firestore);
        
        batch.set(messageRef, { ...newMessage, timestamp: serverTimestamp() });
        
        const updatePayload: any = {
            lastMessage: values.text,
            lastUpdated: serverTimestamp(),
            [`unreadCounts.${peerId}`]: increment(1)
        };
        
        batch.update(conversationRef, updatePayload);

        batch.commit().catch(error => {
             const permissionError = new FirestorePermissionError({
                path: conversationRef.path,
                operation: 'update',
                requestResourceData: { message: newMessage, conversationUpdate: updatePayload },
            });
            errorEmitter.emit('permission-error', permissionError);
        });
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
            {replyingTo && (
                <div className="p-2 border-b border-dashed bg-secondary/50 text-sm">
                    <div className="flex justify-between items-center">
                        <div>
                            <p className="font-semibold text-primary">Replying to {replyingTo.senderId === user?.uid ? 'yourself' : formatUserId(replyingTo.senderId)}</p>
                            <p className="text-muted-foreground truncate max-w-xs">{replyingTo.text}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onCancelReply}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
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
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            form.handleSubmit(onSubmit)();
                                        }
                                    }}
                                />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <Button type="submit" size="icon" disabled={form.formState.isSubmitting} className="bg-primary hover:bg-primary/90 rounded-full">
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
    const router = useRouter();
    const peerId = params.peerId as string;
    const [replyingTo, setReplyingTo] = useState<WithId<Message> | null>(null);

    const handleSetReply = (message: WithId<Message>) => {
        setReplyingTo(message);
    }
    
    const handleCancelReply = () => {
        setReplyingTo(null);
    }

    const conversationId = useMemo(() => {
        if (!user || !peerId) return null;
        return [user.uid, peerId].sort().join('_');
    }, [user, peerId]);
    
    const conversationRef = useMemoFirebase(() => {
        if (!firestore || !conversationId) return null;
        return doc(firestore, 'conversations', conversationId);
    }, [firestore, conversationId]);

    const { data: conversation, isLoading: isConversationLoading } = useDoc<Conversation>(conversationRef);

    const userUnreadCount = conversation?.unreadCounts?.[user?.uid ?? ''] ?? 0;

    useEffect(() => {
        if (!firestore || !user || !conversationRef || userUnreadCount === 0) {
            return;
        }

        const updates: any = {
            [`unreadCounts.${user.uid}`]: 0,
            [`lastReadTimestamps.${user.uid}`]: serverTimestamp()
        };
        
        updateDoc(conversationRef, updates).catch(error => {
            console.warn("Could not mark messages as read:", error.message);
        });

    }, [userUnreadCount, conversationRef, firestore, user]);

    if (!user || isConversationLoading) {
      return (
        <AppLayout showTopBar={false} showBottomNav={false}>
          <ChatHeader peerId={peerId} />
          <div className="pt-14">
            <div className="space-y-4 p-4">
                <Skeleton className="h-10 w-3/5" />
                <Skeleton className="h-10 w-3/5 ml-auto" />
                <Skeleton className="h-16 w-4/5" />
            </div>
          </div>
        </AppLayout>
      )
    }


    return (
        <AppLayout showTopBar={false} showBottomNav={false}>
            <ChatHeader peerId={peerId} />

            <div className="pt-14">
                {conversationId && <ChatMessages conversationId={conversationId} conversation={conversation} onSetReply={handleSetReply} replyingTo={replyingTo} />}
            </div>

            {conversationId && <MessageInput conversationId={conversationId} conversation={conversation} replyingTo={replyingTo} onCancelReply={handleCancelReply} />}
        </AppLayout>
    )
}
