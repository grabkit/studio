
"use client";

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mic, Play, Square, Trash2, Send, Pause, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/firebase";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";

const supportedMimeTypes = [
    'audio/mp4',
    'audio/webm',
    'audio/ogg',
];

const getSupportedMimeType = () => {
    if (typeof MediaRecorder === 'undefined') return null;
    for (const mimeType of supportedMimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
            return mimeType;
        }
    }
    return null;
};


export default function VoiceNotePage() {
    const router = useRouter();
    const { toast } = useToast();
    const { user, firestore } = useFirebase();

    const [isRecording, setIsRecording] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [timeLeft, setTimeLeft] = useState(30);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const mimeTypeRef = useRef<string | null>(null);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };

    const stopTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    
    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
        stopTimer();
    }, [stopTimer]);
    
    const startTimer = useCallback(() => {
        setTimeLeft(30);
        timerRef.current = setInterval(() => {
            setTimeLeft(prevTime => {
                if (prevTime <= 1) {
                    stopRecording();
                    return 0;
                }
                return prevTime - 1;
            });
        }, 1000);
    }, [stopRecording]);


    const startRecording = async () => {
        const supportedMimeType = getSupportedMimeType();
        if (!supportedMimeType) {
            toast({
                variant: 'destructive',
                title: "Recording not supported",
                description: "Your browser does not support audio recording."
            });
            return;
        }
        mimeTypeRef.current = supportedMimeType;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: supportedMimeType });
            
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                chunksRef.current.push(event.data);
            };

            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: supportedMimeType });
                setAudioBlob(blob);
                const url = URL.createObjectURL(blob);
                setAudioUrl(url);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorderRef.current.start();
            setIsRecording(true);
            startTimer();
        } catch (error) {
            console.error("Error starting recording:", error);
            toast({
                variant: 'destructive',
                title: "Microphone access denied",
                description: "Please allow microphone access in your browser settings to record a voice note."
            });
        }
    };

    const handleRecordClick = () => {
        if (isRecording) {
            stopRecording();
        } else {
            handleClear();
            startRecording();
        }
    };

    const handlePlayPause = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
        }
    };

    const handleClear = () => {
        setAudioBlob(null);
        setAudioUrl(null);
        setTimeLeft(30);
        setIsPlaying(false);
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    };

    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                resolve(reader.result as string);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };
    
    const handleShare = async () => {
        if (!audioBlob || !user || !firestore) {
            toast({ variant: 'destructive', title: "No recording to share." });
            return;
        }
        setIsSubmitting(true);
        
        try {
            const dataUrl = await blobToBase64(audioBlob);

            const userDocRef = doc(firestore, "users", user.uid);
            await updateDoc(userDocRef, {
                voiceStatusUrl: dataUrl,
                voiceStatusTimestamp: serverTimestamp()
            });

            toast({
                title: "Status Updated",
                description: "Your voice status has been shared.",
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


    useEffect(() => {
        return () => {
            stopTimer();
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
            }
        };
    }, [stopTimer]);
    

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
                             {audioBlob ? "Recording complete" : isRecording ? "Recording..." : "Tap the button to start recording"}
                        </p>
                    </div>
                </div>

                {audioUrl && (
                    <audio
                        ref={audioRef}
                        src={audioUrl}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onEnded={() => setIsPlaying(false)}
                        className="hidden"
                    />
                )}


                <div className="w-full flex justify-center items-center gap-4">
                    <Button 
                        variant="outline" 
                        size="icon" 
                        className="h-16 w-16 rounded-full"
                        disabled={!audioBlob || isSubmitting}
                        onClick={handleClear}
                    >
                        <Trash2 className="h-6 w-6" />
                    </Button>
                     <Button 
                        size="icon" 
                        className={cn(
                            "h-24 w-24 rounded-full shadow-lg transition-colors",
                             isRecording ? "bg-destructive" : "bg-primary"
                        )}
                        onClick={handleRecordClick}
                        disabled={isSubmitting}
                        >
                        {isRecording ? <Square className="h-10 w-10 fill-white" /> : <Mic className="h-10 w-10" />}
                    </Button>

                     {audioBlob ? (
                         <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-16 w-16 rounded-full"
                            onClick={handlePlayPause}
                            disabled={isSubmitting}
                         >
                           {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
                        </Button>
                     ) : (
                        <Button 
                            variant="outline" 
                            size="icon" 
                            className="h-16 w-16 rounded-full"
                            disabled={true}
                        >
                            <Send className="h-6 w-6" />
                        </Button>
                     )}
                </div>
                 <div className="w-full max-w-xs mt-8">
                     <Button 
                        className="w-full" 
                        size="lg"
                        disabled={!audioBlob || isSubmitting}
                        onClick={handleShare}
                    >
                        {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin"/> : "Share Status"}
                     </Button>
                </div>
            </div>
        </AppLayout>
    );
}

    