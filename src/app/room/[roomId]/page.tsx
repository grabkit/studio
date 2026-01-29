

'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, setDoc, serverTimestamp, updateDoc, arrayUnion, getDoc, deleteDoc, Timestamp, arrayRemove, increment, runTransaction } from 'firebase/firestore';
import { useCollection, WithId } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';

import AppLayout from '@/components/AppLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Send, Copy, Trash2, Forward, Reply, X, ExternalLink, MessageCircle, Heart, List, Loader2, Users, Tag, ChevronDown } from 'lucide-react';
import { cn, getAvatar, formatMessageTimestamp, formatUserId, formatDateSeparator, formatTimestamp } from '@/lib/utils';
import type { Room, RoomMessage, User, Post, LinkMetadata, Answer } from '@/lib/types';
import { isSameDay } from 'date-fns';
import { motion } from 'framer-motion';
import { usePresence } from '@/hooks/usePresence';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError, errorEmitter } from '@/firebase';
import { ForwardSheet } from '@/components/ForwardSheet';
import { LinkPreviewCard } from '@/components/LinkPreviewCard';
import UserList from '@/components/UserList';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogContent } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


const answerFormSchema = z.object({
  content: z.string().min(1, "Answer cannot be empty.").max(1000),
});

function AnswerItem({ answer, roomId, messageId }: { answer: WithId<Answer>, roomId: string, messageId: string }) {
    const { firestore, user } = useFirebase();
    const { toast } = useToast();
    const senderRef = useMemoFirebase(() => doc(firestore, 'users', answer.authorId), [firestore, answer.authorId]);
    const { data: sender } = useDoc<User>(senderRef);
    const avatar = getAvatar(sender);
    const isAvatarUrl = avatar.startsWith('http');
    const isOwner = user?.uid === answer.authorId;

    const handleDelete = async () => {
        if (!firestore || !user || !isOwner) return;

        const answerRef = doc(firestore, 'rooms', roomId, 'messages', messageId, 'answers', answer.id);
        const messageRef = doc(firestore, 'rooms', roomId, 'messages', messageId);

        try {
            await runTransaction(firestore, async (transaction) => {
                transaction.delete(answerRef);
                transaction.update(messageRef, { answerCount: increment(-1) });
            });
            toast({ title: 'Answer deleted' });
        } catch (error) {
            console.error("Error deleting answer:", error);
            const permissionError = new FirestorePermissionError({
                path: answerRef.path,
                operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not delete the answer.' });
        }
    };

    return (
        <div className="flex items-start gap-3 py-3">
            <Avatar size="sm">
                <AvatarImage src={isAvatarUrl ? avatar : undefined} />
                <AvatarFallback>{!isAvatarUrl ? avatar : ''}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{sender ? formatUserId(sender.id) : '...'}</p>
                    <p className="text-xs text-muted-foreground">{answer.timestamp ? formatTimestamp(answer.timestamp.toDate()) : ''}</p>
                </div>
                <p className="text-sm text-foreground">{answer.content}</p>
            </div>
             {isOwner && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={handleDelete}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            )}
        </div>
    );
}

function AnswersSheet({ isOpen, onOpenChange, room, message }: { isOpen: boolean, onOpenChange: (open: boolean) => void, room: WithId<Room>, message: WithId<RoomMessage> }) {
    const { firestore, user } = useFirebase();
    const { toast } = useToast();

    const answersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'rooms', room.id, 'messages', message.id, 'answers'),
            orderBy('timestamp', 'desc')
        );
    }, [firestore, room.id, message.id]);
    const { data: answers, isLoading } = useCollection<Answer>(answersQuery);

    const form = useForm<z.infer<typeof answerFormSchema>>({
        resolver: zodResolver(answerFormSchema),
        defaultValues: { content: "" },
    });

    const onSubmit = async (values: z.infer<typeof answerFormSchema>) => {
        if (!firestore || !user) return;

        const messageRef = doc(firestore, 'rooms', room.id, 'messages', message.id);
        const answerColRef = collection(messageRef, 'answers');

        const newAnswerData = {
            authorId: user.uid,
            content: values.content,
            timestamp: serverTimestamp(),
        };

        try {
            await runTransaction(firestore, async (transaction) => {
                const newAnswerRef = doc(answerColRef);
                transaction.set(newAnswerRef, { ...newAnswerData, id: newAnswerRef.id });
                transaction.update(messageRef, { answerCount: increment(1) });
            });
            form.reset();
        } catch (error) {
            console.error("Error submitting answer:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not submit your answer.' });
        }
    };
    
    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="h-[90dvh] flex flex-col p-0">
                <SheetHeader className="p-4 border-b">
                    <SheetTitle>Answers</SheetTitle>
                    <SheetDescription>
                        {message.text}
                    </SheetDescription>
                </SheetHeader>
                <ScrollArea className="flex-grow px-4">
                    {isLoading && <div className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>}
                    {!isLoading && answers?.length === 0 && <p className="text-center text-muted-foreground py-10">No answers yet. Be the first!</p>}
                    <div className="divide-y">
                        {answers?.map(answer => <AnswerItem key={answer.id} answer={answer} roomId={room.id} messageId={message.id} />)}
                    </div>
                </ScrollArea>
                <div className="p-2 border-t bg-background">
                     <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-center gap-2">
                             <FormField
                                control={form.control}
                                name="content"
                                render={({ field }) => (
                                    <FormItem className="flex-1">
                                        <FormControl>
                                            <Textarea
                                                placeholder="Write your answer..."
                                                className="bg-secondary rounded-full"
                                                rows={1}
                                                {...field}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" size="icon" className="rounded-full" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </Button>
                        </form>
                    </Form>
                </div>
            </SheetContent>
        </Sheet>
    );
}

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
        return <Skeleton className="h-24 w-full rounded-lg bg-secondary" />;
    }

    if (!post) {
        return (
            <div className="p-3 border rounded-lg text-center text-sm text-muted-foreground bg-secondary/50">
                This post is no longer available.
            </div>
        );
    }
    
    const avatar = getAvatar({id: post.authorId});
    const isAvatarUrl = avatar.startsWith('http');

    return (
        <div className="block rounded-[10px] overflow-hidden bg-secondary/80 w-full cursor-pointer">
            <div className="p-3">
                <div className="flex items-center gap-2 mb-2">
                    <Avatar className="h-6 w-6">
                         <AvatarImage src={isAvatarUrl ? avatar : undefined} alt={String(formatUserId(post.authorId))} />
                        <AvatarFallback className="text-xs">{!isAvatarUrl ? avatar : ''}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-semibold text-foreground">{formatUserId(post.authorId)}</span>
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

function ParticipantsSheet({ room, isOpen, onOpenChange }: { room: WithId<Room>, isOpen: boolean, onOpenChange: (open: boolean) => void}) {
    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="rounded-t-2xl p-0 h-[60dvh] flex flex-col">
                 <SheetHeader className="p-4 border-b text-center">
                    <SheetTitle>Participants</SheetTitle>
                </SheetHeader>
                <ScrollArea className="flex-grow">
                    <UserList userIds={room.participantIds} emptyTitle="No one's here" emptyDescription="Be the first to join the conversation." />
                </ScrollArea>
            </SheetContent>
        </Sheet>
    )
}

function RoomHeader({ room }: { room: WithId<Room> | null }) {
    const router = useRouter();
    const [isParticipantsSheetOpen, setIsParticipantsSheetOpen] = useState(false);

    if (!room) {
        return (
            <div className="flex items-center p-2 h-14">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <div className="ml-2">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-3 w-16 mt-1" />
                </div>
            </div>
        )
    }

    return (
        <>
            <div className="flex items-center p-2 h-14">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <div className="ml-2 flex-1">
                    <h2 className="text-base font-bold leading-tight">{room.name}</h2>
                    <p className="text-xs text-muted-foreground leading-tight">{room.participantIds.length} participants</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsParticipantsSheetOpen(true)}>
                    <Users />
                </Button>
            </div>
            <ParticipantsSheet room={room} isOpen={isParticipantsSheetOpen} onOpenChange={setIsParticipantsSheetOpen} />
        </>
    )
}

function RoomMessageBubble({ message, showAvatarAndName, onSetReply, onForward, room }: { message: WithId<RoomMessage>, showAvatarAndName: boolean, onSetReply: (message: WithId<RoomMessage>) => void, onForward: (message: WithId<RoomMessage>) => void, room: WithId<Room> | null }) {
    const { firestore, user: currentUser } = useFirebase();
    const router = useRouter();
    const isOwnMessage = message.senderId === currentUser?.uid;
    const { isOnline } = usePresence(message.senderId);
    const { toast } = useToast();
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [isAnswersSheetOpen, setIsAnswersSheetOpen] = useState(false);

    const senderRef = useMemoFirebase(() => doc(firestore, 'users', message.senderId), [firestore, message.senderId]);
    const { data: sender } = useDoc<User>(senderRef);
    
    const avatar = getAvatar(sender);
    const isAvatarUrl = avatar.startsWith('http');
    
    const handleCopy = () => {
        if (message.text) {
            navigator.clipboard.writeText(message.text);
            toast({ title: "Copied to clipboard" });
        }
        setIsSheetOpen(false);
    }

    const handleUnsend = () => {
        if (!firestore || !isOwnMessage || !room) return;
        setIsSheetOpen(false);
        const messageRef = doc(firestore, 'rooms', room.id, 'messages', message.id);
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

    const handleDeleteForMe = () => {
        if (!firestore || !room || !currentUser) return;
        setIsSheetOpen(false);
        const messageRef = doc(firestore, 'rooms', room.id, 'messages', message.id);
        updateDoc(messageRef, {
            deletedFor: arrayUnion(currentUser.uid)
        }).catch(serverError => {
            const permissionError = new FirestorePermissionError({
                path: messageRef.path,
                operation: 'update',
                requestResourceData: { deletedFor: arrayUnion(currentUser.uid) }
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Could not delete message for you.",
            });
        });
    };

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
        onForward(message as any); // Cast because ForwardSheet expects Message type
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
                    "relative pl-3 pr-2 py-1.5 rounded-[5px] mb-1 mx-2 mt-1 w-auto border-l-4",
                    !isOwnMessage 
                        ? "bg-gray-200 dark:bg-gray-700 border-gray-400 dark:border-gray-500" 
                        : "bg-white/20 border-white/40"
                )}>
                    <p className="text-xs font-semibold truncate">{formatUserId(message.replyToMessageId === message.senderId ? message.senderId : undefined)}</p>
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
                 <div className="flex flex-col">
                    <p className="px-3 py-1.5 text-base break-words whitespace-pre-wrap max-w-full">
                        {message.text}
                    </p>
                </div>
            )}
            
            <p className={cn(
                "text-[11px] self-end px-3 pb-1.5", 
                isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground",
                (isPostShare || isLinkShare) && !message.text ? 'pt-1.5' : ''
            )}>
                {message.timestamp?.toDate ? formatMessageTimestamp(message.timestamp.toDate()) : '...'}
            </p>
        </>
    );

    const bubbleAndButtonContainer = (
        <div className="inline-flex flex-col">
             <SheetTrigger asChild>
                <div className={cn(
                    "rounded-2xl max-w-[80vw] sm:max-w-md",
                    isOwnMessage ? "bg-primary text-primary-foreground rounded-br-none" : "bg-secondary text-foreground rounded-bl-none",
                    (isPostShare || isLinkShare) && 'w-64'
                )}>
                    {bubbleContent}
                </div>
            </SheetTrigger>
            {room?.id === 'ask_space' && (
                <Button className="mt-1 w-full justify-center items-center rounded-[10px] border bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-600 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-900/60 px-3 gap-1 h-auto py-1" onClick={() => setIsAnswersSheetOpen(true)}>
                    {message.answerCount > 0 && <span className="text-xs font-bold">{message.answerCount}</span>}
                    <span className="text-sm">Answers</span>
                    <ChevronDown className="h-4 w-4" />
                </Button>
            )}
         </div>
    );

    return (
        <>
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <div className={cn(
                "flex w-full",
                isOwnMessage ? "justify-end" : "justify-start",
            )}>
                <div className={cn(
                    "flex items-start gap-2",
                    isOwnMessage ? "flex-row-reverse" : "flex-row",
                )}>
                    {!isOwnMessage && showAvatarAndName && (
                        <Link href={`/profile/${message.senderId}`}>
                            <Avatar size="sm" showStatus={isOnline}>
                                <AvatarImage src={isAvatarUrl ? avatar : undefined} />
                                <AvatarFallback>{!isAvatarUrl ? avatar : ''}</AvatarFallback>
                            </Avatar>
                        </Link>
                    )}
                    <div className={cn(
                        "flex flex-col",
                        !isOwnMessage && !showAvatarAndName && "ml-10",
                        isOwnMessage ? 'items-end' : 'items-start'
                    )}>
                         {!isOwnMessage && showAvatarAndName && (
                            <Link href={`/profile/${message.senderId}`}>
                                <p className="text-xs font-semibold mb-0.5 text-muted-foreground hover:underline">{sender ? formatUserId(sender.id) : '...'}</p>
                            </Link>
                        )}
                        {bubbleAndButtonContainer}
                    </div>
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
                     <div className="border rounded-2xl">
                        {isOwnMessage && (
                             <>
                                <Button variant="ghost" className="justify-start text-base py-6 rounded-2xl w-full text-destructive hover:text-destructive gap-3" onClick={handleUnsend}>
                                    <Trash2 />
                                    <span>Unsend</span>
                                </Button>
                                <div className="border-t"></div>
                            </>
                        )}
                        <Button variant="ghost" className="justify-start text-base py-6 rounded-2xl w-full text-destructive hover:text-destructive gap-3" onClick={handleDeleteForMe}>
                            <Trash2 />
                            <span>Delete for you</span>
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
        {room && <AnswersSheet isOpen={isAnswersSheetOpen} onOpenChange={setIsAnswersSheetOpen} room={room} message={message} />}
        </>
    );
}

function RoomMessages({ messages, isLoading, emptyMessage, room, onSetReply, onForward }: { messages: WithId<RoomMessage>[] | null, isLoading: boolean, emptyMessage: React.ReactNode, room: WithId<Room> | null, onSetReply: (message: WithId<RoomMessage>) => void, onForward: (message: WithId<RoomMessage>) => void }) {
    const { user } = useFirebase();
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    const filteredMessages = useMemo(() => {
        if (!messages || !user) return [];
        return messages.filter(msg => !msg.deletedFor?.includes(user.uid));
    }, [messages, user]);

    useEffect(() => {
        setTimeout(() => messagesEndRef.current?.scrollIntoView(), 0);
    }, [filteredMessages]);

    if (isLoading) {
        return (
             <div className="space-y-4 p-4">
                <Skeleton className="h-10 w-3/5" />
                <Skeleton className="h-10 w-3/5 ml-auto" />
                <Skeleton className="h-16 w-4/5" />
            </div>
        )
    }
    
    if (filteredMessages.length === 0) {
        return <>{emptyMessage}</>;
    }


    const messagesWithSeparators = filteredMessages?.reduce((acc: (WithId<RoomMessage> | { type: 'separator', date: Date })[], message, index) => {
        const currentDate = message.timestamp?.toDate();
        const prevMessage = filteredMessages[index - 1];
        const prevDate = prevMessage?.timestamp?.toDate();
        
        if (currentDate && (!prevDate || !isSameDay(currentDate, prevDate))) {
            acc.push({ type: 'separator', date: currentDate });
        }
        acc.push(message);
        return acc;
    }, []);

    return (
        <div className="p-4 space-y-4">
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

                const message = item as WithId<RoomMessage>;
                const prevMessage = index > 0 ? messagesWithSeparators![index - 1] : null;
                const showAvatarAndName = !prevMessage || prevMessage.type === 'separator' || (prevMessage as WithId<RoomMessage>).senderId !== message.senderId;

                return <RoomMessageBubble key={message.id} message={message} showAvatarAndName={showAvatarAndName} onSetReply={onSetReply} onForward={onForward} room={room}/>
            })}
             <div ref={messagesEndRef} />
        </div>
    )
}

function MessageInput({ room, replyingTo, onCancelReply }: { room: WithId<Room>, replyingTo: WithId<RoomMessage> | null, onCancelReply: () => void }) {
    const { firestore, user } = useFirebase();
    const { toast } = useToast();
    const [isFetchingPreview, setIsFetchingPreview] = useState(false);
    
    const form = useForm<z.infer<typeof messageFormSchema>>({
        resolver: zodResolver(messageFormSchema),
        defaultValues: { text: "" },
    });

    const linkMetadata = form.watch("linkMetadata");
    const textValue = form.watch("text");
    const placeholder = room.id === 'ask_space' ? "Ask any questions" : "Message...";

    const fetchPreview = async (url: string) => {
        setIsFetchingPreview(true);
        // In a real app, you would call your AI flow here.
        // For now, we'll simulate a delay and use mock data.
        setTimeout(() => {
            const mockData: LinkMetadata = {
                url: url,
                title: "This is a fetched link title for rooms",
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
        if (!firestore || !user || !room) return;

        const messageRef = doc(collection(firestore, 'rooms', room.id, 'messages'));
        
        const newMessage: Partial<RoomMessage> = {
            id: messageRef.id,
            roomId: room.id,
            senderId: user.uid,
        };

        if (values.text) newMessage.text = values.text;
        if (values.linkMetadata) newMessage.linkMetadata = values.linkMetadata;

        if (replyingTo) {
            newMessage.replyToMessageId = replyingTo.id;
            newMessage.replyToMessageText = replyingTo.text;
        }

        setDoc(messageRef, { ...newMessage, timestamp: serverTimestamp() }).catch(error => {
            const permissionError = new FirestorePermissionError({
                path: messageRef.path,
                operation: 'create',
                requestResourceData: newMessage,
            });
            errorEmitter.emit('permission-error', permissionError);
        });

        form.reset();
        onCancelReply();
    };
    
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
                            placeholder={placeholder}
                            className="flex-1 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none resize-none text-base px-2 py-2.5"
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
                            disabled={!textValue && !linkMetadata}
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

export default function RoomChatPage() {
    const { firestore, user } = useFirebase();
    const params = useParams();
    const router = useRouter();
    const roomId = params.roomId as string;
    
    const [replyingTo, setReplyingTo] = useState<WithId<RoomMessage> | null>(null);
    const [forwardingMessage, setForwardingMessage] = useState<WithId<RoomMessage> | null>(null);
    const [isForwardSheetOpen, setIsForwardSheetOpen] = useState(false);
    
    const cleanupRef = useRef({ firestore, user });
    useEffect(() => {
        cleanupRef.current = { firestore, user };
    }, [firestore, user]);

    const roomRef = useMemoFirebase(() => {
        if (!firestore || !roomId) return null;
        return doc(firestore, 'rooms', roomId);
    }, [firestore, roomId]);

    const { data: room, isLoading: isRoomLoading } = useDoc<Room>(roomRef);

    const messagesQuery = useMemoFirebase(() => {
        if (!firestore || !roomId) return null;
        return query(
            collection(firestore, 'rooms', roomId, 'messages'),
            orderBy('timestamp', 'asc')
        );
    }, [firestore, roomId]);
    const { data: messages, isLoading: areMessagesLoading } = useCollection<RoomMessage>(messagesQuery);

    const myMessages = useMemo(() => {
        if (!messages || !user) return [];
        return messages.filter(msg => msg.senderId === user.uid);
    }, [messages, user]);

    const isAskSpace = roomId === 'ask_space';
    
    useEffect(() => {
        if (!isRoomLoading && !room && firestore && roomId && user) {
            // Room doesn't exist, let's create it.
            const newRoomData: Room = {
                id: roomId,
                name: roomId === 'after_dark' ? 'After Dark' : 'Asking Questions',
                description: roomId === 'after_dark' ? 'Join late-night conversations from 12 AM to 4 AM — meet new people and enjoy real-time chats.' : 'A place for curious minds. Ask questions, get answers, and learn something new.',
                theme: roomId === 'after_dark' ? 'violet' : 'teal',
                participantIds: []
            };
            setDoc(doc(firestore, 'rooms', roomId), newRoomData);
        }
    }, [isRoomLoading, room, firestore, roomId, user]);

    // Join room on mount
    useEffect(() => {
        if (room && user && roomRef && !room.participantIds.includes(user.uid)) {
            updateDoc(roomRef, {
                participantIds: arrayUnion(user.uid)
            });
        }
    }, [room, user, roomRef]);

    // Leave room on unmount
    useEffect(() => {
        return () => {
            const { firestore: currentFirestore, user: currentUser } = cleanupRef.current;
            if (currentFirestore && currentUser && roomId) {
                const roomToLeaveRef = doc(currentFirestore, 'rooms', roomId);
                updateDoc(roomToLeaveRef, {
                    participantIds: arrayRemove(currentUser.uid)
                }).catch(err => {
                    console.error("Error leaving room:", err);
                });
            }
        };
    }, [roomId]);

    const handleSetReply = (message: WithId<RoomMessage>) => {
        setReplyingTo(message);
    }
    
    const handleCancelReply = () => {
        setReplyingTo(null);
    }

    const handleForward = (message: WithId<RoomMessage>) => {
        setForwardingMessage(message);
        setIsForwardSheetOpen(true);
    };

    return (
        <AppLayout showTopBar={false} showBottomNav={false}>
            <motion.div
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col h-screen"
            >
                <Tabs defaultValue="all" className="flex flex-col flex-1">
                    <div className="sticky top-0 z-20 bg-background flex flex-col">
                        <RoomHeader room={room} />
                        {isAskSpace && (
                            <div className="px-4">
                                <TabsList variant="underline" className="grid w-full grid-cols-2">
                                    <TabsTrigger value="all" variant="underline">All Questions</TabsTrigger>
                                    <TabsTrigger value="mine" variant="underline">My Questions</TabsTrigger>
                                </TabsList>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex-1 overflow-y-auto pb-20">
                        {isAskSpace ? (
                            <>
                                <TabsContent value="all" className="mt-0">
                                    <RoomMessages 
                                        messages={messages} 
                                        isLoading={areMessagesLoading} 
                                        room={room} 
                                        onSetReply={handleSetReply} 
                                        onForward={handleForward}
                                        emptyMessage={<p className="text-center text-muted-foreground py-10">No questions yet. Be the first!</p>}
                                    />
                                </TabsContent>
                                <TabsContent value="mine" className="mt-0">
                                    <RoomMessages 
                                        messages={myMessages} 
                                        isLoading={areMessagesLoading} 
                                        room={room} 
                                        onSetReply={handleSetReply} 
                                        onForward={handleForward}
                                        emptyMessage={<p className="text-center text-muted-foreground py-10">You haven't asked any questions yet.</p>}
                                    />
                                </TabsContent>
                            </>
                        ) : (
                             <ScrollArea className="h-full">
                                <RoomMessages 
                                    messages={messages} 
                                    isLoading={areMessagesLoading} 
                                    room={room} 
                                    onSetReply={handleSetReply} 
                                    onForward={handleForward} 
                                    emptyMessage={<p className="text-center text-muted-foreground py-10">No messages yet.</p>}
                                />
                            </ScrollArea>
                        )}
                    </div>
                </Tabs>
                
                {room && <MessageInput room={room} replyingTo={replyingTo} onCancelReply={handleCancelReply} />}
                <ForwardSheet 
                    isOpen={isForwardSheetOpen}
                    onOpenChange={setIsForwardSheetOpen}
                    message={forwardingMessage as any}
                />
            </motion.div>
        </AppLayout>
    )
}
