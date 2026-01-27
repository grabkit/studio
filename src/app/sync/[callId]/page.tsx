'use client';

import { useFirebase } from "@/firebase";
import AppLayout from "@/components/AppLayout";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PhoneOff, Send, SkipForward } from "lucide-react";
import { useCollection } from "@/firebase/firestore/use-collection";
import { collection, query, orderBy, addDoc, serverTimestamp } from "firebase/firestore";
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
                <p>{message.text}</p>
            </div>
        </motion.div>
    );
}

export default function SyncCallPage() {
    const { 
        user,
        activeSyncCall, 
        localSyncStream,
        remoteSyncStream,
        hangUpSyncCall,
        findOrStartSyncCall,
        syncCallMessages,
        sendSyncChatMessage
    } = useFirebase();
    const params = useParams();
    const router = useRouter();
    const callId = params.callId as string;

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    const [chatMessage, setChatMessage] = useState("");

    useEffect(() => {
        if (localVideoRef.current && localSyncStream) {
            localVideoRef.current.srcObject = localSyncStream;
        }
    }, [localSyncStream]);

    useEffect(() => {
        if (remoteVideoRef.current && remoteSyncStream) {
            remoteVideoRef.current.srcObject = remoteSyncStream;
        }
    }, [remoteSyncStream]);
    
    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [syncCallMessages]);
    
    // If the user lands on this page directly without an active call, redirect to lobby
    useEffect(() => {
        if (!activeSyncCall && callId) {
             // This might be a reconnect attempt, logic to rejoin call would go here
             // For now, redirect to lobby for simplicity
             router.replace('/sync');
        }
    }, [activeSyncCall, callId, router]);


    const handleHangUp = () => {
        hangUpSyncCall();
        router.replace('/home');
    };
    
    const handleNext = () => {
        hangUpSyncCall();
        findOrStartSyncCall(); // This will trigger a redirect in the sync lobby page
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
            <div className="relative h-screen w-screen bg-black">
                {/* Remote Video */}
                <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />

                {/* Local Video */}
                <video ref={localVideoRef} autoPlay playsInline muted className="absolute top-4 right-4 h-48 w-36 rounded-lg object-cover border-2 border-white" />

                {/* Chat Overlay */}
                <div className="absolute bottom-24 left-4 right-4 h-1/3 max-h-64 flex flex-col">
                     <div ref={chatContainerRef} className="flex-1 overflow-y-auto space-y-2 p-2 rounded-lg bg-black/20 backdrop-blur-sm">
                        <AnimatePresence>
                             {syncCallMessages.map((msg) => (
                                <ChatBubble key={msg.id} message={msg} isOwn={msg.senderId === user?.uid} />
                            ))}
                        </AnimatePresence>
                     </div>
                     <form onSubmit={handleSendMessage} className="mt-2 flex items-center gap-2">
                        <Textarea 
                            value={chatMessage}
                            onChange={(e) => setChatMessage(e.target.value)}
                            placeholder="Type a message..."
                            className="bg-black/30 text-white border-white/30 rounded-full resize-none"
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
                </div>
                

                {/* Controls */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-6 z-10">
                    <Button onClick={handleHangUp} size="lg" variant="destructive" className="rounded-full h-16 w-16">
                        <PhoneOff className="h-7 w-7"/>
                    </Button>
                    <Button onClick={handleNext} size="lg" variant="secondary" className="rounded-full h-16 w-16">
                        <SkipForward className="h-7 w-7" />
                    </Button>
                </div>
            </div>
        </AppLayout>
    );
}
