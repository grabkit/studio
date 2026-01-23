"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Play, Pause, Heart, MessageCircle, Repeat, ArrowUpRight, Bookmark as BookmarkIcon } from "lucide-react";
import type { Post, Bookmark, User } from '@/lib/types';
import { WithId } from '@/firebase/firestore/use-collection';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { getAvatar, formatUserId, formatTimestamp, cn, formatCount } from '@/lib/utils';
import Link from 'next/link';
import { doc } from 'firebase/firestore';

export function AudioPostCard({ post, bookmarks }: { post: WithId<Post>, bookmarks: WithId<Bookmark>[] | null }) {
    const { user, firestore } = useFirebase();
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationFrameId = useRef<number>();

    const { data: authorProfile } = useDoc<User>(useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'users', post.authorId);
    }, [firestore, post.authorId]));

    const avatar = getAvatar(authorProfile);
    const isAvatarUrl = avatar.startsWith('http');

    const drawWaveform = useCallback((progress: number = 0) => {
        const canvas = canvasRef.current;
        const waveform = post.audioWaveform;
        if (!canvas || !waveform) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        const barWidth = 3;
        const gap = 2;
        const numBars = Math.floor(width / (barWidth + gap));
        const step = Math.max(1, Math.floor(waveform.length / numBars));
        
        ctx.clearRect(0, 0, width, height);

        for (let i = 0; i < numBars; i++) {
            const waveIndex = i * step;
            const barHeight = (waveform[waveIndex] || 0) * height * 0.8 + height * 0.2;
            const x = i * (barWidth + gap);

            const isPlayed = (x / width) * 100 < progress;
            ctx.fillStyle = isPlayed ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))';
            ctx.fillRect(x, (height - barHeight) / 2, barWidth, barHeight);
        }
    }, [post.audioWaveform]);

    useEffect(() => {
        drawWaveform();
    }, [drawWaveform]);

    const handlePlayPause = () => {
        if (!audioRef.current) return;
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleTimeUpdate = () => {
        if (!audioRef.current) return;
        const newProgress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
        setProgress(newProgress);
        drawWaveform(newProgress);
    };

    const handleAudioEnded = () => {
        setIsPlaying(false);
        setProgress(0);
        drawWaveform(0);
    };

    // Dummy handlers for actions
    const handleLike = () => console.log("Like");
    const handleBookmark = () => console.log("Bookmark");
    
    const isBookmarked = useMemo(() => bookmarks?.some(b => b.postId === post.id), [bookmarks, post.id]);
    const hasLiked = useMemo(() => user && post.likes?.includes(user.uid), [post.likes, user]);


    return (
        <Card className="w-full shadow-none border-x-0 border-t-0 rounded-none">
            <CardContent className="px-4 pt-4 pb-2">
                <div className="flex space-x-3">
                    <Link href={`/profile/${post.authorId}`}>
                        <Avatar className="h-10 w-10">
                            <AvatarImage src={isAvatarUrl ? avatar : undefined} alt={String(formatUserId(post.authorId))} />
                            <AvatarFallback>{!isAvatarUrl ? avatar : ''}</AvatarFallback>
                        </Avatar>
                    </Link>
                    <div className="flex-1">
                        <div className="flex items-center space-x-1.5 -mb-1">
                            <Link href={`/profile/${post.authorId}`} className="text-sm font-semibold hover:underline">
                                {formatUserId(post.authorId)}
                            </Link>
                            <div className="text-xs text-muted-foreground">· {post.timestamp ? formatTimestamp(post.timestamp.toDate()) : ''}</div>
                        </div>

                        {post.content && <p className="text-foreground text-sm whitespace-pre-wrap mt-2">{post.content}</p>}

                        <div className="mt-4 border rounded-xl p-4 flex items-center gap-4 bg-secondary/50">
                            <audio ref={audioRef} src={post.audioUrl} onTimeUpdate={handleTimeUpdate} onEnded={handleAudioEnded} />
                            <Button size="icon" onClick={handlePlayPause} className="rounded-full h-12 w-12 flex-shrink-0">
                                {isPlaying ? <Pause className="h-6 w-6" fill="currentColor" /> : <Play className="h-6 w-6" fill="currentColor" />}
                            </Button>
                            <div className="flex-1 h-12 flex items-center">
                                <canvas ref={canvasRef} className="w-full h-full" />
                            </div>
                        </div>

                        <div className="mt-4 flex items-center justify-around">
                            <button onClick={handleLike} className={cn("flex items-center space-x-1 p-2 -m-2", hasLiked && "text-pink-500")}>
                                <Heart className="h-4 w-4" fill={hasLiked ? "currentColor" : "none"} />
                                <span className="text-xs">{formatCount(post.likeCount)}</span>
                            </button>
                            <Link href={`/post/${post.id}`} className="flex items-center space-x-1 p-2 -m-2">
                                <MessageCircle className="h-4 w-4" />
                                <span className="text-xs">{formatCount(post.commentCount)}</span>
                            </Link>
                            <button className="flex items-center space-x-1 p-2 -m-2">
                                <Repeat className="h-4 w-4" />
                                <span className="text-xs">{formatCount(post.repostCount)}</span>
                            </button>
                            <button onClick={handleBookmark} className={cn("flex items-center space-x-1 p-2 -m-2", isBookmarked && "text-amber-500")}>
                                <BookmarkIcon className="h-4 w-4" fill={isBookmarked ? "currentColor" : "none"} />
                            </button>
                            <button className="flex items-center space-x-1 p-2 -m-2">
                                <ArrowUpRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
