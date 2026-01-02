
"use client";

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mic, Play, Square, Trash2, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

export default function VoiceNotePage() {
    const router = useRouter();
    const [isRecording, setIsRecording] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [timeLeft, setTimeLeft] = useState(30);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    return (
        <AppLayout showTopBar={false} showBottomNav={false}>
             <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">Create Voice Note</h2>
            </div>
            <div className="flex flex-col h-full justify-between items-center pt-14 pb-8 px-4">
                <div className="flex-grow flex flex-col items-center justify-center space-y-8">
                     <div 
                        className="relative h-48 w-48 rounded-full flex items-center justify-center bg-secondary"
                        >
                        <div className="absolute inset-0 rounded-full border-4 border-dashed border-muted-foreground/20 animate-spin-slow"></div>
                         <div className={cn(
                             "absolute inset-2 rounded-full bg-primary/10 transition-transform duration-500",
                             isRecording ? 'scale-100' : 'scale-0'
                         )}></div>
                        <Mic className={cn("h-16 w-16 text-primary transition-colors", isRecording && "text-destructive")} />
                     </div>

                    <div className="text-center">
                        <p className="text-5xl font-bold font-mono tracking-tighter text-primary">
                            {formatTime(timeLeft)}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                             {isRecording ? "Recording..." : "Tap the button to start recording"}
                        </p>
                    </div>
                </div>

                <div className="w-full flex justify-center items-center gap-4">
                    <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-16 w-16 rounded-full"
                        disabled={!audioBlob}
                    >
                        <Trash2 className="h-6 w-6" />
                    </Button>
                     <Button 
                        size="icon" 
                        className={cn(
                            "h-24 w-24 rounded-full shadow-lg transition-colors",
                             isRecording ? "bg-destructive" : "bg-primary"
                        )}
                        >
                        {isRecording ? <Square className="h-10 w-10 fill-white" /> : <Mic className="h-10 w-10" />}
                    </Button>
                     <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-16 w-16 rounded-full"
                        disabled={!audioBlob}
                    >
                        <Send className="h-6 w-6" />
                    </Button>
                </div>
            </div>
        </AppLayout>
    );
}
