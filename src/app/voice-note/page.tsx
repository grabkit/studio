
"use client";

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Send, Mic, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/firebase";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";
import { Textarea } from "@/components/ui/textarea";
import { generateVoiceStatus } from "@/ai/flows/generate-voice-status-flow";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Image from "next/image";


const voices = [
    { name: "Algenib", gender: "Male", seed: "male1" },
    { name: "Achernar", gender: "Female", seed: "female1" },
    { name: "Puck", gender: "Male", seed: "male2" },
    { name: "Leda", gender: "Female", seed: "female2" },
    { name: "Umbriel", gender: "Male", seed: "male3" },
    { name: "Vindemiatrix", gender: "Female", seed: "female3" },
]

export default function VoiceNotePage() {
    const router = useRouter();
    const { toast } = useToast();
    const { user, firestore } = useFirebase();

    const [text, setText] = useState("");
    const [selectedVoice, setSelectedVoice] = useState(voices[0].name);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const charLimit = 280;


    const handleShare = async () => {
        if (!text) {
            toast({ variant: 'destructive', title: "Text cannot be empty." });
            return;
        }
        if (!user || !firestore) {
            toast({ variant: 'destructive', title: "You must be logged in." });
            return;
        }

        setIsSubmitting(true);
        
        try {
            const { voiceStatusUrl } = await generateVoiceStatus({ text, voiceName: selectedVoice });
            
            const userDocRef = doc(firestore, "users", user.uid);
            await updateDoc(userDocRef, {
                voiceStatusUrl: voiceStatusUrl,
                voiceStatusTimestamp: serverTimestamp()
            });

            toast({
                title: "Status Updated",
                description: "Your new voice status has been shared.",
            });
            router.push('/account');

        } catch (error) {
            console.error("Error sharing voice status:", error);
            const userDocRef = doc(firestore, "users", user.uid);
             const permissionError = new FirestorePermissionError({
                path: userDocRef.path,
                operation: 'update',
                requestResourceData: { voiceStatusUrl: 'base64-data-url' },
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: "Error", description: "Could not share your voice status." });
        } finally {
            setIsSubmitting(false);
        }
    };


    return (
        <AppLayout showTopBar={false} showBottomNav={false}>
             <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">Create Voice Status</h2>
            </div>
            <div className="flex flex-col h-full justify-between pt-14 pb-8 px-4">
                <div className="flex-grow flex flex-col items-center justify-center space-y-6">
                    <div className="w-full max-w-sm space-y-4 pt-10">
                        <div className="space-y-2">
                             <Label htmlFor="voice-status-text">What's on your mind?</Label>
                            <Textarea
                                id="voice-status-text"
                                placeholder="Type your status here..."
                                rows={3}
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                maxLength={charLimit}
                                className="text-base"
                                disabled={isSubmitting}
                            />
                            <p className="text-xs text-muted-foreground text-right">
                                {text.length} / {charLimit}
                            </p>
                        </div>
                        <div className="space-y-3">
                            <Label htmlFor="voice-select">Choose a Voice</Label>
                            <div className="flex space-x-4 overflow-x-auto py-3 -mx-4 px-4 no-scrollbar">
                                {voices.map(voice => (
                                    <div key={voice.name} className="flex-shrink-0 flex flex-col items-center space-y-2" onClick={() => setSelectedVoice(voice.name)}>
                                        <div className={cn(
                                            "p-1 rounded-full cursor-pointer transition-all",
                                            selectedVoice === voice.name ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                                        )}>
                                            <Avatar className="h-14 w-14 border-2 border-transparent">
                                                <AvatarImage src={`https://picsum.photos/seed/${voice.seed}/100/100`} />
                                                <AvatarFallback>{voice.name[0]}</AvatarFallback>
                                            </Avatar>
                                        </div>
                                        <p className="text-xs font-medium text-muted-foreground">{voice.name}</p>
                                    </div>
                                ))}
                            </div>
                            <style jsx>{`
                                .no-scrollbar::-webkit-scrollbar {
                                    display: none;
                                }
                                .no-scrollbar {
                                    -ms-overflow-style: none;
                                    scrollbar-width: none;
                                }
                            `}</style>
                        </div>
                    </div>
                </div>


                <div className="w-full max-w-xs mx-auto mt-8">
                     <Button 
                        className="w-full" 
                        size="lg"
                        disabled={!text || isSubmitting}
                        onClick={handleShare}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin mr-2"/> 
                                Generating...
                            </>
                        ) : "Share Voice Status"}
                     </Button>
                </div>
            </div>
        </AppLayout>
    );
}
