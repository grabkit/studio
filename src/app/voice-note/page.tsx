
"use client";

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Mic, Play, Square, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useState, useEffect, useRef, useCallback } from "react";
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

    // Refs for recording logic
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

    // Refs for waveform visualization
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const animationFrameIdRef = useRef<number | null>(null);

    const maxDuration = 30; // 30 seconds

    const drawWaveform = useCallback(() => {
        if (!analyserRef.current || !canvasRef.current) return;

        const analyser = analyserRef.current;
        const canvas = canvasRef.current;
        const canvasCtx = canvas.getContext('2d');
        if (!canvasCtx) return;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        const draw = () => {
            animationFrameIdRef.current = requestAnimationFrame(draw);

            analyser.getByteTimeDomainData(dataArray);

            canvasCtx.fillStyle = 'hsl(var(--background))';
            canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

            canvasCtx.lineWidth = 2;
            canvasCtx.strokeStyle = 'hsl(var(--primary))';
            canvasCtx.beginPath();

            const sliceWidth = canvas.width * 1.0 / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = v * canvas.height / 2;

                if (i === 0) {
                    canvasCtx.moveTo(x, y);
                } else {
                    canvasCtx.lineTo(x, y);
                }

                x += sliceWidth;
            }

            canvasCtx.lineTo(canvas.width, canvas.height / 2);
            canvasCtx.stroke();
        };

        draw();
    }, []);

    const setupAudioVisualization = useCallback((stream: MediaStream) => {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const audioContext = audioContextRef.current;
        
        // Ensure old connections are closed before creating new ones
        if(sourceRef.current) {
            sourceRef.current.disconnect();
        }
        
        sourceRef.current = audioContext.createMediaStreamSource(stream);
        
        if (!analyserRef.current) {
            analyserRef.current = audioContext.createAnalyser();
        }
        
        analyserRef.current.fftSize = 2048;
        sourceRef.current.connect(analyserRef.current);
        
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
        }
        drawWaveform();
    }, [drawWaveform]);


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
                     if (animationFrameIdRef.current) {
                        cancelAnimationFrame(animationFrameIdRef.current);
                    }
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
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            if (animationFrameIdRef.current) cancelAnimationFrame(animationFrameIdRef.current);
            sourceRef.current?.disconnect();
            audioContextRef.current?.close();
        };

    }, [router, toast, setupAudioVisualization]);


    const startRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "inactive") {
            // Setup visualization with the active stream before starting
            if (mediaRecorderRef.current.stream) {
                 setupAudioVisualization(mediaRecorderRef.current.stream);
            }
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
             if (animationFrameIdRef.current) {
                cancelAnimationFrame(animationFrameIdRef.current);
                animationFrameIdRef.current = null;
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
                        <div className="flex-grow flex flex-col items-center justify-center w-full">
                            <div className="w-full max-w-md h-24 mb-6">
                                <canvas ref={canvasRef} className="w-full h-full" width="600" height="100"></canvas>
                            </div>
                           
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
                                    {recordingStatus === "recording" ? <Square className="h-16 w-16" fill="currentColor" /> : <Mic className="h-20 w-20" />}
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
