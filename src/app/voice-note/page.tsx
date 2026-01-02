
"use client";

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Mic, Play, Square, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/firebase";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type RecordingStatus = "idle" | "permission-pending" | "recording" | "recorded" | "sharing";

export default function VoiceNotePage() {
    const router = useRouter();
    const { toast } = useToast();
    const { user, firestore } = useFirebase();

    const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>("idle");
    const [hasPermission, setHasPermission] = useState(false);
    const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
    const [duration, setDuration] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

    const maxDuration = 30; // 30 seconds

    useEffect(() => {
        setRecordingStatus("permission-pending");
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                setHasPermission(true);
                setRecordingStatus("idle");
                const recorder = new MediaRecorder(stream);
                mediaRecorderRef.current = recorder;

                recorder.ondataavailable = (event) => {
                    audioChunksRef.current.push(event.data);
                };

                recorder.onstop = () => {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                    const audioUrl = URL.createObjectURL(audioBlob);
                    
                    const reader = new FileReader();
                    reader.readAsDataURL(audioBlob);
                    reader.onloadend = () => {
                        const base64Audio = reader.result as string;
                        setRecordedAudioUrl(base64Audio);
                    };

                    setRecordingStatus("recorded");
                    audioChunksRef.current = [];
                };
            })
            .catch(err => {
                console.error("Error accessing microphone:", err);
                setHasPermission(false);
                setRecordingStatus("idle");
                toast({
                    variant: 'destructive',
                    title: 'Microphone Access Denied',
                    description: 'Please enable microphone permissions in your browser settings to record a voice status.',
                });
                router.back();
            });

        audioPlayerRef.current = new Audio();
        
        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        };

    }, [router, toast]);


    const startRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "inactive") {
            mediaRecorderRef.current.start();
            setRecordingStatus("recording");
            setDuration(0);
            timerIntervalRef.current = setInterval(() => {
                setDuration(prev => {
                    if (prev + 1 >= maxDuration) {
                        stopRecording();
                        return maxDuration;
                    }
                    return prev + 1;
                });
            }, 1000);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.stop();
             if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        }
    };
    
    const handleRetake = () => {
        setRecordedAudioUrl(null);
        setDuration(0);
        setRecordingStatus("idle");
    }

    const playPreview = () => {
        if (recordedAudioUrl && audioPlayerRef.current) {
            audioPlayerRef.current.src = recordedAudioUrl;
            audioPlayerRef.current.play();
        }
    };

    const handleShare = async () => {
        if (!recordedAudioUrl) {
            toast({ variant: 'destructive', title: "No voice status to share." });
            return;
        }
        if (!user || !firestore) {
            toast({ variant: 'destructive', title: "You must be logged in." });
            return;
        }

        setRecordingStatus("sharing");
        
        try {
            const userDocRef = doc(firestore, "users", user.uid);
            await updateDoc(userDocRef, {
                voiceStatusUrl: recordedAudioUrl,
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
            setRecordingStatus("recorded");
        }
    };
    
    const formatTime = (seconds: number) => {
        const remainingSeconds = maxDuration - seconds;
        return `0:${remainingSeconds.toString().padStart(2, '0')}`;
    };


    return (
        <AppLayout showTopBar={false} showBottomNav={false}>
             <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">Create Voice Status</h2>
            </div>
            <div className="flex flex-col h-full items-center justify-center pt-14 pb-8 px-4 text-center">
                 {!hasPermission ? (
                     <Alert variant="destructive" className="max-w-sm">
                        <AlertTitle>Microphone Access Required</AlertTitle>
                        <AlertDescription>
                            Please enable microphone access in your browser to use this feature.
                        </AlertDescription>
                    </Alert>
                 ) : (
                    <>
                        <div className="flex-grow flex flex-col items-center justify-center">
                             <p className="text-2xl font-bold font-headline mb-4">
                                {recordingStatus === "recording" && "Recording..."}
                                {recordingStatus === "recorded" && "Preview"}
                                {recordingStatus === "idle" && "Tap to Record"}
                                {recordingStatus === "sharing" && "Sharing..."}
                                {recordingStatus === "permission-pending" && "Requesting Permission..."}
                            </p>
                             <div className="relative flex items-center justify-center">
                                {recordingStatus === "recording" && (
                                     <div className="absolute inset-0 rounded-full bg-destructive/20 animate-pulse"></div>
                                )}
                                <Button
                                    variant={recordingStatus === "recording" ? "destructive" : "secondary"}
                                    size="icon"
                                    onClick={recordingStatus === "recording" ? stopRecording : startRecording}
                                    disabled={recordingStatus !== "idle" && recordingStatus !== "recording"}
                                    className="h-40 w-40 rounded-full"
                                >
                                    <Mic className="h-20 w-20" />
                                </Button>
                            </div>
                            <p className="text-lg text-muted-foreground mt-4 font-mono w-24">
                                {formatTime(duration)}
                            </p>
                        </div>
                        
                        <div className="w-full max-w-xs mx-auto mt-8 flex items-center justify-center gap-4">
                           {recordingStatus === "recorded" && (
                             <>
                               <Button size="lg" variant="outline" className="flex-1" onClick={handleRetake}>
                                    <RefreshCw className="h-5 w-5 mr-2" />
                                    Retake
                               </Button>
                               <Button size="lg" variant="outline" className="flex-1" onClick={playPreview}>
                                    <Play className="h-5 w-5 mr-2" />
                                    Preview
                               </Button>
                             </>
                           )}
                         </div>

                        <div className="w-full max-w-xs mx-auto mt-4">
                             <Button 
                                size="lg"
                                className="w-full"
                                disabled={recordingStatus !== "recorded"}
                                onClick={handleShare}
                            >
                                {recordingStatus === "sharing" ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin mr-2"/> 
                                        Sharing...
                                    </>
                                ) : "Share Status"}
                             </Button>
                        </div>
                    </>
                 )}
            </div>
        </AppLayout>
    );
}
