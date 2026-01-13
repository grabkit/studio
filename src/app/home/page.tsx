
"use client";

import AppLayout from "@/components/AppLayout";
import { useFirebase, useMemoFirebase, useUser, useDoc } from "@/firebase";
import { collection, query, orderBy, limit, doc, updateDoc, arrayUnion, arrayRemove, increment, deleteDoc, setDoc, serverTimestamp, getDoc, runTransaction, getDocs, where } from "firebase/firestore";
import { useCollection, type WithId } from "@/firebase/firestore/use-collection";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import type { Post, Bookmark, PollOption, Notification, User, LinkMetadata, QuotedPost } from "@/lib/types";
import { Heart, MessageCircle, Repeat, ArrowUpRight, MoreHorizontal, Edit, Trash2, Bookmark as BookmarkIcon, CheckCircle2, Slash, Pin, Loader2 } from "lucide-react";
import { cn, formatTimestamp, getAvatar, formatCount, formatUserId } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";
import Link from "next/link";
import Image from "next/image";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
  SheetTrigger,
} from "@/components/ui/sheet";
import React, { useState, useMemo, useRef, TouchEvent, useEffect, useCallback } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { usePresence } from "@/hooks/usePresence";
import { ShareSheet } from "@/components/ShareSheet";
import { RepostSheet } from "@/components/RepostSheet";
import { QuotedPostCard } from "@/components/QuotedPostCard";
import { AnimatedCount } from "@/components/AnimatedCount";
import { motion } from "framer-motion";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";


function LinkPreview({ metadata }: { metadata: LinkMetadata }) {
    const getDomainName = (url: string) => {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch (e) {
            return '';
        }
    };

    return (
        <a href={metadata.url} target="_blank" rel="noopener noreferrer" className="block mt-3 border rounded-lg overflow-hidden hover:bg-secondary/50 transition-colors">
            {metadata.imageUrl && (
                <div className="relative aspect-video">
                    <Image
                        src={metadata.imageUrl}
                        alt={metadata.title || 'Link preview'}
                        fill
                        className="object-cover"
                    />
                </div>
            )}
            <div className="p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{getDomainName(metadata.url)}</p>
                <p className="font-semibold text-sm truncate mt-0.5">{metadata.title || metadata.url}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{metadata.description}</p>
            </div>
        </a>
    )
}

export function PollComponent({ post, user, onVote }: { post: WithId<Post>, user: any, onVote?: (updatedPost: Partial<Post>) => void }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    const [animatedPercentages, setAnimatedPercentages] = useState<number[] | null>(null);

    const userVoteIndex = post.voters && user ? post.voters[user.uid] : undefined;
    const hasVoted = userVoteIndex !== undefined;

    const totalVotes = useMemo(() => {
        return post.pollOptions?.reduce((acc, option) => acc + option.votes, 0) || 0;
    }, [post.pollOptions]);

    useEffect(() => {
        if (hasVoted) {
            const percentages = post.pollOptions?.map(option =>
                totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0
            ) || [];
            
            // Set to 0 initially for the animation
            setAnimatedPercentages(Array(percentages.length).fill(0));

            // After a short delay, update to the actual percentages to trigger the transition
            const timer = setTimeout(() => {
                setAnimatedPercentages(percentages);
            }, 10); // A small delay is enough

            return () => clearTimeout(timer);
        }
    }, [hasVoted, post.pollOptions, totalVotes]);


    const handleVote = async (optionIndex: number) => {
        if (!user || !firestore) {
            toast({ variant: "destructive", title: "You must be logged in to vote." });
            return;
        }
        if (hasVoted || isProcessing) return;

        setIsProcessing(true);

        const postRef = doc(firestore, 'posts', post.id);

        // Optimistic UI Update
        const optimisticPollOptions = post.pollOptions ? post.pollOptions.map((opt, i) => {
            if (i === optionIndex) {
                return { ...opt, votes: opt.votes + 1 };
            }
            return opt;
        }) : [];

        const optimisticVoters = { ...(post.voters || {}), [user.uid]: optionIndex };
        const optimisticPost = { ...post, pollOptions: optimisticPollOptions, voters: optimisticVoters };

        if (onVote) {
            onVote(optimisticPost);
        }

        // Firestore Transaction
        try {
            await runTransaction(firestore, async (transaction) => {
                const postDoc = await transaction.get(postRef);
                if (!postDoc.exists()) {
                    throw "Post does not exist!";
                }

                const currentPost = postDoc.data() as Post;

                if (currentPost.voters && currentPost.voters[user.uid] !== undefined) {
                    // Another client might have already processed a vote.
                    // The optimistic update is fine, but we don't need to toast.
                    return;
                }
                
                const newPollOptions = currentPost.pollOptions ? [...currentPost.pollOptions] : [];
                if (newPollOptions.length > optionIndex) {
                    newPollOptions[optionIndex].votes += 1;
                }

                const newVoters = { ...(currentPost.voters || {}), [user.uid]: optionIndex };
                
                transaction.update(postRef, {
                    pollOptions: newPollOptions,
                    voters: newVoters,
                });
            });

        } catch (e: any) {
            console.error(e);
            // Revert optimistic update on failure
            if (onVote) {
                onVote(post);
            }
            const permissionError = new FirestorePermissionError({
                path: postRef.path,
                operation: 'update',
                requestResourceData: { vote: `Transaction on pollOptions and voters` },
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({
                variant: 'destructive',
                title: 'Vote Failed',
                description: 'Could not process your vote due to a permissions issue.'
            })
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="mt-4 space-y-2.5">
            {post.pollOptions?.map((option, index) => {
                const originalPercentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
                const displayPercentage = animatedPercentages ? animatedPercentages[index] : originalPercentage;
                const isUserChoice = userVoteIndex === index;

                if (hasVoted) {
                     return (
                        <div key={index} className="relative w-full h-10 overflow-hidden bg-secondary rounded-full">
                             <div
                                className={cn(
                                    "absolute left-0 top-0 h-full transition-all duration-500 ease-out",
                                    isUserChoice ? "bg-primary" : "bg-primary/20"
                                )}
                                style={{ width: `${displayPercentage}%` }}
                            />
                            {/* Unfilled Text */}
                            <div className="absolute inset-0 flex items-center justify-between px-4">
                                 <div className="flex items-center gap-2">
                                     {isUserChoice && <CheckCircle2 className="h-4 w-4 text-primary" />}
                                    <span className="truncate text-primary">{option.option}</span>
                                </div>
                                <span className="text-primary">{originalPercentage.toFixed(0)}%</span>
                            </div>
                            {/* Filled Text - clipped */}
                            <div
                                className="absolute inset-0 flex items-center justify-between px-4"
                                style={{ clipPath: `inset(0 ${100 - displayPercentage}% 0 0)` }}
                            >
                               <div className="flex items-center gap-2">
                                     {isUserChoice && <CheckCircle2 className="h-4 w-4 text-primary-foreground" />}
                                    <span className="truncate text-primary-foreground">{option.option}</span>
                                </div>
                                <span className="text-primary-foreground">{originalPercentage.toFixed(0)}%</span>
                            </div>
                        </div>
                    );
                } else {
                    return (
                        <Button
                            key={index}
                            variant="outline"
                            className="w-full justify-center h-10 text-base rounded-full"
                            onClick={() => handleVote(index)}
                            disabled={isProcessing}
                        >
                            {option.option}
                        </Button>
                    );
                }
            })}
             {hasVoted && (
                <p className="text-xs text-muted-foreground pt-2 text-right">
                    {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
                </p>
            )}
        </div>
    );
}

function InnerPostItem({ post, bookmarks, updatePost, onDelete, onPin, showPinStatus = false, authorProfile: initialAuthorProfile, isRepost = false }: { post: WithId<Post>, bookmarks: WithId<Bookmark>[] | null, updatePost?: (id: string, data: Partial<Post>) => void, onDelete?: (id: string) => void, onPin?: (id: string, currentStatus: boolean) => void, showPinStatus?: boolean, authorProfile?: WithId<User> | null, isRepost?: boolean }) {
  const { user, firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const [isShareSheetOpen, setIsShareSheetOpen] = useState(false);
  const [isMoreOptionsSheetOpen, setIsMoreOptionsSheetOpen] = useState(false);
  const [isRepostSheetOpen, setIsRepostSheetOpen] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [likeDirection, setLikeDirection] = useState<'up' | 'down'>('up');
  
  const isOwner = user?.uid === post.authorId;
  const isBookmarked = useMemo(() => bookmarks?.some(b => b.postId === post.id), [bookmarks, post.id]);
  const repliesAllowed = post.commentsAllowed !== false;

    const { data: authorProfile, isLoading: isAuthorLoading } = useDoc<User>(
        useMemoFirebase(() => {
            if (initialAuthorProfile || !firestore) return null;
            return doc(firestore, 'users', post.authorId);
        }, [firestore, post.authorId, initialAuthorProfile])
    );

    const finalAuthorProfile = initialAuthorProfile || authorProfile;
    const avatar = getAvatar(finalAuthorProfile);
    const isAvatarUrl = avatar.startsWith('http');

  const hasLiked = useMemo(() => {
    if (!user) return false;
    return post.likes?.includes(user.uid);
  }, [post.likes, user]);


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
    setLikeDirection(hasLiked ? 'down' : 'up');

    // Optimistic UI update
    const newLikes = hasLiked
        ? (post.likes || []).filter((id) => id !== user.uid)
        : [...(post.likes || []), user.uid];
    
    const newLikeCount = hasLiked ? (post.likeCount ?? 1) - 1 : (post.likeCount ?? 0) + 1;
    updatePost(post.id, { likes: newLikes, likeCount: newLikeCount });

    try {
        await runTransaction(firestore, async (transaction) => {
            const postDoc = await transaction.get(postRef);
            if (!postDoc.exists()) {
                throw "Post does not exist!";
            }

            const freshPost = postDoc.data() as Post;
            const userHasLiked = (freshPost.likes || []).includes(user.uid);

            if (userHasLiked) {
                // Unlike
                transaction.update(postRef, {
                    likeCount: increment(-1),
                    likes: arrayRemove(user.uid),
                });
            } else {
                // Like
                transaction.update(postRef, {
                    likeCount: increment(1),
                    likes: arrayUnion(user.uid),
                });
            }
            return { didLike: !userHasLiked };
        }).then(({ didLike }) => {
            // Only create/delete notification if it's not the user's own post
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
                        activityContent: post.content.substring(0, 100),
                    };
                    setDoc(notificationRef, { ...notificationData, id: notificationRef.id }).catch(serverError => {
                        console.error("Failed to create like notification:", serverError);
                    });
                } else {
                    // It was an unlike action, so delete the notification
                    deleteDoc(notificationRef).catch(serverError => {
                        console.error("Failed to delete like notification:", serverError);
                    });
                }
            }
        });

    } catch (e: any) {
        // Revert optimistic update on error
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

  const handleDeletePost = async () => {
    if (!firestore || !isOwner) return;
    setIsMoreOptionsSheetOpen(false); // Close sheet immediately
    
    const postRef = doc(firestore, 'posts', post.id);
    deleteDoc(postRef)
      .then(() => {
        toast({
          title: "Post Deleted",
          description: "Your post has been successfully deleted.",
        });
        if (onDelete) {
          onDelete(post.id);
        }
      })
      .catch((serverError) => {
        const permissionError = new FirestorePermissionError({
          path: postRef.path,
          operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const handleEditPost = () => {
    setIsMoreOptionsSheetOpen(false);
    router.push(`/post?postId=${post.id}`);
  };

  const handlePinPost = () => {
    if (!isOwner || !onPin) return;
    setIsMoreOptionsSheetOpen(false);
    onPin(post.id, post.isPinned || false);
  };


  const handleRepost = () => {
    setIsRepostSheetOpen(true);
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
            const permissionError = new FirestorePermissionError({
                path: bookmarkRef.path,
                operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
        });
    } else {
        const bookmarkData: Omit<Bookmark, 'id'> = {
            postId: post.id,
            timestamp: serverTimestamp()
        };
        setDoc(bookmarkRef, bookmarkData).catch(serverError => {
            const permissionError = new FirestorePermissionError({
                path: bookmarkRef.path,
                operation: 'create',
                requestResourceData: bookmarkData,
            });
            errorEmitter.emit('permission-error', permissionError);
        });
    }
  };
  
  const CommentButtonWrapper = repliesAllowed ? Link : 'div';


  return (
    <>
    <div className="flex space-x-3">
        <div>
             <Link href={`/profile/${post.authorId}`} className="flex-shrink-0">
                <Avatar className="h-10 w-10">
                    <AvatarImage src={isAvatarUrl ? avatar : undefined} alt={formatUserId(post.authorId)} />
                    <AvatarFallback>{!isAvatarUrl ? avatar : ''}</AvatarFallback>
                </Avatar>
            </Link>
        </div>
        <div className="flex-1">
            <div className="flex justify-between items-start">
                <div className="flex items-center space-x-1.5 -mb-1">
                    <Link href={`/profile/${post.authorId}`} className="text-sm font-semibold hover:underline">
                        {formatUserId(post.authorId)}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                        {post.timestamp ? `· ${formatTimestamp(post.timestamp.toDate())}` : ''}
                    </div>
                </div>
               <div className="flex items-center">
                 {!isRepost && isOwner && (
                     <Sheet open={isMoreOptionsSheetOpen} onOpenChange={setIsMoreOptionsSheetOpen}>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="rounded-t-2xl">
                            <SheetHeader className="sr-only">
                                <SheetTitle>Options for post</SheetTitle>
                                <SheetDescription>Manage your post.</SheetDescription>
                            </SheetHeader>
                            <div className="grid gap-2 py-4">
                                 <div className="border rounded-2xl">
                                    <Button variant="ghost" className="justify-between text-base py-6 rounded-2xl w-full" onClick={handleEditPost}>
                                        <span className="font-semibold">Edit</span>
                                        <Edit className="h-5 w-5" />
                                    </Button>
                                    <div className="border-t"></div>
                                     <Button variant="ghost" className="justify-between text-base py-6 rounded-2xl w-full" onClick={handlePinPost}>
                                        <span className="font-semibold">{post.isPinned ? "Unpin Post" : "Pin Post"}</span>
                                        <Pin className="h-5 w-5" />
                                    </Button>
                                 </div>
                                <div className="border rounded-2xl">
                                    <Button variant="ghost" className="justify-between text-base py-6 rounded-2xl w-full text-destructive hover:text-destructive" onClick={handleDeletePost}>
                                        <span className="font-semibold">Delete</span>
                                        <Trash2 className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                 )}
               </div>
            </div>

            <Link href={`/post/${post.id}`} className="block">
                <p className="text-foreground text-sm whitespace-pre-wrap">{post.content}</p>
            </Link>

            {post.type === 'quote' && post.quotedPost && (
                <div className="mt-2">
                    <QuotedPostCard post={post.quotedPost} />
                </div>
            )}
            
            {post.linkMetadata && <LinkPreview metadata={post.linkMetadata} />}

            {post.type === 'poll' && post.pollOptions && (
                <PollComponent post={post} user={user} onVote={(updatedData) => updatePost?.(post.id, updatedData)} />
            )}

            <div className="flex items-center justify-between pt-2 text-muted-foreground">
                <div className="flex items-center space-x-6">
                  <button onClick={handleLike} disabled={isLiking} className={cn("flex items-center space-x-1 w-8", hasLiked && "text-pink-500")}>
                    <Heart className="h-4 w-4 shrink-0" fill={hasLiked ? 'currentColor' : 'none'} />
                    <AnimatedCount count={post.likeCount} direction={likeDirection} />
                  </button>
                  <CommentButtonWrapper
                    href={`/post/${post.id}`}
                    className={cn(
                        "flex items-center space-x-1 w-8",
                        repliesAllowed ? "hover:text-primary" : "opacity-50 pointer-events-none"
                    )}
                  >
                    <div className="relative">
                      <MessageCircle className="h-4 w-4 shrink-0" />
                      {!repliesAllowed && <Slash className="absolute top-0 left-0 h-4 w-4 stroke-[2.5px]" />}
                    </div>
                    <AnimatedCount count={post.commentCount} direction="up" />
                  </CommentButtonWrapper>
                  <button onClick={handleRepost} className="flex items-center space-x-1 w-8 hover:text-green-500">
                    <Repeat className={cn("h-4 w-4 shrink-0")} />
                    <AnimatedCount count={post.repostCount} direction="up" />
                  </button>
                  <button onClick={() => setIsShareSheetOpen(true)} className="flex items-center space-x-1 hover:text-primary">
                    <ArrowUpRight className="h-4 w-4 shrink-0" />
                  </button>
                   <button onClick={handleBookmark} className="flex items-center space-x-1 hover:text-foreground">
                    <BookmarkIcon className={cn("h-4 w-4 shrink-0", isBookmarked && "text-foreground fill-foreground")} />
                  </button>
                </div>
            </div>
      </div>
    </div>
    <ShareSheet post={post} isOpen={isShareSheetOpen} onOpenChange={setIsShareSheetOpen} />
    <RepostSheet post={post} isOpen={isRepostSheetOpen} onOpenChange={setIsRepostSheetOpen} />
    </>
  );
}

export function PostItem({ post, ...props }: { post: WithId<Post>, bookmarks: WithId<Bookmark>[] | null, updatePost?: (id: string, data: Partial<Post>) => void, onDelete?: (id: string) => void, onPin?: (id: string, currentStatus: boolean) => void, showPinStatus?: boolean, authorProfile?: WithId<User> | null }) {
    const { firestore } = useFirebase();

    const originalPostRef = useMemoFirebase(() => {
        if (!firestore || post.type !== 'repost' || !post.repostOf) return null;
        return doc(firestore, 'posts', post.repostOf);
    }, [firestore, post.type, post.repostOf]);

    const { data: originalPost, isLoading: isOriginalPostLoading } = useDoc<Post>(originalPostRef);

    if (post.type === 'repost') {
        if (isOriginalPostLoading) {
            return <PostSkeleton />;
        }
        if (!originalPost) {
            // Original post might be deleted, so don't render anything
            return null;
        }
        return (
            <Card className="w-full shadow-none border-x-0 border-t-0 rounded-xl">
                <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 pl-12">
                        <Repeat className="h-3 w-3" />
                        <span>Reposted by {formatUserId(post.authorId)}</span>
                    </div>
                    <InnerPostItem post={originalPost} {...props} isRepost={true} />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full shadow-none border-x-0 border-t-0 rounded-xl">
            <CardContent className="p-4">
                {props.showPinStatus && post.isPinned && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 pl-12">
                        <Pin className="h-3 w-3" />
                        <span>Pinned</span>
                    </div>
                )}
                <InnerPostItem post={post} {...props} />
            </CardContent>
        </Card>
    );
}

export function PostSkeleton() {
  return (
    <Card className="w-full shadow-none border-x-0 border-t-0 rounded-none">
      <CardContent className="p-4">
        <div className="flex space-x-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="flex justify-between items-start">
                <Skeleton className="h-4 w-[150px]" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="flex items-center justify-between pt-2">
                <div className="flex items-center space-x-6">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-4" />
                </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


export default function HomePage() {
  const { firestore, userProfile } = useFirebase();
  const { user } = useUser();
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullPosition, setPullPosition] = useState(0);
  const touchStartRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPulling = useRef(false);
  const pullTimeout = useRef<NodeJS.Timeout | null>(null);


  const postsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'posts'), orderBy("timestamp", "desc"), limit(50));
  }, [firestore]);

  const { data: initialPosts, isLoading: postsLoading, setData } = useCollection<Post>(postsQuery);
  
  const updatePost = useCallback((postId: string, updatedData: Partial<Post>) => {
    setData(currentPosts => {
        if (!currentPosts) return null;
        return currentPosts.map(p =>
            p.id === postId ? { ...p, ...updatedData } : p
        );
    });
  }, [setData]);


  const bookmarksQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'users', user.uid, 'bookmarks');
  }, [firestore, user]);

  const { data: bookmarks, isLoading: bookmarksLoading } = useCollection<Bookmark>(bookmarksQuery);

  const fetchPostsAndShuffle = async () => {
    if (!firestore) return;
    try {
        const postsCollectionQuery = query(collection(firestore, 'posts'), orderBy("timestamp", "desc"), limit(50));
        const querySnapshot = await getDocs(postsCollectionQuery);
        let fetchedPosts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WithId<Post>));
        
        fetchedPosts.sort(() => Math.random() - 0.5);
        setData(fetchedPosts);

    } catch (error) {
        console.error("Error fetching posts:", error);
    }
  };

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    window.navigator.vibrate?.(50);
    await fetchPostsAndShuffle();
    setTimeout(() => {
      setIsRefreshing(false);
      setPullPosition(0);
      window.navigator.vibrate?.(50);
    }, 500); 
  };

  const handleTouchStart = (e: TouchEvent) => {
      touchStartRef.current = e.targetTouches[0].clientY;
      if (pullTimeout.current) clearTimeout(pullTimeout.current);
      
      pullTimeout.current = setTimeout(() => {
        isPulling.current = true;
      }, 100);
  };

  const handleTouchMove = (e: TouchEvent) => {
    const touchY = e.targetTouches[0].clientY;
    const pullDistance = touchY - touchStartRef.current;
    
    if (containerRef.current && containerRef.current.scrollTop === 0 && pullDistance > 0 && isPulling.current && !isRefreshing) {
      e.preventDefault();
      const newPullPosition = Math.min(pullDistance, 120);
      
      if (pullPosition <= 70 && newPullPosition > 70) {
        window.navigator.vibrate?.(50);
      }

      setPullPosition(newPullPosition);
    }
  };

  const handleTouchEnd = () => {
    if (pullTimeout.current) {
        clearTimeout(pullTimeout.current);
        pullTimeout.current = null;
    }
    isPulling.current = false;

    if (pullPosition > 70) {
      handleRefresh();
    } else {
      setPullPosition(0);
    }
  };


  const isLoading = postsLoading || bookmarksLoading;

  const filteredPosts = useMemo(() => {
    if (!initialPosts || !user) return initialPosts || [];
    const mutedUsers = userProfile?.mutedUsers || [];
    return initialPosts.filter(post => !mutedUsers.includes(post.authorId));
  }, [initialPosts, userProfile, user]);

  const handleDeletePostOptimistic = (postId: string) => {
    setData(currentPosts => currentPosts?.filter(p => p.id !== postId) ?? []);
  }

  return (
    <AppLayout>
      <motion.div
        className="h-full"
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div
          ref={containerRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="relative h-full overflow-y-auto"
        >
          <PullToRefreshIndicator pullPosition={pullPosition} isRefreshing={isRefreshing} />
          <div className="divide-y border-b" style={{ transform: `translateY(${pullPosition}px)` }}>
            {(isLoading || !initialPosts) && (
              <>
                <PostSkeleton />
                <PostSkeleton />
                <PostSkeleton />
                <PostSkeleton />
                <PostSkeleton />
              </>
            )}

            {!isLoading && initialPosts && filteredPosts.length === 0 && (
              <div className="text-center py-10 h-screen">
                <h2 className="text-2xl font-headline text-primary">No posts yet!</h2>
                <p className="text-muted-foreground mt-2">Start following people to see their posts here.</p>
              </div>
            )}
            
            {!isLoading && initialPosts && filteredPosts.map((post) => (
                <PostItem key={post.id} post={post} bookmarks={bookmarks} updatePost={updatePost} onDelete={handleDeletePostOptimistic} />
              ))
            }
          </div>
        </div>
      </motion.div>
    </AppLayout>
  );
}
