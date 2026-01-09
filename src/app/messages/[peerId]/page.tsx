
"use client";

import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, setDoc, serverTimestamp, updateDoc, writeBatch, increment, deleteDoc, getDoc, where } from "firebase/firestore";
import { useCollection } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useForm } from 'react-hook-form';
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import React, { useMemo, useEffect, useRef, useState } from 'react';
import { isSameDay } from 'date-fns';
import { motion } from "framer-motion";


import AppLayout from '@/components/AppLayout';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Send, Reply, Forward, Copy, Trash2, X, Heart, MessageCircle, ExternalLink, Phone, Video, Loader2, List } from 'lucide-react';
import { cn, getAvatar, formatMessageTimestamp, formatLastSeen, formatTimestamp, formatUserId, formatDateSeparator } from '@/lib/utils';
import type { Conversation, Message, User, Post, LinkMetadata } from '@/lib/types';
import { WithId } from '@/firebase/firestore/use-collection';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';
import { usePresence } from '@/hooks/usePresence';
import Link from 'next/link';
import { ForwardSheet } from '@/components/ForwardSheet';
import { LinkPreviewCard } from '@/components/LinkPreviewCard';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';


const messageFormSchema = z.object({
  text: z.string().max(1000).optional(),
  linkMetadata: z.custom<LinkMetadata>().optional(),
}).refine(data => !!data.text || !!data.linkMetadata, {
    message: "Message cannot be empty",
    path: ["text"],
});

function PostPreviewCard({ postId }: { postId: string }) {
    const { firestore } = useFirebase();
    const router = useRouter();
    const postRef = useMemoFirebase(() => doc(firestore, 'posts', postId), [firestore, postId]);
    const { data: post, isLoading } = useDoc<Post>(postRef);

    if (isLoading) {
        return <Skeleton className="h-24 w-full rounded-[10px] bg-secondary" />;
    }

    if (!post) {
        return (
            <div className="p-3 border rounded-[10px] text-center text-sm text-muted-foreground bg-secondary/50">
                This post is no longer available.
            </div>
        );
    }
    
    return (
        <div className="block border rounded-[10px] overflow-hidden bg-secondary/80 w-full cursor-pointer">
            <div className="p-3">
                <div className="flex items-center gap-2 mb-2">
                    <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">{getAvatar({id: post.authorId})}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-semibold">{formatUserId(post.authorId)}</span>
                </div>
                <p className="text-sm line-clamp-3 text-foreground">{post.content}</p>

                {post.type === 'poll' && post.pollOptions && (
                    <div className="mt-2 space-y-1.5">
                        {post.pollOptions.map((option, index) => (
                            <div key={index} className="flex items-center gap-2 text-sm text-muted-foreground bg-background/50 p-1.5 rounded-md">
                                <List className="h-4 w-4" />
                                <span>{option.option}</span>
                            </div>
                        ))}
                    </div>
                )}
                 
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


function MessageBubble({ message, isOwnMessage, conversation, onSetReply, onForward }: { message: WithId<Message>, isOwnMessage: boolean, conversation: WithId<Conversation> | null, onSetReply: (message: WithId<Message>) => void, onForward: (message: WithId<Message>) => void }) {
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const router = useRouter();
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    const handleCopy = () => {
        if (message.text) {
            navigator.clipboard.writeText(message.text);
            toast({ title: "Copied to clipboard" });
        }
        setIsSheetOpen(false);
    }

    const handleUnsend = () => {
        if (!firestore || !isOwnMessage || !conversation) return;
        setIsSheetOpen(false);
        const messageRef = doc(firestore, 'conversations', conversation.id, 'messages', message.id);
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
        setIsSheetOpen(false);
    }
    
    const handleOpenLink = () => {
        if (message.linkMetadata?.url) {
            window.open(message.linkMetadata.url, '_blank', 'noopener,noreferrer');
        }
        setIsSheetOpen(false);
    }

    const handleReply = () => {
        onSetReply(message);
        setIsSheetOpen(false);
    }

    const handleForward = () => {
        onForward(message);
        setIsSheetOpen(false);
    }

    const isPostShare = !!message.postId;
    const isLinkShare = !!message.linkMetadata;
    
    const bubbleContent = (
         <>
            {message.isForwarded && (
                <div className="flex items-center gap-1.5 text-xs opacity-70 mb-1 px-3 pt-2">
                    <Forward className="h-3 w-3" />
                    <span>Forwarded</span>
                </div>
            )}

            {message.replyToMessageText && (
                <div className={cn(
                    "p-2 rounded-lg mb-1 mx-2 mt-1 w-auto",
                    !isOwnMessage ? "bg-gray-200 dark:bg-gray-700" :
                    "bg-blue-400"
                )}>
                    <p className="text-xs font-semibold truncate text-primary">{formatUserId(message.replyToMessageId === message.senderId ? message.senderId : undefined)}</p>
                    <p className="text-sm opacity-80 line-clamp-2">{message.replyToMessageText}</p>
                </div>
            )}

            {isPostShare && message.postId ? (
                <div className="w-full my-1 px-2">
                    <SheetTrigger asChild>
                         <div className="cursor-pointer">
                            <PostPreviewCard postId={message.postId} />
                        </div>
                    </SheetTrigger>
                </div>
            ) : isLinkShare && message.linkMetadata ? (
                <div className="w-full my-1 px-2">
                    <SheetTrigger asChild>
                         <div className="cursor-pointer">
                            <LinkPreviewCard metadata={message.linkMetadata} />
                        </div>
                    </SheetTrigger>
                </div>
            ) : null}

            {message.text && (
                 <p className="px-3 py-1.5 text-base break-words whitespace-pre-wrap max-w-full">{message.text}</p>
            )}

             <p className={cn(
                "text-[11px] mt-1 self-end px-3 pb-1.5", 
                isOwnMessage ? "text-white/70" : "text-muted-foreground"
             )}>
                {message.timestamp?.toDate ? formatMessageTimestamp(message.timestamp.toDate()) : '...'}
             </p>
        </>
    );


    return (
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
             <div className={cn(
                "group flex",
                isOwnMessage ? "justify-end" : "justify-start",
             )}>
                <div className={cn(
                    "flex flex-col rounded-2xl",
                    isOwnMessage ? "bg-blue-500 text-white" : "bg-secondary text-foreground",
                    isOwnMessage ? "rounded-br-none" : "rounded-bl-none",
                     (isPostShare || isLinkShare) ? 'w-64' : 'max-w-[80%]',
                )}>
                    <SheetTrigger asChild>
                         <div>
                           {bubbleContent}
                        </div>
                    </SheetTrigger>
                </div>
            </div>
             <SheetContent side="bottom" className="rounded-t-2xl">
                <SheetHeader className="sr-only">
                    <SheetTitle>Message Options</SheetTitle>
                </SheetHeader>
                <div className="grid gap-2 py-4">
                    <div className="border rounded-2xl">
                        {isPostShare && (
                            <Button variant="ghost" className="justify-start text-base py-6 rounded-2xl w-full gap-3" onClick={handleOpenPost}>
                                <ExternalLink />
                                <span>Open Post</span>
                            </Button>
                        )}
                        {isLinkShare && (
                            <Button variant="ghost" className="justify-start text-base py-6 rounded-2xl w-full gap-3" onClick={handleOpenLink}>
                                <ExternalLink />
                                <span>Open Link</span>
                            </Button>
                        )}
                        <Button variant="ghost" className="justify-start text-base py-6 rounded-2xl w-full gap-3" onClick={handleReply}>
                            <Reply />
                            <span>Reply</span>
                        </Button>
                         <div className="border-t"></div>
                        <Button variant="ghost" className="justify-start text-base py-6 rounded-2xl w-full gap-3" onClick={handleForward}>
                            <Forward />
                            <span>Forward</span>
                        </Button>
                         {!isPostShare && !isLinkShare && (
                             <>
                                <div className="border-t"></div>
                                <Button variant="ghost" className="justify-start text-base py-6 rounded-2xl w-full gap-3" onClick={handleCopy}>
                                    <Copy />
                                    <span>Copy</span>
                                </Button>
                             </>
                        )}
                    </div>
                     {isOwnMessage && (
                        <div className="border rounded-2xl">
                            <Button variant="ghost" className="justify-start text-base py-6 rounded-2xl w-full text-destructive hover:text-destructive gap-3" onClick={handleUnsend}>
                                <Trash2 />
                                <span>Unsend</span>
                            </Button>
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    )
}

function ChatHeader({ peerId, peerUser, onStartCall, onStartVideoCall, conversation }: { peerId: string, peerUser: WithId<User> | null, onStartCall: () => void, onStartVideoCall: () => void, conversation: WithId<Conversation> | null }) {
    const router = useRouter();
    const { user: currentUser } = useFirebase();
    const { isOnline, lastSeen } = usePresence(peerId);

    const isLoading = !peerUser;

    const isVideoDisabledByPeer = useMemo(() => {
        return conversation?.videoCallsDisabledBy?.includes(peerId) || false;
    }, [conversation, peerId]);

    const isVoiceDisabledByPeer = useMemo(() => {
        return conversation?.voiceCallsDisabledBy?.includes(peerId) || false;
    }, [conversation, peerId]);
    
    return (
        <div 
            className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background/80 backdrop-blur-sm border-b h-14 max-w-2xl mx-auto sm:px-4"
        >
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); router.back(); }}>
                <ArrowLeft />
            </Button>
            <div className="flex-1 flex items-center gap-3 ml-2 cursor-pointer" onClick={() => router.push(`/messages/${peerId}/settings`)}>
                <div onClick={(e) => { e.stopPropagation(); router.push(`/profile/${peerId}`); }}>
                    <Avatar className="h-8 w-8">
                        <AvatarFallback>{isLoading ? <Skeleton className="h-8 w-8 rounded-full" /> : getAvatar(peerUser)}</AvatarFallback>
                    </Avatar>
                </div>
                <div>
                    <h2 className="text-base font-bold leading-tight">
                        {isLoading ? <Skeleton className="h-5 w-24" /> : formatUserId(peerId)}
                    </h2>
                    <p className="text-xs text-muted-foreground leading-tight">
                        {isOnline ? "Online" : formatLastSeen(lastSeen)}
                    </p>
                </div>
            </div>
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onStartVideoCall(); }} disabled={isVideoDisabledByPeer}>
                <Video />
            </Button>
            <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onStartCall(); }} disabled={isVoiceDisabledByPeer}>
                <Phone />
            </Button>
        </div>
    )
}

function ChatMessages({ conversationId, conversation, onSetReply, onForward }: { conversationId: string, conversation: WithId<Conversation> | null, onSetReply: (message: WithId<Message>) => void, onForward: (message: WithId<Message>) => void }) {
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
        setTimeout(() => messagesEndRef.current?.scrollIntoView(), 0);
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

    const messagesWithSeparators = messages?.reduce((acc: (WithId<Message> | { type: 'separator', date: Date })[], message, index) => {
        const currentDate = message.timestamp?.toDate();
        const prevMessage = messages[index - 1];
        const prevDate = prevMessage?.timestamp?.toDate();
        
        if (currentDate && (!prevDate || !isSameDay(currentDate, prevDate))) {
            acc.push({ type: 'separator', date: currentDate });
        }
        acc.push(message);
        return acc;
    }, []);

    return (
        <div className="p-4">
            <div className="space-y-2">
                {messagesWithSeparators?.map((item, index) => {
                    if (item.type === 'separator') {
                        return (
                            <div key={`sep-${index}`} className="flex justify-center my-4">
                                <div className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-full">
                                    {formatDateSeparator(item.date)}
                                </div>
                            </div>
                        )
                    }
                    const message = item as WithId<Message>;
                    return <MessageBubble key={message.id} message={message} isOwnMessage={message.senderId === user?.uid} conversation={conversation} onSetReply={onSetReply} onForward={onForward} />
                })}
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

function MessageInput({ conversationId, conversation, replyingTo, onCancelReply }: { conversationId: string, conversation: WithId<Conversation> | null, replyingTo: WithId<Message> | null, onCancelReply: () => void }) {
    const { firestore, user } = useFirebase();
    const { toast } = useToast();
    const [isFetchingPreview, setIsFetchingPreview] = useState(false);

    const form = useForm<z.infer<typeof messageFormSchema>>({
        resolver: zodResolver(messageFormSchema),
        defaultValues: { text: "" },
    });

    const linkMetadata = form.watch("linkMetadata");
    const textValue = form.watch("text");
    
    const fetchPreview = async (url: string) => {
        setIsFetchingPreview(true);
        // In a real app, you would call your AI flow here.
        // For now, we'll simulate a delay and use mock data.
        setTimeout(() => {
            const mockData: LinkMetadata = {
                url: url,
                title: "This is a fetched link title for messages",
                description: "This is a longer description for the link that has been fetched from the website to show a rich preview.",
                imageUrl: `https://picsum.photos/seed/${Math.random()}/1200/630`,
            };
            form.setValue("linkMetadata", mockData, { shouldValidate: true });
            setIsFetchingPreview(false);
        }, 1500);
    };

    const handlePaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
        if (linkMetadata) return;

        const pastedText = event.clipboardData.getData('text');
        try {
            const url = new URL(pastedText);
            form.setValue("text", pastedText); // Also set the text value
            event.preventDefault();
            await fetchPreview(url.href);
        } catch (error) {
            // Not a valid URL, do nothing
        }
    };


    const onSubmit = (values: z.infer<typeof messageFormSchema>) => {
        if (!firestore || !user || !conversationId || !conversation) return;

        const peerId = conversation.participantIds.find(id => id !== user.uid);
        if (!peerId) return;

        const messageRef = doc(collection(firestore, 'conversations', conversationId, 'messages'));
        const conversationRef = doc(firestore, 'conversations', conversationId);

        const newMessage: Partial<Message> = {
            id: messageRef.id,
            senderId: user.uid,
        };
        
        // Clean up undefined values before sending to Firestore
        if (values.text) {
            newMessage.text = values.text;
        }
        if (values.linkMetadata) {
            newMessage.linkMetadata = values.linkMetadata;
        } else {
             delete (newMessage as any).linkMetadata;
        }


        if (replyingTo) {
            (newMessage as any).replyToMessageId = replyingTo.id;
            (newMessage as any).replyToMessageText = replyingTo.text;
        }
        
        let lastMessageText = "Sent a link";
        if(values.text) {
            lastMessageText = values.text;
        }

        const batch = writeBatch(firestore);
        
        batch.set(messageRef, { ...newMessage, timestamp: serverTimestamp() });
        
        const updatePayload: any = {
            lastMessage: lastMessageText,
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

        form.reset();
        onCancelReply();
    }
    
    if (conversation && conversation.status !== 'accepted') {
        return (
             <div className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-background border-t">
                <div className="p-4 text-center text-sm text-muted-foreground">
                    The user has not accepted your message request yet.
                </div>
            </div>
        )
    }

    return (
         <div className={cn("fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-background border-t", replyingTo ? "pb-0" : "pb-safe")}>
            {replyingTo && (
                <div className="p-2 border-b bg-secondary/50 text-sm">
                    <div className="flex justify-between items-center px-2">
                        <div className="flex-1 overflow-hidden">
                            <p className="font-semibold text-primary">Replying to {replyingTo.senderId === user?.uid ? 'yourself' : formatUserId(replyingTo.senderId)}</p>
                            <p className="text-muted-foreground truncate">{replyingTo.text}</p>
                        </div>
                        <Button variant="ghost" size="icon" onClick={onCancelReply}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
             {isFetchingPreview && (
                <div className="p-2 border-b flex items-center justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mr-2" />
                    <span className="text-sm text-muted-foreground">Fetching link preview...</span>
                </div>
            )}
            {linkMetadata && (
                <div className="p-2 border-b relative">
                    <p className="text-xs text-muted-foreground mb-1">Link attached:</p>
                    <LinkPreviewCard metadata={linkMetadata} />
                    <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6 rounded-full" onClick={() => form.setValue('linkMetadata', undefined)}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            )}
            <div className="p-2 flex items-center gap-2">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex items-center rounded-full bg-secondary px-2">
                         <Textarea
                            placeholder="Message..."
                            className="flex-1 bg-transparent border-none focus-visible:ring-0 shadow-none resize-none text-base px-2 py-2.5"
                            rows={1}
                            maxRows={5}
                            onPaste={handlePaste}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    form.handleSubmit(onSubmit)();
                                }
                            }}
                            {...form.register("text")}
                        />
                         <Button
                            type="submit"
                            size="icon"
                            disabled={form.formState.isSubmitting || (!textValue && !linkMetadata)}
                            className="rounded-full shrink-0 h-8 w-8 bg-black hover:bg-gray-800"
                        >
                            <Send className="h-4 w-4" fill="currentColor"/>
                        </Button>
                    </form>
                </Form>
            </div>
        </div>
    )
}

export default function ChatPage() {
    const { firestore, user, startCall, startVideoCall } = useFirebase();
    const params = useParams();
    const router = useRouter();
    const [replyingTo, setReplyingTo] = useState<WithId<Message> | null>(null);
    const [forwardingMessage, setForwardingMessage] = useState<WithId<Message> | null>(null);
    const [isForwardSheetOpen, setIsForwardSheetOpen] = useState(false);
    
    const peerId = params.peerId as string;

    const conversationId = useMemo(() => {
        if (!user || !peerId) return null;
        return [user.uid, peerId].sort().join('_');
    }, [user, peerId]);


    const handleSetReply = (message: WithId<Message>) => {
        setReplyingTo(message);
    }
    
    const handleCancelReply = () => {
        setReplyingTo(null);
    }

    const handleForward = (message: WithId<Message>) => {
        setForwardingMessage(message);
        setIsForwardSheetOpen(true);
    };

    const handleStartCall = () => {
        if (!peerId) return;
        startCall(peerId);
    }
    
    const handleStartVideoCall = () => {
        if (!peerId) return;
        startVideoCall(peerId);
    }

    const conversationRef = useMemoFirebase(() => {
        if (!firestore || !conversationId) return null;
        return doc(firestore, 'conversations', conversationId);
    }, [firestore, conversationId]);

    const peerUserRef = useMemoFirebase(() => {
        if (!firestore || !peerId) return null;
        return doc(firestore, 'users', peerId);
    }, [firestore, peerId]);

    const { data: conversation, isLoading: isConversationLoading } = useDoc<Conversation>(conversationRef);
    const { data: peerUser, isLoading: isPeerUserLoading } = useDoc<User>(peerUserRef);

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
    
    const isLoading = isConversationLoading || isPeerUserLoading;

    return (
        <AppLayout showTopBar={false} showBottomNav={false}>
            <motion.div
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                 className="flex flex-col h-screen"
            >
                <ChatHeader 
                    peerId={peerId} 
                    peerUser={peerUser} 
                    onStartCall={handleStartCall} 
                    onStartVideoCall={handleStartVideoCall} 
                    conversation={conversation} 
                />
                <div className="flex-1 overflow-y-auto pt-14 pb-40">
                    {isLoading ? (
                        <div className="space-y-4 p-4">
                            <Skeleton className="h-10 w-3/5" />
                            <Skeleton className="h-10 w-3/5 ml-auto" />
                            <Skeleton className="h-16 w-4/5" />
                        </div>
                    ) : (
                        conversationId && (
                            <ChatMessages 
                                conversationId={conversationId} 
                                conversation={conversation} 
                                onSetReply={handleSetReply} 
                                onForward={handleForward} 
                            />
                        )
                    )}
                </div>
                {conversationId && (
                    <MessageInput 
                        conversationId={conversationId} 
                        conversation={conversation} 
                        replyingTo={replyingTo} 
                        onCancelReply={handleCancelReply} 
                    />
                )}
                
                <ForwardSheet 
                    isOpen={isForwardSheetOpen}
                    onOpenChange={setIsForwardSheetOpen}
                    message={forwardingMessage}
                />
            </motion.div>
        </AppLayout>
    )
}
    

    




    

    



    

    

    

    



