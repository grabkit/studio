"use client";

import * as React from "react";
import { useState, Suspense, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { collection, serverTimestamp, setDoc, doc, updateDoc, getDoc, writeBatch, Timestamp } from "firebase/firestore";
import { useFirebase, useDoc, useMemoFirebase } from "@/firebase";
import type { Post, QuotedPost, Notification, Event, EventDetails } from "@/lib/types";
import { WithId } from "@/firebase/firestore/use-collection";
import ngeohash from "ngeohash";


import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetClose,
  SheetHeader,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel, FormDescription } from "@/components/ui/form";
import { Loader2, X, ListOrdered, Plus, Link as LinkIcon, Image as ImageIcon, CalendarClock, Mic, Play, Square, RefreshCw, Send, Pause, StopCircle, Check, Circle, Undo2, CalendarPlus } from "lucide-react";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn, getAvatar, formatUserId, getCoordsForCity } from "@/lib/utils";
import type { LinkMetadata } from "@/lib/types";
import Image from "next/image";
import { QuotedPostCard } from "@/components/QuotedPostCard";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Slider } from "@/components/ui/slider";

const pollOptionSchema = z.object({
  option: z.string().min(1, "Option cannot be empty.").max(100, "Option is too long."),
});

const linkMetadataSchema = z.object({
    url: z.string().url(),
    title: z.string().optional(),
    description: z.string().optional(),
    imageUrl: z.string().url().optional(),
    faviconUrl: z.string().url().optional(),
}).optional();

const quotedPostSchema = z.object({
    id: z.string(),
    authorId: z.string(),
    authorName: z.string(),
    authorAvatar: z.string(),
    content: z.string(),
    timestamp: z.any(),
}).optional();


const baseSchema = z.object({
  content: z.string().max(560, "Post is too long.").optional(),
  commentsAllowed: z.boolean().default(true),
  linkMetadata: linkMetadataSchema,
  quotedPost: quotedPostSchema,
  expiration: z.number().optional(), // duration in seconds
  audioUrl: z.string().optional(),
  audioWaveform: z.array(z.number()).optional(),
  audioDuration: z.number().optional(),
  eventDetails: z.any().optional(),
});

// Schema for a standard text post
const textPostSchema = baseSchema.extend({
  isPoll: z.literal(false),
});

// Schema for a poll post
const pollPostSchema = baseSchema.extend({
  isPoll: z.literal(true),
  pollOptions: z
    .array(pollOptionSchema)
    .min(2, "A poll must have at least 2 options.")
    .max(4, "A poll can have at most 4 options."),
});

// Use a discriminated union to validate based on the `isPoll` flag
const postSchema = z.discriminatedUnion("isPoll", [
  textPostSchema,
  pollPostSchema,
]).refine(data => !!data.content || !!data.linkMetadata || !!data.quotedPost || !!data.audioUrl || !!data.eventDetails, {
    message: "Post cannot be empty.",
    path: ["content"],
});

const expirationOptions = [
    { label: '30 Minutes', value: 30 * 60 },
    { label: '1 Hour', value: 60 * 60 },
    { label: '6 Hours', value: 6 * 60 * 60 },
    { label: '1 Day', value: 24 * 60 * 60 },
    { label: '7 Days', value: 7 * 24 * 60 * 60 },
];

type AudioRecordingStatus = "idle" | "permission-pending" | "recording" | "paused" | "recorded" | "sharing";

function AudioRecorderSheet({ onAttach, onOpenChange }: { onAttach: (data: { url: string, waveform: number[], duration: number }) => void, onOpenChange: (open: boolean) => void }) {
    const { toast } = useToast();
    const [recordingStatus, setRecordingStatus] = useState<AudioRecordingStatus>("permission-pending");
    const [hasPermission, setHasPermission] = useState(false);
    const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
    const [duration, setDuration] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
    
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const animationFrameIdRef = useRef<number | null>(null);
    const [isPlayingPreview, setIsPlayingPreview] = useState(false);
    const [waveform, setWaveform] = useState<number[]>([]);
    
    const maxDuration = 30; // 30 seconds
    const waveformSamples = 100;

    const drawWaveform = useCallback((waveformData: number[], progress: number = 0) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const barWidth = 3;
        const gap = 2;
        const numBars = waveformData.length;
        
        for (let i = 0; i < numBars; i++) {
            const barHeight = Math.max(1, (waveformData[i] || 0) * canvas.height * 0.9);
            const x = i * (barWidth + gap);
            const isPlayed = (i / numBars) * 100 < progress;
            
            ctx.fillStyle = isPlayed ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))';
            ctx.fillRect(x, (canvas.height - barHeight) / 2, barWidth, barHeight);
        }
    }, []);
    
    const stopVisualization = useCallback(() => {
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
        }
    }, []);

    const visualize = useCallback((stream: MediaStream, onSample: (sample: number) => void) => {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const audioContext = audioContextRef.current;
        if(audioContext.state === 'suspended') { audioContext.resume(); }

        if (!analyserRef.current) {
            analyserRef.current = audioContext.createAnalyser();
            analyserRef.current.fftSize = 256;
            analyserRef.current.smoothingTimeConstant = 0.6;
        }
        
        if (!sourceNodeRef.current || sourceNodeRef.current.mediaStream.id !== stream.id) {
            if (sourceNodeRef.current) {
                sourceNodeRef.current.disconnect();
            }
            sourceNodeRef.current = audioContext.createMediaStreamSource(stream);
            sourceNodeRef.current.connect(analyserRef.current);
        }

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const animate = () => {
            animationFrameIdRef.current = requestAnimationFrame(animate);
            
            analyserRef.current?.getByteFrequencyData(dataArray);
            let sum = 0;
            for(let i=0; i<bufferLength; i++) {
                sum += dataArray[i];
            }
            const average = sum / bufferLength;
            onSample(average / 255);
        };
        
        if (animationFrameIdRef.current === null) {
          animate();
        }

    }, []);

     useEffect(() => {
        let liveWaveform: number[] = [];

        const animate = () => {
            if (recordingStatus === 'recording' && mediaRecorderRef.current) {
                 visualize(mediaRecorderRef.current.stream, (sample) => {
                    const canvas = canvasRef.current;
                    if (!canvas) return;
                    const barWidth = 3;
                    const gap = 2;
                    const maxBars = Math.floor(canvas.clientWidth / (barWidth + gap));
                    
                    liveWaveform.push(sample);
                    if (liveWaveform.length > maxBars) {
                        liveWaveform.shift();
                    }
                    drawWaveform(liveWaveform, 100);
                });
            }
        };

        if (recordingStatus === 'recording') {
            const id = requestAnimationFrame(animate);
            return () => cancelAnimationFrame(id);
        } else {
            stopVisualization();
        }
    }, [recordingStatus, visualize, drawWaveform, stopVisualization]);


    const handleTimeUpdate = useCallback(() => {
        const player = audioPlayerRef.current;
        if (!player || player.paused) return;
        const progress = (player.currentTime / player.duration) * 100;
        drawWaveform(waveform, progress);
    }, [waveform, drawWaveform]);
    
    useEffect(() => {
        const player = audioPlayerRef.current;
        const onEnded = () => {
             setIsPlayingPreview(false);
             if (player) player.currentTime = 0;
             drawWaveform(waveform, 0);
        };

        player?.addEventListener('timeupdate', handleTimeUpdate);
        player?.addEventListener('ended', onEnded);
        player?.addEventListener('play', () => setIsPlayingPreview(true));
        player?.addEventListener('pause', () => setIsPlayingPreview(false));

        return () => {
            player?.removeEventListener('timeupdate', handleTimeUpdate);
            player?.removeEventListener('ended', onEnded);
            player?.removeEventListener('play', () => setIsPlayingPreview(true));
            player?.removeEventListener('pause', () => setIsPlayingPreview(false));
        }
    }, [handleTimeUpdate, waveform, drawWaveform]);

    useEffect(() => {
        async function getPermission() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                setHasPermission(true);
                setRecordingStatus("idle");

                mediaRecorderRef.current = new MediaRecorder(stream);
                
                mediaRecorderRef.current.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
                
                mediaRecorderRef.current.onstop = () => {
                    const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorderRef.current?.mimeType });
                    
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64data = reader.result as string;
                        setRecordedAudioUrl(base64data);
                    };
                    reader.readAsDataURL(audioBlob);

                    setRecordingStatus("recorded");
                    audioChunksRef.current = [];
                    stopVisualization();
                };
            } catch (err) {
                toast({ variant: 'destructive', title: 'Microphone access denied.' });
                onOpenChange(false);
            }
        }
        getPermission();
        return () => { 
            mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close();
            }
         }
    }, [onOpenChange, toast, stopVisualization]);

    const startRecording = async () => {
        if (mediaRecorderRef.current) {
            if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
              audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            if (audioContextRef.current.state === 'suspended') {
              await audioContextRef.current.resume();
            }

            if (mediaRecorderRef.current.state === "paused") {
                mediaRecorderRef.current.resume();
            } else {
                audioChunksRef.current = [];
                setRecordedAudioUrl(null);
                setDuration(0);
                mediaRecorderRef.current.start(100);
            }
            
            setRecordingStatus('recording');
            timerIntervalRef.current = setInterval(() => {
                setDuration(prev => {
                    if (prev >= maxDuration) {
                        stopRecording();
                        return maxDuration;
                    }
                    return prev + 1;
                });
            }, 1000);
        }
    };
    
    const pauseRecording = () => {
        if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.pause();
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            setRecordingStatus("paused");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current?.state === "recording" || mediaRecorderRef.current.state === "paused") {
            mediaRecorderRef.current.stop();
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
        }
    }
    
    const handlePlayPausePreview = () => {
        if (!audioPlayerRef.current) audioPlayerRef.current = new Audio();
        const player = audioPlayerRef.current;
        if (!player || !recordedAudioUrl) return;
        
        if (player.paused) {
            player.src = recordedAudioUrl;
            player.play();
        } else {
            player.pause();
        }
    };
    
    const handleAttach = async () => {
        if (!recordedAudioUrl) return;
        if (audioPlayerRef.current) audioPlayerRef.current.pause();
        
        onAttach({ url: recordedAudioUrl, waveform: waveform, duration: Math.floor(duration) });
        onOpenChange(false);
    }
    
    const handleRetake = () => {
        if (audioPlayerRef.current) audioPlayerRef.current.pause();
        setRecordedAudioUrl(null);
        setDuration(0);
        setWaveform([]);
        setRecordingStatus('idle');
    }

    const formatTime = (timeInSeconds: number) => {
        const minutes = Math.floor(timeInSeconds / 60).toString().padStart(2, '0');
        const seconds = Math.floor(timeInSeconds % 60).toString().padStart(2, '0');
        return `${minutes}:${seconds}`;
    };
    
     useEffect(() => {
        async function processAudioForWaveform() {
            if (recordingStatus !== 'recorded' || !recordedAudioUrl) return;

            if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
              audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }

            const response = await fetch(recordedAudioUrl);
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const decodedBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
            const channelData = decodedBuffer.getChannelData(0);
            
            let calculatedWaveform = [];
            let maxAmp = 0;
            const blockSize = Math.floor(channelData.length / waveformSamples);
            for (let i = 0; i < waveformSamples; i++) {
                let sum = 0;
                for (let j = 0; j < blockSize; j++) { sum += Math.abs(channelData[i * blockSize + j]); }
                const amp = sum / blockSize;
                calculatedWaveform.push(amp);
                if (amp > maxAmp) maxAmp = amp;
            }
            const normalizedWaveform = calculatedWaveform.map(a => maxAmp > 0 ? a / maxAmp : 0);
            setWaveform(normalizedWaveform);
            drawWaveform(normalizedWaveform, 0);
        }
        processAudioForWaveform();
    }, [recordingStatus, recordedAudioUrl, drawWaveform]);


    return (
        <SheetContent side="bottom" className="h-auto p-4 rounded-t-2xl">
            <SheetHeader className="text-center mb-4">
                <SheetTitle>Voice Post</SheetTitle>
            </SheetHeader>
            
            <div className="flex flex-col items-center gap-4">
                <p className="text-2xl font-mono tracking-tighter text-center h-8">
                    {formatTime(duration)} / {formatTime(maxDuration)}
                </p>

                <div className="w-full h-20 bg-secondary rounded-lg">
                     <canvas ref={canvasRef} className="w-full h-full" />
                </div>
                
                {recordingStatus === 'idle' && (
                     <Button size="icon" className="h-16 w-16 rounded-full" onClick={startRecording}>
                        <Mic className="h-8 w-8" />
                    </Button>
                )}

                {(recordingStatus === 'recording' || recordingStatus === 'paused') && (
                    <div className="flex items-center justify-center gap-6">
                         <Button size="icon" variant="outline" className="h-12 w-12 rounded-full" onClick={recordingStatus === 'recording' ? pauseRecording : startRecording}>
                            {recordingStatus === 'recording' ? <Pause className="h-6 w-6" fill="currentColor" /> : <Mic className="h-6 w-6" />}
                        </Button>
                        <Button size="icon" variant="destructive" className="h-12 w-12 rounded-full" onClick={stopRecording}>
                            <Check className="h-6 w-6" />
                        </Button>
                    </div>
                )}
                
                {recordingStatus === 'recorded' && (
                     <div className="flex items-center justify-center gap-4">
                        <Button size="icon" variant="outline" className="h-12 w-12 rounded-full" onClick={handleRetake}>
                            <Undo2 className="h-6 w-6" />
                        </Button>
                        <Button size="icon" variant="default" className="h-16 w-16 rounded-full" onClick={handlePlayPausePreview}>
                            {isPlayingPreview ? <Pause className="h-7 w-7" fill="currentColor" /> : <Play className="h-7 w-7" fill="currentColor" />}
                        </Button>
                        <Button size="icon" variant="destructive" className="h-12 w-12 rounded-full" onClick={handleAttach}>
                            <Send className="h-6 w-6" />
                        </Button>
                    </div>
                )}
            </div>
            <audio ref={audioPlayerRef} className="hidden" />
        </SheetContent>
    );
}

function PostPageComponent() {
  const [isOpen, setIsOpen] = useState(true);
  const [isEventSheetOpen, setIsEventSheetOpen] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const [isExpirationSheetOpen, setIsExpirationSheetOpen] = useState(false);
  const [isRecorderOpen, setIsRecorderOpen] = useState(false);
  const [expirationLabel, setExpirationLabel] = useState("Never");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userProfile, firestore } = useFirebase();

  const postId = searchParams.get('postId');
  const quotePostId = searchParams.get('quotePostId');
  const isEditMode = !!postId;

  const quotePostRef = useMemoFirebase(() => {
    if (!quotePostId || !firestore) return null;
    return doc(firestore, 'posts', quotePostId);
  }, [quotePostId, firestore]);
  
  const { data: quotePostData } = useDoc<Post>(quotePostRef);

  const form = useForm<z.infer<typeof postSchema>>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      content: "",
      commentsAllowed: true,
      isPoll: false,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "pollOptions",
  });
  
  useEffect(() => {
    if (isEditMode && firestore && postId) {
      const fetchPostData = async () => {
        const postRef = doc(firestore, 'posts', postId);
        const postSnap = await getDoc(postRef);
        if (postSnap.exists()) {
          const postData = postSnap.data() as Post;
          
          let expirationInSeconds;
          let currentLabel = 'Never';
          if (postData.expiresAt) {
            expirationInSeconds = (postData.expiresAt.toMillis() - Date.now()) / 1000;
            const matchedOption = expirationOptions.find(opt => Math.abs(opt.value - expirationInSeconds!) < 60);
            if (matchedOption) currentLabel = matchedOption.label;
            else currentLabel = 'Custom';
          }

          form.reset({
            content: postData.content,
            commentsAllowed: postData.commentsAllowed,
            isPoll: postData.type === 'poll',
            quotedPost: postData.quotedPost,
            linkMetadata: postData.linkMetadata,
            expiration: expirationInSeconds,
            audioUrl: postData.audioUrl,
            audioWaveform: postData.audioWaveform,
            audioDuration: postData.audioDuration,
            eventDetails: postData.eventDetails,
          });
          setExpirationLabel(currentLabel);
        }
      };
      fetchPostData();
    }
  }, [isEditMode, postId, firestore, form]);

  useEffect(() => {
      if (quotePostData) {
          const quotedPostForForm: QuotedPost = {
              id: quotePostData.id,
              authorId: quotePostData.authorId,
              content: quotePostData.content || '',
              authorName: formatUserId(quotePostData.authorId).toString(),
              authorAvatar: getAvatar({id: quotePostData.authorId}),
              timestamp: quotePostData.timestamp,
          }
          form.setValue('quotedPost', quotedPostForForm, { shouldValidate: true });
      }
  }, [quotePostData, form]);

  const isPoll = form.watch("isPoll");
  const linkMetadata = form.watch("linkMetadata");
  const quotedPost = form.watch("quotedPost");
  const audioUrl = form.watch("audioUrl");
  const audioDuration = form.watch("audioDuration");

  const avatar = getAvatar(userProfile);
  const isAvatarUrl = avatar.startsWith('http');

  React.useEffect(() => {
    if (!isOpen) {
      setTimeout(() => router.back(), 300);
    }
  }, [isOpen, router]);

  const handlePaste = async (event: React.ClipboardEvent) => {
    if (linkMetadata || audioUrl) return;
    const pastedText = event.clipboardData.getData('text');
    try {
        const url = new URL(pastedText);
        setShowLinkInput(true);
        form.setValue("linkMetadata.url", url.href);
        fetchPreview(url.href);
    } catch (error) {
        // Not a valid URL
    }
  };

  const fetchPreview = async (url: string) => {
    setIsFetchingPreview(true);
    setTimeout(() => {
        const mockData: LinkMetadata = {
            url: url,
            title: "This is a fetched link title",
            description: "This is a longer description for the link that has been fetched from the website to show a rich preview.",
            imageUrl: `https://picsum.photos/seed/${Math.random()}/1200/630`,
            faviconUrl: `https://www.google.com/s2/favicons?sz=64&domain_url=${url}`
        };
        form.setValue("linkMetadata", mockData, { shouldValidate: true });
        setIsFetchingPreview(false);
        setShowLinkInput(false);
    }, 1500);
  };

  const onSubmit = (values: z.infer<typeof postSchema>) => {
    if (!user || !firestore) return;

    form.trigger();
    const { expiration, ...postValues } = values;
    
    if (isEditMode && postId) {
      const postRef = doc(firestore, `posts`, postId);
      const updatedData: Partial<Post> = {
        content: values.content,
        commentsAllowed: values.commentsAllowed,
        linkMetadata: values.linkMetadata,
        quotedPost: values.quotedPost,
      };
      if (expiration) updatedData.expiresAt = Timestamp.fromMillis(Date.now() + expiration * 1000);
      else updatedData.expiresAt = undefined;
      // ...
      updateDoc(postRef, updatedData).then(() => {
            form.reset();
            setIsOpen(false);
        }).catch((serverError) => {
            const permissionError = new FirestorePermissionError({ path: postRef.path, operation: 'update', requestResourceData: updatedData });
            errorEmitter.emit('permission-error', permissionError);
        });
    } else {
        const newPostRef = doc(collection(firestore, `posts`));
        let type: Post['type'] = 'text';
        if (values.isPoll) type = 'poll';
        else if (values.quotedPost) type = 'quote';
        else if (values.audioUrl) type = 'audio';
        else if (values.eventDetails) type = 'event';

        const newPostData: any = {
          id: newPostRef.id,
          authorId: user.uid,
          content: values.content,
          timestamp: serverTimestamp(),
          likes: [],
          likeCount: 0,
          commentCount: 0,
          repostCount: 0,
          commentsAllowed: values.commentsAllowed,
          isPinned: false,
          type: type,
          ...(values.linkMetadata && { linkMetadata: values.linkMetadata }),
          ...(values.quotedPost && { quotedPost: values.quotedPost }),
          ...(values.audioUrl && { 
              audioUrl: values.audioUrl,
              audioWaveform: values.audioWaveform,
              audioDuration: values.audioDuration
          }),
          ...(values.eventDetails && { eventDetails: values.eventDetails }),
        };

        if (expiration) newPostData.expiresAt = Timestamp.fromMillis(Date.now() + expiration * 1000);
        if (values.isPoll) {
            newPostData.pollOptions = values.pollOptions.map(opt => ({ option: opt.option, votes: 0 }));
            newPostData.voters = {};
        }

        setDoc(newPostRef, newPostData).then(() => {
            // ... (notification logic)
            form.reset();
            setIsOpen(false);
          }).catch((serverError) => {
            const permissionError = new FirestorePermissionError({ path: newPostRef.path, operation: 'create', requestResourceData: newPostData });
            errorEmitter.emit('permission-error', permissionError);
          });
      }
  };
  
  const handlePollToggle = () => {
    const currentIsPoll = form.getValues('isPoll');
    form.setValue('isPoll', !currentIsPoll, { shouldValidate: true });
    if (!currentIsPoll) {
        append({ option: '' });
        append({ option: '' });
    } else {
        remove();
    }
  };
  
  const handleSelectExpiration = (seconds: number, label: string) => {
    form.setValue('expiration', seconds);
    setExpirationLabel(label);
    setIsExpirationSheetOpen(false);
  };

  const handleClearExpiration = () => {
      form.setValue('expiration', undefined);
      setExpirationLabel('Never');
      setIsExpirationSheetOpen(false);
  };

  const handleAttachAudio = (data: { url: string, waveform: number[], duration: number }) => {
    form.setValue('audioUrl', data.url);
    form.setValue('audioWaveform', data.waveform);
    form.setValue('audioDuration', data.duration);
    form.trigger('content'); // Re-validate the form
  };

  const formatAudioDuration = (seconds: number | undefined) => {
    if (seconds === undefined) return '';
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <>
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent side="bottom" className="h-screen flex flex-col p-0 rounded-t-2xl">
        <SheetHeader className="sr-only">
            <SheetTitle>{isEditMode ? 'Edit Post' : 'Create Post'}</SheetTitle>
        </SheetHeader>
        <div className="z-10 flex items-center justify-between p-2 border-b bg-background sticky top-0 h-14">
          <div className="flex items-center gap-2">
            <SheetClose asChild><Button variant="ghost" size="icon"><X className="h-4 w-4" /></Button></SheetClose>
            <h2 className="text-base font-bold">{isEditMode ? 'Edit Post' : 'Create Post'}</h2>
          </div>
          <Button form="post-form" type="submit" disabled={form.formState.isSubmitting} className="rounded-full px-6 font-bold">
            {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isEditMode ? 'Save' : 'Post'}
          </Button>
        </div>
        
        <div className="flex-grow flex flex-col">
            <div className="flex-grow overflow-y-auto px-4">
                <div className="flex items-start space-x-4">
                    <Avatar>
                        <AvatarImage src={isAvatarUrl ? avatar : undefined} alt={formatUserId(user?.uid).toString()} />
                        <AvatarFallback>{!isAvatarUrl ? avatar : ''}</AvatarFallback>
                    </Avatar>
                     <div className="w-full">
                        <div className="flex justify-between items-center"><span className="font-semibold text-sm">{formatUserId(user?.uid)}</span></div>
                        <Form {...form}>
                            <form id="post-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField control={form.control} name="content" render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <Textarea placeholder={isPoll ? "Ask a question..." : "What's on your mind?"} className="border-none focus-visible:ring-0 !outline-none text-base resize-none -ml-2" rows={3} onPaste={handlePaste} {...field}/>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}/>

                                {audioUrl && (
                                    <div className="relative p-3 border rounded-lg flex items-center gap-3">
                                        <Play className="h-5 w-5 text-muted-foreground" />
                                        <div className="flex-1">
                                            <p className="text-sm font-medium">Voice Recording</p>
                                            <p className="text-xs text-muted-foreground">{formatAudioDuration(audioDuration)}</p>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => handleAttachAudio({ url: '', waveform: [], duration: 0 })}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                )}

                                {quotedPost && (
                                     <div className="relative">
                                         <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 bg-black/50 hover:bg-black/70 text-white hover:text-white rounded-full z-10" onClick={() => form.setValue("quotedPost", undefined)}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                        <QuotedPostCard post={quotedPost} />
                                     </div>
                                )}

                                {linkMetadata && linkMetadata.url && (
                                    <div className="mt-3 border rounded-lg overflow-hidden relative">
                                        <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7 bg-black/50 hover:bg-black/70 text-white hover:text-white rounded-full z-10" onClick={() => form.setValue("linkMetadata", undefined)}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                        {linkMetadata.imageUrl && <div className="relative aspect-video bg-secondary"><Image src={linkMetadata.imageUrl} alt={linkMetadata.title || 'Link preview'} fill className="object-cover"/></div>}
                                        <div className="p-3 bg-secondary/50">
                                            <p className="text-xs text-muted-foreground uppercase tracking-wider">{new URL(linkMetadata.url).hostname.replace('www.','')}</p>
                                            <p className="font-semibold text-sm truncate mt-0.5">{linkMetadata.title || linkMetadata.url}</p>
                                        </div>
                                    </div>
                                )}
                                
                                {isFetchingPreview ? (
                                    <div className="border rounded-lg p-4 flex items-center justify-center">
                                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /><span className="ml-2 text-muted-foreground text-sm">Fetching preview...</span>
                                    </div>
                                ) : showLinkInput ? (
                                    <FormField control={form.control} name="linkMetadata.url" render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                 <div className="relative">
                                                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                    <Input placeholder="https://..." {...field} value={field.value || ''} className="pl-9 bg-secondary" onBlur={(e) => fetchPreview(e.target.value)} />
                                                 </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}/>
                                ) : null}

                                 {isPoll && (
                                    <div className="space-y-2 mt-4">
                                        {fields.map((field, index) => (
                                            <FormField key={field.id} control={form.control} name={`pollOptions.${index}.option`} render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <div className="flex items-center gap-2">
                                                            <Input placeholder={`Option ${index + 1}`} {...field} className="bg-secondary"/>
                                                            {fields.length > 2 && <Button variant="ghost" size="icon" type="button" onClick={() => remove(index)} className="rounded-full bg-primary hover:bg-primary/80 text-primary-foreground h-6 w-6"><X className="h-4 w-4" /></Button>}
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}/>
                                        ))}
                                        {fields.length < 4 && <Button type="button" variant="outline" size="sm" onClick={() => append({option: ""})} className="w-full"><Plus className="h-4 w-4 mr-2" />Add option</Button>}
                                        <FormMessage>{form.formState.errors.pollOptions?.root?.message || form.formState.errors.pollOptions?.message}</FormMessage>
                                    </div>
                                 )}
                                 
                                <div className="p-4 border-t bg-background w-full fixed bottom-0 left-0 right-0">
                                    <div className="flex items-center space-x-1">
                                        <Button type="button" variant="ghost" size="icon" onClick={() => setShowLinkInput(!showLinkInput)} disabled={!!linkMetadata || isEditMode || !!audioUrl}>
                                            <LinkIcon className="h-5 w-5 text-muted-foreground" />
                                        </Button>
                                        <Button type="button" variant="ghost" size="icon" onClick={() => setIsRecorderOpen(true)} disabled={isEditMode || !!audioUrl || isPoll || !!linkMetadata}>
                                            <Mic className="h-5 w-5 text-muted-foreground" />
                                        </Button>
                                        <Button type="button" variant="ghost" size="icon" onClick={() => setIsEventSheetOpen(true)}>
                                            <CalendarPlus className="h-5 w-5 text-muted-foreground" />
                                        </Button>
                                        <Button type="button" variant="ghost" size="icon" onClick={handlePollToggle} disabled={isEditMode || !!audioUrl}>
                                            <ListOrdered className={cn("h-5 w-5 text-muted-foreground", isPoll && "text-primary")} />
                                        </Button>
                                        <div className="flex items-center gap-1">
                                            <Button type="button" variant="ghost" size="icon" onClick={() => setIsExpirationSheetOpen(true)}>
                                                <CalendarClock className="h-5 w-5 text-muted-foreground" />
                                            </Button>
                                            <span className="text-xs text-muted-foreground whitespace-nowrap">{expirationLabel}</span>
                                        </div>
                                            <FormField control={form.control} name="commentsAllowed" render={({ field }) => (
                                                <FormItem className="flex items-center space-x-2 space-y-0 pl-2">
                                                    <Switch id="comments-allowed" checked={field.value} onCheckedChange={field.onChange}/>
                                                    <Label htmlFor="comments-allowed" className="text-sm">Replies</Label>
                                                </FormItem>
                                            )}/>
                                    </div>
                                </div>
                            </form>
                        </Form>
                    </div>
                </div>
            </div>
        </div>
      </SheetContent>
    </Sheet>
    <Sheet open={isEventSheetOpen} onOpenChange={setIsEventSheetOpen}>
        <EventFormSheet 
            onClose={() => setIsEventSheetOpen(false)}
            onPost={() => {
                setIsEventSheetOpen(false);
                setIsOpen(false);
            }}
        />
    </Sheet>
     <Sheet open={isExpirationSheetOpen} onOpenChange={setIsExpirationSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader className="pb-4"><SheetTitle>Post Expiration</SheetTitle><SheetDescription>The post will be deleted after this duration.</SheetDescription></SheetHeader>
            <div className="flex flex-col space-y-2">
                {expirationOptions.map(opt => (<Button key={opt.value} variant="outline" className="justify-start rounded-[5px]" onClick={() => handleSelectExpiration(opt.value, opt.label)}>{opt.label}</Button>))}
                <Button variant="outline" className="justify-start rounded-[5px]" onClick={handleClearExpiration}>Never Expire</Button>
            </div>
        </SheetContent>
    </Sheet>
    <Sheet open={isRecorderOpen} onOpenChange={setIsRecorderOpen}>
       {isRecorderOpen && <AudioRecorderSheet onAttach={handleAttachAudio} onOpenChange={setIsRecorderOpen} />}
    </Sheet>
    </>
  );
}

const eventSchema = z.object({
    name: z.string().min(3, "Event name must be at least 3 characters.").max(100),
    description: z.string().max(1000).optional(),
    type: z.enum(['public', 'private']),
    isPaid: z.boolean(),
    eventTimestamp: z.date({ required_error: "Please select a date and time."}),
    location: z.string().min(3, "Please enter a location."),
    reach: z.number().min(1).max(100),
    expiration: z.number().optional(),
});


function EventFormSheet({ onClose, onPost }: { onClose: () => void; onPost: () => void; }) {
    const { user, firestore } = useFirebase();
    const { toast } = useToast();
    const [expirationLabel, setExpirationLabel] = useState("Never");
    const [isExpirationSheetOpen, setIsExpirationSheetOpen] = useState(false);
    const [isLocationValid, setIsLocationValid] = useState(false);
    
    const form = useForm<z.infer<typeof eventSchema>>({
        resolver: zodResolver(eventSchema),
        defaultValues: {
            name: "",
            description: "",
            type: "public",
            isPaid: false,
            reach: 10,
            location: "",
        },
    });
    
    const locationValue = form.watch('location');

    useEffect(() => {
        if (getCoordsForCity(locationValue)) {
            setIsLocationValid(true);
        } else {
            setIsLocationValid(false);
        }
    }, [locationValue]);


    const onSubmit = async (values: z.infer<typeof eventSchema>) => {
        if (!user || !firestore) return;

        const coords = getCoordsForCity(values.location);
        if (!coords) {
            form.setError("location", { message: "Sorry, only major Indian cities are supported for now." });
            return;
        }

        const eventRef = doc(collection(firestore, 'events'));
        const postRef = doc(collection(firestore, 'posts'));
        
        const eventData: Omit<Event, 'id'> = {
            authorId: user.uid,
            name: values.name,
            description: values.description || '',
            type: values.type,
            isPaid: values.isPaid,
            eventTimestamp: Timestamp.fromDate(values.eventTimestamp),
            location: values.location,
            coordinates: coords,
            geohash: ngeohash.encode(coords.latitude, coords.longitude, 9),
            reach: values.reach,
        };

        const eventDetails: EventDetails = {
            id: eventRef.id,
            name: values.name,
            eventTimestamp: Timestamp.fromDate(values.eventTimestamp),
            location: values.location,
        };
        
        const postData: Partial<Post> = {
            id: postRef.id,
            authorId: user.uid,
            type: 'event',
            timestamp: serverTimestamp(),
            eventDetails: eventDetails,
            likes: [],
            likeCount: 0,
            commentCount: 0,
            repostCount: 0,
            commentsAllowed: true,
            isPinned: false,
        };
        
        if (values.expiration) {
            postData.expiresAt = Timestamp.fromMillis(Date.now() + values.expiration * 1000);
        }

        const batch = writeBatch(firestore);
        batch.set(eventRef, { ...eventData, id: eventRef.id });
        batch.set(postRef, postData);
        
        try {
            await batch.commit();
            toast({ title: "Event Created", description: "Your event has been posted." });
            onPost();
        } catch (error) {
            console.error("Error creating event:", error);
            const permissionError = new FirestorePermissionError({
                path: eventRef.path,
                operation: 'create',
                requestResourceData: { eventData, postData },
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: "destructive", title: "Error", description: "Could not create your event." });
        }
    };
    
    const handleSelectExpiration = (seconds: number, label: string) => {
        form.setValue('expiration', seconds);
        setExpirationLabel(label);
        setIsExpirationSheetOpen(false);
    };

    const handleClearExpiration = () => {
        form.setValue('expiration', undefined);
        setExpirationLabel('Never');
        setIsExpirationSheetOpen(false);
    };

    return (
        <>
        <SheetContent side="bottom" className="h-screen flex flex-col p-0 rounded-t-2xl">
            <SheetHeader className="sr-only"><SheetTitle>Create Event</SheetTitle></SheetHeader>
             <div className="z-10 flex items-center justify-between p-2 border-b bg-background sticky top-0 h-14">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
                    <h2 className="text-base font-bold">Create Event</h2>
                </div>
                <Button form="event-form" type="submit" disabled={form.formState.isSubmitting} className="rounded-full px-6 font-bold">
                    {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Post Event'}
                </Button>
            </div>
             <div className="flex-grow overflow-y-auto px-4 pb-20">
                <Form {...form}>
                    <form id="event-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Event Name</FormLabel><FormControl><Input placeholder="e.g. Weekend Tech Meetup" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={form.control} name="description" render={({ field }) => (
                            <FormItem><FormLabel>Short Description</FormLabel><FormControl><Textarea placeholder="What's your event about?" {...field} /></FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={form.control} name="eventTimestamp" render={({ field }) => (
                            <FormItem className="flex flex-col"><FormLabel>Date & Time</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                {field.value ? format(field.value, "PPP HH:mm") : <span>Pick a date and time</span>}
                                                <CalendarClock className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date < new Date()} />
                                        <div className="p-3 border-t">
                                            <Input
                                                type="time"
                                                value={field.value ? format(field.value, 'HH:mm') : ''}
                                                onChange={e => {
                                                    const newDate = field.value ? new Date(field.value) : new Date();
                                                    const [hours, minutes] = e.target.value.split(':');
                                                    if(!isNaN(parseInt(hours)) && !isNaN(parseInt(minutes))) {
                                                        newDate.setHours(parseInt(hours), parseInt(minutes));
                                                        field.onChange(newDate);
                                                    }
                                                }}
                                            />
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            <FormMessage /></FormItem>
                        )}/>
                        <FormField control={form.control} name="location" render={({ field }) => (
                             <FormItem><FormLabel>Location</FormLabel><FormControl>
                                <div className="relative">
                                    <Input placeholder="e.g. Hyderabad" {...field} />
                                    {isLocationValid && (
                                        <Check className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
                                    )}
                                </div>
                             </FormControl><FormMessage /></FormItem>
                        )}/>
                        <FormField control={form.control} name="reach" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Reach ({field.value} km)</FormLabel>
                                <FormControl>
                                    <Slider defaultValue={[field.value]} min={1} max={100} step={1} onValueChange={(value) => field.onChange(value[0])} />
                                </FormControl>
                            </FormItem>
                        )}/>
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="type" render={({ field }) => (
                                <FormItem className="space-y-0"><FormLabel>Type</FormLabel><FormControl><div className="flex items-center space-x-2 pt-2">
                                    <Button type="button" variant={field.value === 'public' ? 'default' : 'outline'} onClick={() => field.onChange('public')} className="flex-1">Public</Button>
                                    <Button type="button" variant={field.value === 'private' ? 'default' : 'outline'} onClick={() => field.onChange('private')} className="flex-1">Private</Button>
                                </div></FormControl></FormItem>
                            )}/>
                            <FormField control={form.control} name="isPaid" render={({ field }) => (
                                <FormItem className="space-y-0"><FormLabel>Cost</FormLabel><FormControl><div className="flex items-center space-x-2 pt-2">
                                    <Button type="button" variant={!field.value ? 'default' : 'outline'} onClick={() => field.onChange(false)} className="flex-1">Free</Button>
                                    <Button type="button" variant={field.value ? 'default' : 'outline'} onClick={() => field.onChange(true)} className="flex-1">Paid</Button>
                                </div></FormControl></FormItem>
                            )}/>
                        </div>
                         <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <FormLabel className="text-base">Post Expiration</FormLabel>
                                <FormDescription>{expirationLabel}</FormDescription>
                            </div>
                            <FormControl>
                                <Button type="button" variant="outline" onClick={() => setIsExpirationSheetOpen(true)}>Change</Button>
                            </FormControl>
                        </FormItem>
                    </form>
                </Form>
             </div>
        </SheetContent>
        <Sheet open={isExpirationSheetOpen} onOpenChange={setIsExpirationSheetOpen}>
            <SheetContent side="bottom" className="rounded-t-2xl">
                <SheetHeader className="pb-4"><SheetTitle>Post Expiration</SheetTitle><SheetDescription>The post will be deleted after this duration.</SheetDescription></SheetHeader>
                <div className="flex flex-col space-y-2">
                    {expirationOptions.map(opt => (<Button key={opt.value} variant="outline" className="justify-start rounded-[5px]" onClick={() => handleSelectExpiration(opt.value, opt.label)}>{opt.label}</Button>))}
                    <Button variant="outline" className="justify-start rounded-[5px]" onClick={handleClearExpiration}>Never Expire</Button>
                </div>
            </SheetContent>
        </Sheet>
        </>
    );
}

export default function PostPage() {
  return (
    <Suspense>
      <PostPageComponent />
    </Suspense>
  );
}
