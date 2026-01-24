
"use client";

import * as React from "react";
import { useState, Suspense, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { collection, serverTimestamp, setDoc, doc, updateDoc, getDoc, writeBatch, Timestamp } from "firebase/firestore";
import { useFirebase, useDoc, useMemoFirebase } from "@/firebase";
import type { Post, QuotedPost, Notification } from "@/lib/types";
import { WithId } from "@/firebase/firestore/use-collection";


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
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Loader2, X, ListOrdered, Plus, Link as LinkIcon, Image as ImageIcon, CalendarClock, Mic, Play, Square, RefreshCw, Send, Pause, StopCircle, Check } from "lucide-react";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn, getAvatar, formatUserId, formatTimestamp } from "@/lib/utils";
import type { LinkMetadata } from "@/lib/types";
import Image from "next/image";
import { QuotedPostCard } from "@/components/QuotedPostCard";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

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
]).refine(data => !!data.content || !!data.linkMetadata || !!data.quotedPost || !!data.audioUrl, {
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

type AudioRecordingStatus = "idle" | "permission-pending" | "recording" | "paused_recording" | "preview" | "playing_preview" | "attaching";

function AudioRecorderSheet({ onAttach, onOpenChange }: { onAttach: (data: { url: string, waveform: number[], duration: number }) => void, onOpenChange: (open: boolean) => void }) {
    const { toast } = useToast();
    const [status, setStatus] = useState<AudioRecordingStatus>("permission-pending");
    const [duration, setDuration] = useState(0); // in ms
    const [recordedAudio, setRecordedAudio] = useState<{ url: string; blob: Blob; waveform: number[] } | null>(null);
    const [previewTime, setPreviewTime] = useState(0);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const liveWaveformRef = useRef<number[]>([]);
    const animationFrameRef = useRef<number>();
    const timerRef = useRef<number>();
    const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    const formatTime = (timeInMs: number, showMillis: boolean = true) => {
        const totalSeconds = Math.floor(timeInMs / 1000);
        const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const seconds = (totalSeconds % 60).toString().padStart(2, '0');
        const milliseconds = Math.floor((timeInMs % 1000) / 10).toString().padStart(2, '0');
        return showMillis ? `${minutes}:${seconds}.${milliseconds}` : `${minutes}:${seconds}`;
    };

    const drawLiveWaveform = useCallback(() => {
        if (status !== 'recording' || !analyserRef.current || !canvasRef.current) return;

        const analyser = analyserRef.current;
        const canvas = canvasRef.current;
        const canvasCtx = canvas.getContext('2d');
        if (!canvasCtx) return;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(dataArray);

        let sum = 0;
        for (const amplitude of dataArray) {
            sum += Math.pow((amplitude / 128.0) - 1, 2);
        }
        const volume = Math.sqrt(sum / dataArray.length);
        liveWaveformRef.current.push(volume);

        const width = canvas.width;
        const height = canvas.height;
        canvasCtx.clearRect(0, 0, width, height);
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = 'hsl(var(--primary))';
        canvasCtx.beginPath();
        const sliceWidth = width * 1.0 / liveWaveformRef.current.length;
        let x = 0;
        for (let i = 0; i < liveWaveformRef.current.length; i++) {
            const v = liveWaveformRef.current[i] * 2.0; // Amplify
            const y = (v * height) / 2;
            if (i === 0) canvasCtx.moveTo(x, y);
            else canvasCtx.lineTo(x, y);
            x += sliceWidth;
        }
        canvasCtx.lineTo(width, height / 2);
        canvasCtx.stroke();
        animationFrameRef.current = requestAnimationFrame(drawLiveWaveform);
    }, [status]);
    
    const drawPreviewWaveform = useCallback(() => {
        if (!recordedAudio || !canvasRef.current) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const waveform = recordedAudio.waveform;
        
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        const middle = height / 2;
        const playheadX = width / 2;

        const audioDuration = recordedAudio.blob.size / (44100 * 2) * 1000;
        const pixelsPerMs = width / 5000;
        const scrollOffset = previewTime * pixelsPerMs;

        ctx.clearRect(0, 0, width, height);

        // Draw timestamps
        ctx.font = "12px sans-serif";
        ctx.fillStyle = "hsl(var(--muted-foreground))";
        const timeInterval = 1000; // 1 second
        const startMs = Math.max(0, (scrollOffset - playheadX) / pixelsPerMs);
        
        for (let t = Math.ceil(startMs / timeInterval) * timeInterval; (t * pixelsPerMs) - scrollOffset < width; t += timeInterval) {
            const x = (t * pixelsPerMs) - scrollOffset;
            if(x > 0 && x < width) {
                ctx.fillText(formatTime(t, false), x, height - 5);
            }
        }
        
        // Draw playhead
        ctx.strokeStyle = "hsl(var(--muted-foreground))";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, height);
        ctx.stroke();

        // Draw waveform
        const barWidth = 3;
        const barGap = 2;

        for (let i = 0; i < waveform.length; i++) {
            const x = i * (barWidth + barGap) - scrollOffset;
            const barHeight = Math.max(1, waveform[i] * height * 0.9);

            if (x + barWidth < 0 || x > width) continue;

            const isPlayed = x < playheadX;
            ctx.fillStyle = isPlayed ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.5)';
            ctx.fillRect(x, middle - barHeight / 2, barWidth, barHeight);
        }

        if (status === 'playing_preview') {
            animationFrameRef.current = requestAnimationFrame(drawPreviewWaveform);
        }

    }, [recordedAudio, previewTime, status]);

    useEffect(() => {
        if (status === 'playing_preview' || status === 'preview' || status === 'paused_preview') {
            drawPreviewWaveform();
        }
    }, [status, drawPreviewWaveform]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && status === 'recording') {
            mediaRecorderRef.current.stop();
            cancelAnimationFrame(animationFrameRef.current!);
            clearInterval(timerRef.current!);
            setStatus('preview');
        }
    }, [status]);
    
    useEffect(() => {
        async function getPermission() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                analyserRef.current = audioContextRef.current.createAnalyser();
                const source = audioContextRef.current.createMediaStreamSource(stream);
                source.connect(analyserRef.current);
                
                mediaRecorderRef.current = new MediaRecorder(stream);
                mediaRecorderRef.current.ondataavailable = (e) => {
                    if (e.data.size > 0) audioChunksRef.current.push(e.data);
                };
                mediaRecorderRef.current.onstop = async () => {
                    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                    const url = URL.createObjectURL(blob);
                    
                    const decodedBuffer = await audioContextRef.current!.decodeAudioData(await blob.arrayBuffer());
                    const channelData = decodedBuffer.getChannelData(0);
                    const samples = 200; 
                    const blockSize = Math.floor(channelData.length / samples);
                    const waveform = [];
                    let maxAmp = 0;
                    for (let i = 0; i < samples; i++) {
                        let sum = 0;
                        for (let j = 0; j < blockSize; j++) {
                            sum += Math.abs(channelData[i * blockSize + j]);
                        }
                        const amp = sum / blockSize;
                        waveform.push(amp);
                        if (amp > maxAmp) maxAmp = amp;
                    }
                    const normalizedWaveform = waveform.map(a => a / maxAmp);
                    setRecordedAudio({ url, blob, waveform: normalizedWaveform });
                    setStatus('preview');
                };
                setStatus('idle');
            } catch (err) {
                toast({ variant: 'destructive', title: 'Microphone access denied.' });
                onOpenChange(false);
            }
        }
        getPermission();
        
        const player = new Audio();
        audioPlayerRef.current = player;
        
        const onTimeUpdate = () => setPreviewTime(player.currentTime * 1000);
        const onEnded = () => {
             setStatus('preview');
             player.currentTime = 0;
             setPreviewTime(0);
        };

        player.addEventListener('timeupdate', onTimeUpdate);
        player.addEventListener('ended', onEnded);

        return () => {
            mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
            audioContextRef.current?.close();
            player.removeEventListener('timeupdate', onTimeUpdate);
            player.removeEventListener('ended', onEnded);
        }
    }, [onOpenChange, toast]);

    const handleRecord = () => {
        if(audioContextRef.current?.state === 'suspended') {
            audioContextRef.current.resume();
        }
        audioChunksRef.current = [];
        liveWaveformRef.current = [];
        mediaRecorderRef.current?.start(100);
        setStatus('recording');
        const startTime = Date.now();
        timerRef.current = window.setInterval(() => setDuration(Date.now() - startTime), 10);
        requestAnimationFrame(drawLiveWaveform);
    };

    const handlePreviewPlayPause = () => {
        const player = audioPlayerRef.current;
        if (!player || !recordedAudio) return;
        
        if (status === 'playing_preview') {
            player.pause();
            setStatus('preview');
        } else {
            player.src = recordedAudio.url;
            player.play();
            setStatus('playing_preview');
        }
    };
    
    const handleAttach = () => {
        if (!recordedAudio) return;
        setStatus('attaching');
        onAttach({
            url: recordedAudio.url,
            waveform: recordedAudio.waveform,
            duration: Math.floor(duration / 1000)
        });
        onOpenChange(false);
    }
    
    const handleRetake = () => {
        setRecordedAudio(null);
        setDuration(0);
        setPreviewTime(0);
        setStatus('idle');
    }

    const renderContent = () => {
        if (status === 'idle' || status === 'permission-pending') {
            return (
                <>
                    <div className="text-center">
                        <p className="text-7xl font-mono tracking-tighter">00:00.00</p>
                        <p className="text-muted-foreground">High quality</p>
                    </div>
                    <div className="w-full h-24 my-8" />
                     <div className="flex justify-center items-center h-48">
                        <Button size="icon" className="h-24 w-24 rounded-full bg-red-500 hover:bg-red-600 shadow-lg" onClick={handleRecord}>
                            <Mic className="h-12 w-12" />
                        </Button>
                    </div>
                </>
            );
        }
        
        if (status === 'recording') {
             return (
                <>
                    <div className="text-center">
                        <p className="text-7xl font-mono tracking-tighter text-red-500">{formatTime(duration)}</p>
                        <p className="text-muted-foreground">Recording...</p>
                    </div>
                    <canvas ref={canvasRef} width="300" height="100" className="w-full h-24 my-8" />
                    <div className="flex justify-center items-center h-48">
                        <Button size="icon" className="h-24 w-24 rounded-full bg-red-500 hover:bg-red-600 shadow-lg" onClick={stopRecording}>
                            <Square className="h-10 w-10 fill-white" />
                        </Button>
                    </div>
                </>
            );
        }

        if (status === 'preview' || status === 'playing_preview') {
             return (
                <>
                    <div className="text-center">
                        <p className="text-7xl font-mono tracking-tighter">{formatTime(duration)}</p>
                        <p className="text-muted-foreground">High quality</p>
                    </div>
                     <canvas ref={canvasRef} width="600" height="150" className="w-full h-24 my-8" />
                    <div className="flex justify-around items-center h-48 w-full max-w-sm">
                        <Button size="icon" variant="ghost" className="h-20 w-20 rounded-full" onClick={handleRetake}>
                             <RefreshCw className="h-8 w-8 text-muted-foreground" />
                        </Button>
                         <Button size="icon" className="h-24 w-24 rounded-full bg-red-500 hover:bg-red-600 shadow-lg" onClick={handleAttach}>
                            <Check className="h-12 w-12" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-20 w-20 rounded-full" onClick={handlePreviewPlayPause}>
                            {status === 'playing_preview' ? <Pause className="h-10 w-10 fill-foreground" /> : <Play className="h-10 w-10 fill-foreground" />}
                        </Button>
                    </div>
                </>
            );
        }
        
        return <Loader2 className="h-12 w-12 animate-spin"/>
    }

    return (
        <SheetContent side="bottom" className="rounded-t-2xl h-full flex flex-col p-6 items-center justify-between gap-2 pb-10">
            <Button variant="ghost" size="icon" className="absolute top-4 right-4" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
            </Button>
            {renderContent()}
        </SheetContent>
    );
}

function PostPageComponent() {
  const [isOpen, setIsOpen] = useState(true);
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
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
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

                                {linkMetadata ? (
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
                                ) : isFetchingPreview ? (
                                    <div className="border rounded-lg p-4 flex items-center justify-center">
                                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /><span className="ml-2 text-muted-foreground text-sm">Fetching preview...</span>
                                    </div>
                                ) : showLinkInput ? (
                                    <FormField control={form.control} name="linkMetadata.url" render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                 <div className="relative">
                                                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                    <Input placeholder="https://..." {...field} className="pl-9 bg-secondary" onBlur={(e) => fetchPreview(e.target.value)} />
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
            <AudioRecorderSheet onAttach={handleAttachAudio} onOpenChange={setIsRecorderOpen} />
        </Sheet>
      </SheetContent>
    </Sheet>
  );
}

export default function PostPage() {
  return (
    <Suspense>
      <PostPageComponent />
    </Suspense>
  );
}
