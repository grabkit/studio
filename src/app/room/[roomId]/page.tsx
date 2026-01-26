
'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, setDoc, serverTimestamp, updateDoc, arrayUnion, getDoc, deleteDoc } from 'firebase/firestore';
import { useCollection, WithId } from '@/firebase/firestore/use-collection';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import AppLayout from '@/components/AppLayout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Send, Copy, Trash2 } from 'lucide-react';
import { cn, getAvatar, formatMessageTimestamp, formatUserId, formatDateSeparator } from '@/lib/utils';
import type { Room, RoomMessage, User } from '@/lib/types';
import { isSameDay } from 'date-fns';
import { motion } from 'framer-motion';
import { usePresence } from '@/hooks/usePresence';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError, errorEmitter } from '@/firebase';

const messageFormSchema = z.object({
  text: z.string().min(1, "Message cannot be empty").max(1000),
});

function RoomHeader({ room, participantsCount }: { room: WithId<Room> | null, participantsCount: number }) {
    const router = useRouter();

    if (!room) {
        return (
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background/80 backdrop-blur-sm border-b h-14 max-w-2xl mx-auto sm:px-4">
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
        <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background/80 backdrop-blur-sm border-b h-14 max-w-2xl mx-auto sm:px-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft />
            </Button>
            <div className="ml-2">
                <h2 className="text-base font-bold leading-tight">{room.name}</h2>
                <p className="text-xs text-muted-foreground leading-tight">{participantsCount} participants</p>
            </div>
        </div>
    )
}

function RoomMessageBubble({ message, showAvatarAndName }: { message: WithId<RoomMessage>, showAvatarAndName: boolean }) {
    const { firestore, user: currentUser } = useFirebase();
    const isOwnMessage = message.senderId === currentUser?.uid;
    const { isOnline } = usePresence(message.senderId);
    const { toast } = useToast();
    const [isSheetOpen, setIsSheetOpen] = useState(false);

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
    };

    const handleUnsend = () => {
        if (!firestore || !isOwnMessage) return;
        setIsSheetOpen(false);
        const messageRef = doc(firestore, 'rooms', message.roomId, 'messages', message.id);
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
    };

    const bubble = (
        <div className={cn(
            "rounded-2xl max-w-[80%]",
            isOwnMessage ? "bg-primary text-primary-foreground rounded-br-none" : "bg-secondary text-foreground rounded-bl-none inline-block"
        )}>
            <p className="px-3 py-1.5 text-base break-words whitespace-pre-wrap">{message.text}</p>
            <p className={cn("text-[11px] self-end px-3 pb-1.5 text-right", isOwnMessage ? "text-primary-foreground/70" : "text-muted-foreground")}>
                {message.timestamp?.toDate ? formatMessageTimestamp(message.timestamp.toDate()) : '...'}
            </p>
        </div>
    );

    return (
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className={cn(isOwnMessage ? "flex justify-end" : "flex gap-2", !showAvatarAndName && !isOwnMessage && "pl-10")}
            >
                {!isOwnMessage && showAvatarAndName && (
                    <Avatar className="h-8 w-8" showStatus={true} isOnline={isOnline}>
                        <AvatarImage src={isAvatarUrl ? avatar : undefined} />
                        <AvatarFallback>{!isAvatarUrl ? avatar : ''}</AvatarFallback>
                    </Avatar>
                )}
                <div className={cn(!isOwnMessage && "flex-1")}>
                    {!isOwnMessage && showAvatarAndName && <p className="text-xs font-semibold mb-0.5">{sender ? formatUserId(sender.id) : '...'}</p>}
                    <SheetTrigger asChild>
                        <div>{bubble}</div>
                    </SheetTrigger>
                </div>
            </motion.div>
            <SheetContent side="bottom" className="rounded-t-2xl">
                <SheetHeader className="sr-only">
                    <SheetTitle>Message Options</SheetTitle>
                </SheetHeader>
                <div className="grid gap-2 py-4">
                    <div className="border rounded-2xl">
                        <Button variant="ghost" className="justify-start text-base py-6 rounded-2xl w-full gap-3" onClick={handleCopy}>
                            <Copy />
                            <span>Copy</span>
                        </Button>
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
    );
}

function RoomMessages({ roomId }: { roomId: string }) {
    const { firestore } = useFirebase();
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    const messagesQuery = useMemoFirebase(() => {
        if (!firestore || !roomId) return null;
        return query(
            collection(firestore, 'rooms', roomId, 'messages'),
            orderBy('timestamp', 'asc')
        );
    }, [firestore, roomId]);

    const { data: messages, isLoading } = useCollection<RoomMessage>(messagesQuery);

    useEffect(() => {
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

    const messagesWithSeparators = messages?.reduce((acc: (WithId<RoomMessage> | { type: 'separator', date: Date })[], message, index) => {
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
        <div className="p-4 space-y-2">
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

                return <RoomMessageBubble key={message.id} message={message} showAvatarAndName={showAvatarAndName} />
            })}
             <div ref={messagesEndRef} />
        </div>
    )
}

function MessageInput({ room }: { room: WithId<Room> }) {
    const { firestore, user } = useFirebase();
    const form = useForm<z.infer<typeof messageFormSchema>>({
        resolver: zodResolver(messageFormSchema),
        defaultValues: { text: "" },
    });

    const onSubmit = (values: z.infer<typeof messageFormSchema>) => {
        if (!firestore || !user || !room) return;

        const messageRef = doc(collection(firestore, 'rooms', room.id, 'messages'));
        
        const newMessage: Omit<RoomMessage, 'id' | 'timestamp'> = {
            roomId: room.id,
            senderId: user.uid,
            text: values.text
        };

        setDoc(messageRef, { ...newMessage, timestamp: serverTimestamp() });
        form.reset();
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-background border-t pb-safe">
            <div className="p-2 flex items-center gap-2">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex items-center rounded-full bg-secondary px-2">
                         <Textarea
                            placeholder="Message..."
                            className="flex-1 bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none resize-none text-base px-2 py-2.5"
                            rows={1}
                            maxRows={5}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    form.handleSubmit(onSubmit)();
                                }
                            }}
                            {...form.register("text")}
                        />
                         <Button type="submit" size="icon" className="rounded-full shrink-0 h-8 w-8 bg-black hover:bg-gray-800">
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
    const roomId = params.roomId as string;
    
    const roomRef = useMemoFirebase(() => {
        if (!firestore || !roomId) return null;
        return doc(firestore, 'rooms', roomId);
    }, [firestore, roomId]);

    const { data: room, isLoading: isRoomLoading } = useDoc<Room>(roomRef);
    
    useEffect(() => {
        if (!isRoomLoading && !room && firestore && roomId && user) {
            // Room doesn't exist, let's create it.
            const newRoomData: Room = {
                id: roomId,
                name: roomId === 'after_dark' ? 'After Dark' : 'Ask Space',
                description: roomId === 'after_dark' ? 'Join late-night conversations from 12 AM to 4 AM — meet new people and enjoy real-time chats.' : 'A place for curious minds. Ask questions, get answers, and learn something new.',
                theme: roomId === 'after_dark' ? 'violet' : 'teal',
                participantIds: []
            };
            setDoc(doc(firestore, 'rooms', roomId), newRoomData);
        }
    }, [isRoomLoading, room, firestore, roomId, user]);

    useEffect(() => {
        if (room && user && roomRef && !room.participantIds.includes(user.uid)) {
            updateDoc(roomRef, {
                participantIds: arrayUnion(user.uid)
            });
        }
    }, [room, user, roomRef]);

    return (
        <AppLayout showTopBar={false} showBottomNav={false}>
            <motion.div
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col h-screen"
            >
                <RoomHeader room={room} participantsCount={room?.participantIds?.length || 0} />
                 <div className="flex-1 overflow-y-auto pt-14 pb-14">
                    <RoomMessages roomId={roomId} />
                </div>
                {room && <MessageInput room={room} />}
            </motion.div>
        </AppLayout>
    )
}
