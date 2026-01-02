
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


const voices = [
    { name: "Algenib", gender: "Male" },
    { name: "Achernar", gender: "Female" },
    { name: "Puck", gender: "Male" },
    { name: "Leda", gender: "Female" },
    { name: "Umbriel", gender: "Male" },
    { name: "Vindemiatrix", gender: "Female" },
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
                     <div 
                        className="relative h-48 w-48 rounded-full flex items-center justify-center bg-secondary"
                        >
                        <div className="absolute inset-0 rounded-full border-4 border-dashed border-muted-foreground/20 animate-spin-slow"></div>
                        <Sparkles className={cn("h-16 w-16 text-primary transition-all", isSubmitting && "animate-pulse")} />
                     </div>

                    <div className="w-full max-w-sm space-y-4">
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
                        <div className="space-y-2">
                            <Label htmlFor="voice-select">Choose a Voice</Label>
                            <Select onValueChange={setSelectedVoice} defaultValue={selectedVoice} disabled={isSubmitting}>
                                <SelectTrigger id="voice-select" className="w-full">
                                    <SelectValue placeholder="Select a voice" />
                                </SelectTrigger>
                                <SelectContent>
                                    {voices.map(voice => (
                                         <SelectItem key={voice.name} value={voice.name}>
                                            {voice.name} ({voice.gender})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>


                <div className="w-full max-w-xs mt-8">
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
             <style jsx>{`
                @keyframes spin-slow {
                  from {
                    transform: rotate(0deg);
                  }
                  to {
                    transform: rotate(360deg);
                  }
                }
                .animate-spin-slow {
                  animation: spin-slow 20s linear infinite;
                }
            `}</style>
        </AppLayout>
    );
}
