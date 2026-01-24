
"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Play, Pause, Heart, MessageCircle, Repeat, ArrowUpRight, Bookmark as BookmarkIcon } from "lucide-react";
import type { Post, Bookmark, User, Notification } from '@/lib/types';
import { WithId } from '@/firebase/firestore/use-collection';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { getAvatar, formatUserId, formatTimestamp, cn, formatCount } from '@/lib/utils';
import Link from 'next/link';
import {
    doc,
    runTransaction,
    increment,
    arrayUnion,
    arrayRemove,
    setDoc,
    serverTimestamp,
    deleteDoc,
    collection,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { RepostSheet } from '@/components/RepostSheet';
import { ShareSheet } from '@/components/ShareSheet';

export function AudioPostCard({ post, bookmarks, updatePost }: {
    post: WithId<Post>,
    bookmarks: WithId<Bookmark>[] | null,
    updatePost?: (id: string, data: Partial<Post>) => void
}) {
    const { user, firestore } = useFirebase();
    const { toast } = useToast();
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [isLiking, setIsLiking] = useState(false);
    const [isRepostSheetOpen, setIsRepostSheetOpen] = useState(false);
    const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);

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

        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvas.clientWidth * dpr;
        canvas.height = canvas.clientHeight * dpr;
        ctx.scale(dpr, dpr);
        
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const barWidth = 3;
        const gap = 2;
        const numBars = Math.floor(width / (barWidth + gap));
        const step = Math.max(1, Math.floor(waveform.length / numBars));
        
        ctx.clearRect(0, 0, width, height);

        for (let i = 0; i < numBars; i++) {
            const waveIndex = i * step;
            const barHeight = Math.max(1, (waveform[waveIndex] || 0) * height * 0.9);
            const x = i * (barWidth + gap);

            const isPlayed = (x / width) * 100 < progress;
            ctx.fillStyle = isPlayed ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))';
            ctx.fillRect(x, (height - barHeight) / 2, barWidth, barHeight);
        }
    }, [post.audioWaveform]);

    useEffect(() => {
        drawWaveform(progress);
    }, [drawWaveform, progress]);

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
    };

    const handleAudioEnded = () => {
        setIsPlaying(false);
        setProgress(0);
        if(audioRef.current) audioRef.current.currentTime = 0;
    };

    const isBookmarked = useMemo(() => bookmarks?.some(b => b.postId === post.id), [bookmarks, post.id]);
    const hasLiked = useMemo(() => user && post.likes?.includes(user.uid), [post.likes, user]);

    const handleLike = async () => {
        if (!user || !firestore || !updatePost || isLiking) {
            if (!user || !firestore) {
                toast({
                    variant: "destructive",
                    title: "Authentication Error",
                    description: "You must be logged in to like a post.",
                });
            }
            return;
        }
        
        setIsLiking(true);
        const postRef = doc(firestore, 'posts', post.id);
        const originalLikes = post.likes;
        const originalLikeCount = post.likeCount;

        const newLikes = hasLiked
            ? (post.likes || []).filter((id) => id !== user.uid)
            : [...(post.likes || []), user.uid];
        
        const newLikeCount = hasLiked ? (post.likeCount ?? 1) - 1 : (post.likeCount ?? 0) + 1;
        updatePost(post.id, { likes: newLikes, likeCount: newLikeCount });

        try {
            await runTransaction(firestore, async (transaction) => {
                const postDoc = await transaction.get(postRef);
                if (!postDoc.exists()) throw "Post does not exist!";

                const freshPost = postDoc.data() as Post;
                const userHasLiked = (freshPost.likes || []).includes(user.uid);

                if (userHasLiked) {
                    transaction.update(postRef, {
                        likeCount: increment(-1),
                        likes: arrayRemove(user.uid),
                    });
                } else {
                    transaction.update(postRef, {
                        likeCount: increment(1),
                        likes: arrayUnion(user.uid),
                    });
                }
                return { didLike: !userHasLiked };
            }).then(({ didLike }) => {
                if (post.authorId !== user.uid) {
                    const notificationId = `like_${post.id}_${user.uid}`;
                    const notificationRef = doc(firestore, 'users', post.authorId, 'notifications', notificationId);

                    if (didLike) {
                        const notificationData: Omit<Notification, 'id'> = {
                            type: 'like',
                            postId: post.id,
                            fromUserId: user.uid,
                            timestamp: serverTimestamp(),
                            read: false,
                            activityContent: post.content?.substring(0, 100),
                        };
                        setDoc(notificationRef, { ...notificationData, id: notificationRef.id }).catch(serverError => {
                            console.error("Failed to create like notification:", serverError);
                        });
                    } else {
                        deleteDoc(notificationRef).catch(serverError => {
                            console.error("Failed to delete like notification:", serverError);
                        });
                    }
                }
            });
        } catch (e: any) {
            updatePost(post.id, { likes: originalLikes, likeCount: originalLikeCount });
            console.error("Like transaction failed: ", e);
            const permissionError = new FirestorePermissionError({
                path: postRef.path,
                operation: 'update',
                requestResourceData: { likeCount: 'increment/decrement', likes: 'arrayUnion/arrayRemove' },
            });
            errorEmitter.emit('permission-error', permissionError);
        } finally {
            setIsLiking(false);
        }
    };
    
    const handleBookmark = () => {
        if (!user || !firestore) {
            toast({
                variant: "destructive",
                title: "Authentication Error",
                description: "You must be logged in to bookmark a post.",
            });
            return;
        }
        const bookmarkRef = doc(firestore, 'users', user.uid, 'bookmarks', post.id);

        if (isBookmarked) {
            deleteDoc(bookmarkRef).catch(serverError => {
                const permissionError = new FirestorePermissionError({ path: bookmarkRef.path, operation: 'delete' });
                errorEmitter.emit('permission-error', permissionError);
            });
        } else {
            const bookmarkData: Omit<Bookmark, 'id'> = { postId: post.id, timestamp: serverTimestamp() };
            setDoc(bookmarkRef, bookmarkData).catch(serverError => {
                const permissionError = new FirestorePermissionError({ path: bookmarkRef.path, operation: 'create', requestResourceData: bookmarkData });
                errorEmitter.emit('permission-error', permissionError);
            });
        }
    };

    return (
        <>
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
                                <button onClick={handleLike} disabled={isLiking} className={cn("flex items-center space-x-1 p-2 -m-2", hasLiked && "text-pink-500")}>
                                    <Heart className="h-4 w-4" fill={hasLiked ? "currentColor" : "none"} />
                                    <span className="text-xs">{formatCount(post.likeCount)}</span>
                                </button>
                                <Link href={`/post/${post.id}`} className="flex items-center space-x-1 p-2 -m-2">
                                    <MessageCircle className="h-4 w-4" />
                                    <span className="text-xs">{formatCount(post.commentCount)}</span>
                                </Link>
                                <button onClick={() => setIsRepostSheetOpen(true)} className="flex items-center space-x-1 p-2 -m-2">
                                    <Repeat className="h-4 w-4" />
                                    <span className="text-xs">{formatCount(post.repostCount)}</span>
                                </button>
                                <button onClick={handleBookmark} className={cn("flex items-center space-x-1 p-2 -m-2", isBookmarked && "text-amber-500")}>
                                    <BookmarkIcon className="h-4 w-4" fill={isBookmarked ? "currentColor" : "none"} />
                                </button>
                                <button onClick={() => setIsShareSheetOpen(true)} className="flex items-center space-x-1 p-2 -m-2">
                                    <ArrowUpRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
            <RepostSheet post={post} isOpen={isRepostSheetOpen} onOpenChange={setIsRepostSheetOpen} />
            <ShareSheet post={post} isOpen={isShareSheetOpen} onOpenChange={setIsShareSheetOpen} />
        </>
    );
}

    