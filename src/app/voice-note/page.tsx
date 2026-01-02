
"use client";

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
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
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [generatedVoiceUrl, setGeneratedVoiceUrl] = useState<string | null>(null);

    const charLimit = 280;
    
    const handlePreview = async () => {
        if (!text) {
            toast({ variant: 'destructive', title: "Text cannot be empty." });
            return;
        }
        setIsGenerating(true);
        setGeneratedVoiceUrl(null);

        try {
            const { voiceStatusUrl } = await generateVoiceStatus({ text, voiceName: selectedVoice });
            setGeneratedVoiceUrl(voiceStatusUrl);
            const audio = new Audio(voiceStatusUrl);
            audio.play();
        } catch (error) {
            console.error("Error generating voice preview:", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not generate voice preview." });
        } finally {
            setIsGenerating(false);
        }
    };


    const handleShare = async () => {
        if (!generatedVoiceUrl) {
            toast({ variant: 'destructive', title: "No voice status to share.", description: "Please preview your voice status first." });
            return;
        }
        if (!user || !firestore) {
            toast({ variant: 'destructive', title: "You must be logged in." });
            return;
        }

        setIsSharing(true);
        
        try {
            const userDocRef = doc(firestore, "users", user.uid);
            await updateDoc(userDocRef, {
                voiceStatusUrl: generatedVoiceUrl,
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
            setIsSharing(false);
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
            <div className="flex flex-col h-full pt-14 pb-8 px-4">
                <div className="flex-grow space-y-6 pt-4">
                     <div className="w-full max-w-sm space-y-4 mx-auto">
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
                                disabled={isGenerating || isSharing}
                            />
                            <p className="text-xs text-muted-foreground text-right">
                                {text.length} / {charLimit}
                            </p>
                        </div>
                        <div className="space-y-3">
                            <Label htmlFor="voice-select">Choose a Voice</Label>
                             <div className="grid grid-cols-3 gap-4">
                                {voices.map(voice => (
                                    <div key={voice.name} className="flex-shrink-0 flex flex-col items-center space-y-2" onClick={() => setSelectedVoice(voice.name)}>
                                        <div className={cn(
                                            "p-1 rounded-full cursor-pointer transition-all",
                                            selectedVoice === voice.name ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                                        )}>
                                            <div className="relative">
                                                <Avatar className="h-20 w-20 border-2 border-transparent">
                                                    <AvatarImage src={`https://picsum.photos/seed/${voice.seed}/100/100`} />
                                                    <AvatarFallback>{voice.name[0]}</AvatarFallback>
                                                </Avatar>
                                            </div>
                                        </div>
                                        <p className="text-xs font-medium text-muted-foreground">{voice.name}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>


                <div className="w-full max-w-xs mx-auto mt-8 space-y-3">
                    <Button 
                        className="w-full" 
                        size="lg"
                        variant="outline"
                        disabled={!text || isGenerating || isSharing}
                        onClick={handlePreview}
                    >
                        {isGenerating ? (
                            <Loader2 className="h-5 w-5 animate-spin mr-2"/>
                        ) : (
                            <Play className="h-5 w-5 mr-2" />
                        )}
                        Preview Voice
                    </Button>
                     <Button 
                        className="w-full" 
                        size="lg"
                        disabled={!generatedVoiceUrl || isGenerating || isSharing}
                        onClick={handleShare}
                    >
                        {isSharing ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin mr-2"/> 
                                Sharing...
                            </>
                        ) : "Share"}
                     </Button>
                </div>
            </div>
        </AppLayout>
    );
}
