
"use client";

import AppLayout from "@/components/AppLayout";
import { useFirebase, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, orderBy, limit, doc, updateDoc, arrayUnion, arrayRemove, increment, deleteDoc, setDoc, serverTimestamp, getDoc, runTransaction, getDocs, where, type Timestamp } from "firebase/firestore";
import { useDoc, type WithId } from "@/firebase/firestore/use-doc";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import type { Post, Bookmark, PollOption, Notification, User, LinkMetadata, QuotedPost } from "@/lib/types";
import { Heart, MessageCircle, Repeat, ArrowUpRight, MoreHorizontal, Edit, Trash2, Bookmark as BookmarkIcon, CheckCircle2, Slash, Pin, Clock } from "lucide-react";
import { cn, formatTimestamp, getAvatar, formatCount, formatUserId, formatExpiry } from "@/lib/utils";
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
import React, { useState, useMemo, useEffect, useCallback, useRef, type TouchEvent } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { usePresence } from "@/hooks/usePresence";
import { ShareSheet } from "@/components/ShareSheet";
import { RepostSheet } from "@/components/RepostSheet";
import { QuotedPostCard } from "@/components/QuotedPostCard";
import { motion } from "framer-motion";
import { eventBus } from "@/lib/event-bus";
import { useCollection } from "@/firebase/firestore/use-collection";
import { Progress } from "@/components/ui/progress";


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

function PostExpiryInfo({ post }: { post: WithId<Post> }) {
  const [expiryText, setExpiryText] = useState(() => {
    if (!post.expiresAt) return "Expired";
    return formatExpiry(post.expiresAt.toDate());
  });

  useEffect(() => {
    if (!post.expiresAt) return;

    const timerId = setInterval(() => {
      const newExpiryText = formatExpiry(post.expiresAt.toDate());
      setExpiryText(newExpiryText);
      if (newExpiryText === "Expired") {
        clearInterval(timerId);
      }
    }, 30000); // update every 30 seconds

    return () => clearInterval(timerId);
  }, [post.expiresAt]);

  if (!post.expiresAt || expiryText === "Expired") {
    return null;
  }

  return (
    <div className="w-full bg-amber-500/10 rounded-t-[25px] px-3 py-1">
        <div className="flex justify-center items-center gap-1.5 text-xs text-amber-700 font-medium">
            <Clock className="h-3 w-3" />
            <span>Expires in {expiryText}</span>
        </div>
    </div>
  );
}

export function PollComponent({ post, user, onVote }: { post: WithId<Post>, user: any, onVote?: (updatedPost: Partial<Post>) => void }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    
    const userVoteIndex = post.voters && user ? post.voters[user.uid] : undefined;
    const hasVoted = userVoteIndex !== undefined;

    const totalVotes = useMemo(() => {
        return post.pollOptions?.reduce((acc, option) => acc + option.votes, 0) || 0;
    }, [post.pollOptions]);

    const pollColors = useMemo(() => [
        { light: 'bg-gray-500/20', dark: 'border-gray-500', text: 'text-gray-500' },
        { light: 'bg-emerald-500/20', dark: 'border-emerald-600', text: 'text-emerald-600' },
        { light: 'bg-amber-500/20', dark: 'border-amber-600', text: 'text-amber-600' },
        { light: 'bg-fuchsia-500/20', dark: 'border-fuchsia-600', text: 'text-fuchsia-600' }
    ], []);


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
                const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
                
                if (hasVoted) {
                     const isUserChoice = userVoteIndex === index;
                     const colorSet = pollColors[index % pollColors.length];
                     
                     const bgClass = isUserChoice ? colorSet.light : 'bg-secondary';
                     const borderClass = isUserChoice ? colorSet.dark : 'border-border';
                     const fontWeight = isUserChoice ? 'font-bold' : 'font-medium';
                     const textColorClass = isUserChoice ? colorSet.text : 'text-primary';


                     return (
                        <div key={index} className={cn("relative w-full h-10 overflow-hidden rounded-full border", borderClass)}>
                            <motion.div
                                className={cn("absolute inset-y-0 left-0 h-full", bgClass)}
                                initial={{ width: '0%' }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
                            />
                            <motion.div
                                className="absolute inset-0 flex items-center justify-between px-4"
                                initial={{ justifyContent: 'center' }}
                                animate={{ justifyContent: 'space-between' }}
                                transition={{ duration: 0.5, ease: 'easeOut' }}
                            >
                                <motion.div
                                    className="flex items-center gap-2 overflow-hidden"
                                    initial={{ x: '50%', transform: 'translateX(-50%)' }}
                                    animate={{ x: 0, transform: 'translateX(0%)' }}
                                    transition={{ duration: 0.5, ease: 'easeOut' }}
                                >
                                     <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.3 }}
                                        className="flex items-center gap-2"
                                    >
                                        {isUserChoice && <CheckCircle2 className={cn("h-4 w-4 shrink-0", textColorClass)} />}
                                        <span className={cn(
                                            "truncate text-sm", 
                                            textColorClass,
                                            fontWeight
                                        )}>
                                            {option.option}
                                        </span>
                                    </motion.div>
                                </motion.div>
                                <motion.span 
                                    className={cn(
                                        "text-sm", 
                                        textColorClass,
                                        fontWeight
                                    )}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                >
                                    {percentage.toFixed(0)}%
                                </motion.span>
                            </motion.div>
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

            <div className="-mx-4 mt-2 px-4 py-3">
                <div className="flex items-center justify-around">
                    <button onClick={handleLike} disabled={isLiking} className={cn("flex items-center space-x-1", hasLiked && "text-pink-500")}>
                        <Heart className="h-4 w-4" fill={hasLiked ? 'currentColor' : 'none'} />
                        <span className="text-xs">{formatCount(post.likeCount)}</span>
                    </button>
                    <CommentButtonWrapper
                        href={`/post/${post.id}`}
                        className={cn(
                            "flex items-center space-x-1",
                            repliesAllowed ? "hover:text-primary" : "opacity-50 pointer-events-none"
                        )}
                    >
                        <div className="relative">
                        <MessageCircle className="h-4 w-4" />
                        {!repliesAllowed && <Slash className="absolute top-0 left-0 h-4 w-4 stroke-[2.5px]" />}
                        </div>
                        <span className="text-xs">{formatCount(post.commentCount)}</span>
                    </CommentButtonWrapper>
                    <button onClick={handleRepost} className="flex items-center space-x-1 hover:text-green-500">
                        <Repeat className={cn("h-4 w-4", post.repostCount > 0 && "text-green-500")} />
                        <span className="text-xs">{formatCount(post.repostCount)}</span>
                    </button>
                     <button onClick={handleBookmark} className={cn("flex items-center space-x-1 hover:text-amber-500", isBookmarked && "text-amber-500")}>
                        <BookmarkIcon className="h-4 w-4" fill={isBookmarked ? "currentColor" : "none"} />
                    </button>
                     <button onClick={() => setIsShareSheetOpen(true)} className="flex items-center space-x-1 hover:text-primary">
                        <ArrowUpRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
            
            {post.expiresAt && post.timestamp && <PostExpiryInfo post={post} />}
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
            <Card className="w-full shadow-none border-x-0 border-t-0 rounded-none">
                <CardContent className="px-4 pt-4 pb-0">
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
        <Card className="w-full shadow-none border-x-0 border-t-0 rounded-none">
            <CardContent className="px-4 pt-4 pb-0">
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
  const { toast } = useToast();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [posts, setPosts] = useState<WithId<Post>[] | null>(null);
  const [postsLoading, setPostsLoading] = useState(true);
  
  const postsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'posts'), orderBy("timestamp", "desc"), limit(50));
  }, [firestore]);

  const fetchPosts = useCallback(async () => {
    if (!postsQuery) return;
    try {
        const postsSnapshot = await getDocs(postsQuery);
        const newPosts = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WithId<Post>));
        setPosts(newPosts);
    } catch (error) {
        console.error("Failed to fetch posts:", error);
        toast({
            variant: "destructive",
            title: "Load Failed",
            description: "Could not fetch posts.",
        });
    }
  }, [postsQuery, toast]);

  useEffect(() => {
    setPostsLoading(true);
    fetchPosts().finally(() => setPostsLoading(false));
  }, [fetchPosts]);
  
  const updatePost = useCallback((postId: string, updatedData: Partial<Post>) => {
    setPosts(currentPosts => {
        if (!currentPosts) return null;
        return currentPosts.map(p =>
            p.id === postId ? { ...p, ...updatedData } : p
        );
    });
  }, []);

  const bookmarksQuery = useMemoFirebase(() => {
    if (!user) return null;
    return collection(firestore, 'users', user.uid, 'bookmarks');
  }, [firestore, user]);

  const { data: bookmarks, isLoading: bookmarksLoading } = useCollection<Bookmark>(bookmarksQuery);
  
  const handleRefresh = useCallback(async () => {
    if (!postsQuery) return;

    eventBus.emit('refresh-start');
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

    try {
        const postsSnapshot = await getDocs(postsQuery);
        const newPosts = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WithId<Post>));
        
        const minDelay = new Promise(resolve => setTimeout(resolve, 750));
        await minDelay;

        if (posts && posts.length > 0 && newPosts.length > 0 && posts[0].id === newPosts[0].id) {
            // No new posts, shuffle existing ones
            setPosts(currentPosts => {
                if (!currentPosts) return [];
                const shuffled = [...currentPosts];
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                return shuffled;
            });
        } else {
            // New posts available, update the list
            setPosts(newPosts);
        }

    } catch (error) {
        console.error("Failed to refresh posts:", error);
        toast({
            variant: "destructive",
            title: "Refresh Failed",
            description: "Could not fetch the latest posts.",
        });
    } finally {
        eventBus.emit('refresh-end');
    }
  }, [postsQuery, posts, toast]);


  // Subscribe to the refresh event
  useEffect(() => {
    const refreshHandler = () => handleRefresh();
    eventBus.on('refresh-home', refreshHandler);

    return () => {
        eventBus.off('refresh-home', refreshHandler);
    };
  }, [handleRefresh]);


  const isLoading = postsLoading || bookmarksLoading;

  const filteredPosts = useMemo(() => {
    if (!posts || !user) return [];
    const mutedUsers = userProfile?.mutedUsers || [];
    const now = new Date();
    return posts.filter(post => 
      !mutedUsers.includes(post.authorId) && 
      post.authorId !== user.uid &&
      (!post.expiresAt || post.expiresAt.toDate() > now)
    );
  }, [posts, userProfile, user]);

  const handleDeletePostOptimistic = (postId: string) => {
    setPosts(currentPosts => currentPosts?.filter(p => p.id !== postId) ?? []);
  }

  return (
    <AppLayout>
      <motion.div
        className="h-full relative"
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div
            className="relative h-full overflow-y-auto"
            ref={scrollContainerRef}
        >
          <div className="divide-y border-b">
            {isLoading && (
              <>
                <PostSkeleton />
                <PostSkeleton />
                <PostSkeleton />
                <PostSkeleton />
                <PostSkeleton />
              </>
            )}

            {!isLoading && posts && filteredPosts.length === 0 && (
              <div className="text-center py-10 h-screen">
                <h2 className="text-2xl font-headline text-primary">No posts yet!</h2>
                <p className="text-muted-foreground mt-2">Start following people to see their posts here.</p>
              </div>
            )}
            
            {filteredPosts.map((post) => (
                <PostItem key={post.id} post={post} bookmarks={bookmarks} updatePost={updatePost} onDelete={handleDeletePostOptimistic} />
              ))
            }
          </div>
        </div>
      </motion.div>
    </AppLayout>
  );
}

    