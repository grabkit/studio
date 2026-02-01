'use client';

import { useFirebase } from "@/firebase";
import AppLayout from "@/components/AppLayout";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PhoneOff, Send, SkipForward } from "lucide-react";
import type { SyncMessage } from "@/lib/types";
import { formatUserId, cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Textarea } from "@/components/ui/textarea";

function ChatBubble({ message, isOwn }: { message: SyncMessage, isOwn: boolean }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn("flex items-end gap-2", isOwn ? "justify-end" : "justify-start")}
        >
            <div className={cn(
                "max-w-xs rounded-2xl px-3 py-2 text-sm",
                isOwn ? "bg-primary text-primary-foreground rounded-br-none" : "bg-secondary rounded-bl-none"
            )}>
                <p className="font-bold mb-0.5">{isOwn ? "You" : "Stranger"}</p>
                <p className="whitespace-pre-wrap">{message.text}</p>
            </div>
        </motion.div>
    );
}

export default function SyncCallPage() {
    const { 
        user,
        activeSyncCall, 
        hangUpSyncCall,
        findOrStartSyncCall,
        syncCallMessages,
        sendSyncChatMessage
    } = useFirebase();
    const params = useParams();
    const router = useRouter();
    const callId = params.callId as string;

    const chatContainerRef = useRef<HTMLDivElement>(null);
    const [chatMessage, setChatMessage] = useState("");

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [syncCallMessages]);
    
    useEffect(() => {
        if (!activeSyncCall && callId) {
             router.replace('/sync');
        }
    }, [activeSyncCall, callId, router]);


    const handleHangUp = () => {
        hangUpSyncCall();
        router.replace('/messages');
    };
    
    const handleNext = () => {
        hangUpSyncCall();
        router.replace('/sync');
    }

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (chatMessage.trim() && user) {
            sendSyncChatMessage(chatMessage);
            setChatMessage("");
        }
    };


    return (
        <AppLayout showTopBar={false} showBottomNav={false}>
            <div className="flex flex-col h-screen bg-background">
                <div className="p-2 border-b flex items-center justify-between sticky top-0 bg-background z-10">
                    <div className="pl-2">
                        <h2 className="text-lg font-bold">Stranger</h2>
                        <p className="text-sm text-muted-foreground">You are now chatting</p>
                    </div>
                    <Button onClick={handleHangUp} variant="ghost" size="icon" className="text-destructive">
                        <PhoneOff />
                    </Button>
                </div>

                <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                    <AnimatePresence>
                        {syncCallMessages.map((msg) => (
                        <ChatBubble key={msg.id} message={msg} isOwn={msg.senderId === user?.uid} />
                        ))}
                    </AnimatePresence>
                </div>

                <div className="p-2 border-t bg-background">
                    <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                        <Textarea 
                            value={chatMessage}
                            onChange={(e) => setChatMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="bg-secondary border-none rounded-full resize-none focus-visible:ring-0 focus-visible:ring-offset-0 text-base"
                            rows={1}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    handleSendMessage(e);
                                    e.preventDefault();
                                }
                            }}
                        />
                        <Button type="submit" size="icon" className="rounded-full bg-primary h-10 w-10 shrink-0">
                            <Send className="h-5 w-5"/>
                        </Button>
                    </form>
                    <div className="flex items-center gap-2 mt-2">
                        <Button onClick={handleHangUp} variant="destructive" className="w-full rounded-full">
                            End Chat
                        </Button>
                        <Button onClick={handleNext} variant="secondary" className="w-full rounded-full">
                            Next
                        </Button>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
