
"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Loader2, Mic, Play, Square, RefreshCw, X, Send, Pause, StopCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/firebase";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type RecordingStatus = "idle" | "permission-pending" | "recording" | "paused" | "recorded" | "sharing";

export default function VoiceNotePage() {
    const router = useRouter();
    const { toast } = useToast();
    const { user, firestore } = useFirebase();

    const [isSheetOpen, setIsSheetOpen] = useState(true);
    const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>("permission-pending");
    const [hasPermission, setHasPermission] = useState(false);
    const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
    const [duration, setDuration] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const animationFrameIdRef = useRef<number | null>(null);

    const maxDuration = 30; // 30 seconds

    const drawInitialState = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const canvasCtx = canvas.getContext('2d');
        if (!canvasCtx) return;

        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    }, []);

    const stopVisualization = useCallback(() => {
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
        }
        drawInitialState();
    }, [drawInitialState]);

    const visualize = useCallback((stream: MediaStream) => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const audioContext = audioContextRef.current;
        
        if (!analyserRef.current) {
            analyserRef.current = audioContext.createAnalyser();
            analyserRef.current.fftSize = 256;
        }
        
        if (sourceNodeRef.current?.mediaStream.id !== stream.id) {
            if (sourceNodeRef.current) {
                sourceNodeRef.current.disconnect();
            }
            sourceNodeRef.current = audioContext.createMediaStreamSource(stream);
            sourceNodeRef.current.connect(analyserRef.current);
        }

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const canvasCtx = canvas.getContext('2d');
        if (!canvasCtx) return;

        const draw = () => {
            animationFrameIdRef.current = requestAnimationFrame(draw);
            
            if (recordingStatus === 'paused') {
                // Don't draw if paused, but keep the animation frame loop running
                return;
            }

            analyserRef.current?.getByteFrequencyData(dataArray);

            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            
            const lineWidth = 2;
            const gap = 2; 
            const centerX = canvas.width / 2;
            const startOffset = gap / 2;


            for (let i = 0; i < bufferLength; i++) {
                const barHeight = dataArray[i] / 2.5;

                if (barHeight < 1) continue;

                canvasCtx.fillStyle = 'hsl(var(--primary))';
                
                canvasCtx.fillRect(centerX + startOffset + (i * (lineWidth + gap)), canvas.height / 2 - barHeight / 2, lineWidth, barHeight);
                canvasCtx.fillRect(centerX - startOffset - (i * (lineWidth + gap)) - lineWidth, canvas.height / 2 - barHeight / 2, lineWidth, barHeight);
            }
        };
        draw();
    }, [recordingStatus]);

    useEffect(() => {
        drawInitialState();
    }, [drawInitialState]);

    useEffect(() => {
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                setHasPermission(true);
                setRecordingStatus("idle");
                mediaRecorderRef.current = new MediaRecorder(stream);
                mediaRecorderRef.current.ondataavailable = (event) => {
                    audioChunksRef.current.push(event.data);
                };
                mediaRecorderRef.current.onstop = () => {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                    const reader = new FileReader();
                    reader.readAsDataURL(audioBlob);
                    reader.onloadend = () => {
                        const base64Audio = reader.result as string;
                        setRecordedAudioUrl(base64Audio);
                    };
                    setRecordingStatus("recorded");
                    audioChunksRef.current = [];
                    stopVisualization();
                };
            })
            .catch(err => {
                console.error("Error accessing microphone:", err);
                setHasPermission(false);
                setRecordingStatus("idle");
                toast({
                    variant: 'destructive',
                    title: 'Microphone Access Denied',
                    description: 'Please enable microphone permissions in your browser settings.',
                });
                setIsSheetOpen(false);
            });

        audioPlayerRef.current = new Audio();

        return () => {
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            stopVisualization();
            sourceNodeRef.current?.disconnect();
            audioContextRef.current?.close();
        };
    }, [router, toast, stopVisualization, drawInitialState]);

     useEffect(() => {
        if (!isSheetOpen) {
          router.back();
        }
    }, [isSheetOpen, router]);

    const startRecording = () => {
        if (mediaRecorderRef.current) {
            if (mediaRecorderRef.current.state === "paused") {
                mediaRecorderRef.current.resume();
            } else {
                mediaRecorderRef.current.start();
                audioChunksRef.current = []; // Reset chunks on new recording
            }
            
            visualize(mediaRecorderRef.current.stream);
            setRecordingStatus("recording");
            
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
    
    const pauseRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            mediaRecorderRef.current.pause();
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
            setRecordingStatus("paused");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && (mediaRecorderRef.current.state === "recording" || mediaRecorderRef.current.state === "paused")) {
            mediaRecorderRef.current.stop();
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        }
    };

    const handleMicButtonClick = () => {
        if (recordingStatus === "idle" || recordingStatus === "recorded") {
            handleRetake(); // Reset and start new recording
            startRecording();
        } else if (recordingStatus === "paused") {
            startRecording(); // This will resume
        } else if (recordingStatus === "recording") {
            pauseRecording();
        }
    }
    
    const handleRetake = () => {
        setRecordedAudioUrl(null);
        setDuration(0);
        setRecordingStatus("idle");
        drawInitialState();
    }

    const playPreview = () => {
        if (recordedAudioUrl && audioPlayerRef.current) {
            audioPlayerRef.current.src = recordedAudioUrl;
            audioPlayerRef.current.play();
        }
    };

    const handleShare = async () => {
        if (!recordedAudioUrl || !user || !firestore) {
            toast({ variant: 'destructive', title: "No voice status to share." });
            return;
        }

        setRecordingStatus("sharing");
        
        try {
            const userDocRef = doc(firestore, "users", user.uid);
            await updateDoc(userDocRef, {
                voiceStatusUrl: recordedAudioUrl,
                voiceStatusTimestamp: serverTimestamp()
            });
            toast({ title: "Status Updated", description: "Your new voice status has been shared." });
            setIsSheetOpen(false);
        } catch (error) {
            const userDocRef = doc(firestore, "users", user.uid);
            const permissionError = new FirestorePermissionError({
                path: userDocRef.path,
                operation: 'update',
                requestResourceData: { voiceStatusUrl: 'base64-data-url' },
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: "destructive", title: "Error", description: "Could not share your voice status." });
            setRecordingStatus("recorded");
        }
    };
    
    const formatTime = (seconds: number) => {
        const remainingSeconds = recordingStatus === 'recording' || recordingStatus === 'paused' ? seconds : maxDuration;
        const m = Math.floor(remainingSeconds / 60);
        const s = remainingSeconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const getButtonIcon = () => {
        switch(recordingStatus) {
            case 'recording': return <Pause className="h-10 w-10 text-black" fill="black" />;
            case 'recorded': return <Play className="h-10 w-10 text-primary-foreground" fill="currentColor" onClick={playPreview}/>;
            default: return <Mic className="h-10 w-10" />; // idle, paused
        }
    }

    return (
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetContent side="bottom" className="rounded-t-2xl h-auto flex flex-col p-6 items-center justify-center gap-2 pb-10">
                <SheetHeader className="text-center">
                    <SheetTitle>Create Voice Status</SheetTitle>
                </SheetHeader>
                
                {!hasPermission && recordingStatus === 'permission-pending' && <Loader2 className="h-8 w-8 animate-spin"/>}
                {!hasPermission && recordingStatus === 'idle' && (
                     <Alert variant="destructive" className="max-w-sm">
                        <AlertTitle>Microphone Access Required</AlertTitle>
                        <AlertDescription>
                            Please enable microphone access in your browser to use this feature.
                        </AlertDescription>
                    </Alert>
                )}

                {hasPermission && (
                    <>
                        <div className="relative flex items-center justify-center h-[104px] w-[104px]">
                            {(recordingStatus === "recording") && (
                                <div className="absolute inset-0 rounded-full bg-muted animate-pulse"></div>
                            )}
                            <Button
                                variant={recordingStatus === "recording" ? "secondary" : "default"}
                                size="icon"
                                onClick={handleMicButtonClick}
                                disabled={recordingStatus === 'permission-pending' || recordingStatus === 'sharing'}
                                className="h-24 w-24 rounded-full shadow-lg relative"
                            >
                               {getButtonIcon()}
                            </Button>
                        </div>
                        
                         <p className="text-lg text-muted-foreground font-mono w-24 text-center h-7">
                           {formatTime(duration)}
                        </p>

                        <div className="w-full max-w-sm h-20">
                            <canvas ref={canvasRef} className="w-full h-full" />
                        </div>
                        
                         <div className="w-full max-w-xs mx-auto flex items-center justify-between h-16">
                           <Button size="icon" variant="secondary" className="rounded-full h-10 w-10" onClick={handleRetake}>
                                <RefreshCw className="h-5 w-5" />
                           </Button>

                           {(recordingStatus === 'recording' || recordingStatus === 'paused') ? (
                             <Button size="icon" variant="destructive" className="rounded-full h-10 w-10" onClick={stopRecording}>
                                <StopCircle className="h-6 w-6" />
                             </Button>
                           ) : (
                               <Button size="icon" className="rounded-full h-10 w-10 bg-primary hover:bg-primary/90" onClick={handleShare} disabled={!recordedAudioUrl || recordingStatus === 'sharing'}>
                                    {recordingStatus === "sharing" ? <Loader2 className="h-5 w-5 animate-spin"/> : <Send className="h-5 w-5" />}
                               </Button>
                           )}
                         </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}
