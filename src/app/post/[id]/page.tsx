

"use client";

import { useFirebase, useMemoFirebase, useUser } from "@/firebase";
import {
  collection,
  query,
  orderBy,
  doc,
  serverTimestamp,
  writeBatch,
  increment,
  arrayRemove,
  arrayUnion,
  deleteDoc,
  setDoc,
  updateDoc,
  getDoc,
  runTransaction,
  getDocs,
  where,
} from "firebase/firestore";
import { useCollection, type WithId } from "@/firebase/firestore/use-collection";
import { useDoc } from "@/firebase/firestore/use-doc";
import type { Post, Comment, Notification, User as UserProfile, LinkMetadata, PollOption } from "@/lib/types";
import { useParams, useRouter } from "next/navigation";
import React, { useState, useMemo } from "react";
import Link from 'next/link';
import Image from "next/image";
import { motion } from "framer-motion";

import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Heart, MessageCircle, ArrowUpRight, Trash2, MoreHorizontal, Edit, ArrowLeft, Repeat, Check, AlertTriangle, Slash, Loader2, Send, CheckCircle2 } from "lucide-react";
import { cn, formatTimestamp, getAvatar, formatCount, formatUserId } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { QuotedPostCard } from "@/components/QuotedPostCard";
import { AnimatedCount } from "@/components/AnimatedCount";

function PollComponent({ post, user, onVote }: { post: WithId<Post>, user: any, onVote?: (updatedPost: Partial<Post>) => void }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    
    const userVoteIndex = post.voters && user ? post.voters[user.uid] : undefined;
    const hasVoted = userVoteIndex !== undefined;

    const totalVotes = useMemo(() => {
        return post.pollOptions?.reduce((acc, option) => acc + option.votes, 0) || 0;
    }, [post.pollOptions]);

     const pollColors = useMemo(() => [
        { light: 'bg-sky-500/20 border-sky-500 text-sky-700', dark: 'bg-sky-500 border-sky-500 text-white' },
        { light: 'bg-emerald-500/20 border-emerald-500 text-emerald-700', dark: 'bg-emerald-500 border-emerald-500 text-white' },
        { light: 'bg-amber-500/20 border-amber-500 text-amber-700', dark: 'bg-amber-500 border-amber-500 text-white' },
        { light: 'bg-fuchsia-500/20 border-fuchsia-500 text-fuchsia-700', dark: 'bg-fuchsia-500 border-fuchsia-500 text-white' }
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
                     const textClass = isUserChoice ? 'text-primary' : 'text-muted-foreground';
                     const fontWeight = isUserChoice ? 'font-bold' : 'font-medium';

                     return (
                        <div key={index} className={cn("relative w-full h-10 overflow-hidden rounded-full border", isUserChoice ? colorSet.light.split(' ')[1] : 'border-border')}>
                            <motion.div
                                className={cn("absolute inset-y-0 left-0 h-full", bgClass)}
                                initial={{ width: '0%' }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1] }}
                            />
                            <div className="absolute inset-0 flex items-center justify-between px-4">
                                <motion.div 
                                    className="flex items-center gap-2 overflow-hidden"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                >
                                    {isUserChoice && <CheckCircle2 className={cn("h-4 w-4 shrink-0", textClass)} />}
                                    <span className={cn(
                                        "truncate text-sm", 
                                        textClass,
                                        fontWeight
                                    )}>
                                        {option.option}
                                    </span>
                                </motion.div>
                                <motion.span 
                                    className={cn(
                                        "text-sm", 
                                        textClass,
                                        fontWeight
                                    )}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                >
                                    {percentage.toFixed(0)}%
                                </motion.span>
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

function LinkPreview({ metadata }: { metadata: LinkMetadata }) {
    const getDomainName = (url: string) => {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch (e) {
            return '';
        }
    };

    return (
        <a href={metadata.url} target="_blank" rel="noopener noreferrer" className="block mt-4 border rounded-lg overflow-hidden hover:bg-secondary/50 transition-colors">
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

function PostDetailItem({ post, updatePost }: { post: WithId<Post>, updatePost: (data: Partial<Post>) => void }) {
  const { user, firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const [isMoreOptionsSheetOpen, setIsMoreOptionsSheetOpen] = useState(false);
  const [isDeleteSheetOpen, setIsDeleteSheetOpen] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [likeDirection, setLikeDirection] = useState<'up' | 'down'>('up');

  const isOwner = user?.uid === post.authorId;
  const repliesAllowed = post.commentsAllowed !== false;

  const hasLiked = post.likes?.includes(user?.uid || '');

  const avatar = getAvatar({id: post.authorId});
  const isAvatarUrl = avatar.startsWith('http');

  const handleLike = async () => {
    if (!user || !firestore || isLiking) {
      if (!user || !firestore) {
        toast({ variant: "destructive", title: "You must be logged in to like a post." });
      }
      return;
    }

    setIsLiking(true);
    setLikeDirection(hasLiked ? 'down' : 'up');
    const postRef = doc(firestore, 'posts', post.id);
    const originalLikes = post.likes;
    const originalLikeCount = post.likeCount;

    // Optimistic UI update
    const newLikes = hasLiked
        ? (post.likes || []).filter((id) => id !== user.uid)
        : [...(post.likes || []), user.uid];
    
    const newLikeCount = hasLiked ? (post.likeCount ?? 1) - 1 : (post.likeCount ?? 0) + 1;
    updatePost({ likes: newLikes, likeCount: newLikeCount });
    
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
                    deleteDoc(notificationRef).catch(serverError => {
                        console.error("Failed to delete like notification:", serverError);
                    });
                }
            }
        });
    } catch (e: any) {
        // Revert optimistic update on error
        updatePost({ likes: originalLikes, likeCount: originalLikeCount });
        
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
    const postRef = doc(firestore, 'posts', post.id);
    deleteDoc(postRef)
      .then(() => {
        toast({
          title: "Post Deleted",
          description: "Your post has been successfully deleted.",
        });
        router.push('/home'); // Redirect to home after deletion
      })
      .catch((serverError) => {
        const permissionError = new FirestorePermissionError({
          path: postRef.path,
          operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const handleShare = async () => {
    const shareData = {
      title: `Post by ${formatUserId(post.authorId)}`,
      text: post.content,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        toast({
            title: "Link Copied",
            description: "Post link has been copied to your clipboard.",
        });
      }
    } catch (error) {
      console.error("Error sharing:", error);
      toast({
        variant: "destructive",
        title: "Could not share",
        description: "There was an error trying to share this post.",
      });
    }
  };
  
  const handleEditPost = () => {
    setIsMoreOptionsSheetOpen(false);
    router.push(`/post?postId=${post.id}`);
  };

  return (
    <>
    <Card className="w-full shadow-none rounded-none border-x-0 border-t-0 border-b">
      <CardContent className="p-4">
        <div className="flex space-x-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={isAvatarUrl ? avatar : undefined} alt={String(formatUserId(post.authorId))} />
            <AvatarFallback>{!isAvatarUrl ? avatar : ''}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <div className="flex justify-between items-start">
                <div className="flex items-center space-x-2">
                    <Link href={`/profile/${post.authorId}`} className="text-sm font-semibold hover:underline">
                      {formatUserId(post.authorId)}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {post.timestamp
                      ? formatTimestamp(post.timestamp.toDate())
                      : ""}
                   </span>
                </div>
              <div className="flex items-center">
                {isOwner && (
                    <Sheet open={isMoreOptionsSheetOpen} onOpenChange={setIsMoreOptionsSheetOpen}>
                        <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="rounded-t-[10px]">
                             <SheetHeader className="sr-only">
                                <SheetTitle>Options for post</SheetTitle>
                                <SheetDescription>Manage your post.</SheetDescription>
                            </SheetHeader>
                            <div className="grid gap-2 py-4">
                                 <div className="border rounded-[10px]">
                                    <Button variant="ghost" className="justify-between text-base py-6 rounded-[10px] w-full" onClick={handleEditPost}>
                                        <span className="font-semibold">Edit</span>
                                        <Edit className="h-5 w-5" />
                                    </Button>
                                 </div>
                                <div className="border rounded-[10px]">
                                    <Button variant="ghost" className="justify-between text-base py-6 rounded-[10px] w-full text-destructive hover:text-destructive" onClick={() => { setIsMoreOptionsSheetOpen(false); setIsDeleteSheetOpen(true); }}>
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

            <p className="text-foreground text-base whitespace-pre-wrap">{post.content}</p>

            {post.type === 'quote' && post.quotedPost && (
              <div className="mt-2">
                <QuotedPostCard post={post.quotedPost} />
              </div>
            )}
            
            {post.linkMetadata && <LinkPreview metadata={post.linkMetadata} />}
            
            {post.type === 'poll' && post.pollOptions && (
              <PollComponent post={post} user={user} onVote={(updatedData) => updatePost(updatedData)} />
            )}


            <div className="border-t border-b -mx-4 my-2 px-4 py-2 text-sm text-muted-foreground flex items-center justify-around">
                <div className="flex items-center space-x-2">
                    <span className="font-bold text-foreground"><AnimatedCount count={post.likeCount} direction={likeDirection}/></span>
                    <span>Likes</span>
                </div>
                 <div className="flex items-center space-x-2">
                    <span className="font-bold text-foreground"><AnimatedCount count={post.commentCount} direction="up" /></span>
                    <span>Replies</span>
                </div>
                 <div className="flex items-center space-x-2">
                    <span className="font-bold text-foreground"><AnimatedCount count={post.repostCount} direction="up" /></span>
                    <span>Reposts</span>
                </div>
            </div>

            <div className="flex items-center justify-around pt-2 text-muted-foreground">
                <button
                    onClick={handleLike}
                    disabled={isLiking}
                    className={cn("flex items-center space-x-1", hasLiked && "text-pink-500")}
                >
                    <Heart
                    className="h-4 w-4"
                    fill={hasLiked ? 'currentColor' : 'none'}
                    />
                </button>
                <button className={cn(
                    "flex items-center space-x-1 relative",
                    repliesAllowed ? "hover:text-primary" : "opacity-50"
                )}>
                    <div className="relative">
                        <MessageCircle className="h-4 w-4" />
                        {!repliesAllowed && <Slash className="absolute top-0 left-0 h-4 w-4 stroke-[2.5px]" />}
                    </div>
                </button>
                <button className="flex items-center space-x-1 hover:text-green-500">
                    <Repeat className={cn("h-4 w-4")} />
                </button>
                 <button onClick={handleShare} className="flex items-center space-x-1 hover:text-primary">
                    <ArrowUpRight className="h-4 w-4" />
                  </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    <Sheet open={isDeleteSheetOpen} onOpenChange={setIsDeleteSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-[10px]">
            <SheetHeader className="text-center">
                <SheetTitle>Are you sure?</SheetTitle>
                <SheetDescription>
                This action cannot be undone. This will permanently delete your
                post and remove its data from our servers.
                </SheetDescription>
            </SheetHeader>
            <div className="p-4 flex flex-col gap-2">
                 <Button onClick={handleDeletePost} className={cn(buttonVariants({variant: 'destructive'}), "w-full rounded-full")}>
                    Delete
                </Button>
                <SheetClose asChild>
                    <Button variant="outline" className="w-full rounded-full">Cancel</Button>
                </SheetClose>
            </div>
        </SheetContent>
    </Sheet>
    </>
  );
}

const CommentFormSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty.").max(280),
});

function CommentForm({ post, commentsAllowed }: { post: WithId<Post>, commentsAllowed?: boolean }) {
  const { user, userProfile, firestore } = useFirebase();
  const { toast } = useToast();
  const form = useForm<z.infer<typeof CommentFormSchema>>({
    resolver: zodResolver(CommentFormSchema),
    defaultValues: { content: "" },
  });
  
  const postAuthorRef = useMemoFirebase(() => {
    if (!firestore || !post) return null;
    return doc(firestore, 'users', post.authorId);
  }, [firestore, post]);
  const { data: postAuthorProfile } = useDoc<UserProfile>(postAuthorRef);

  const onSubmit = async (values: z.infer<typeof CommentFormSchema>) => {
    if (!user || !firestore) {
      toast({ variant: "destructive", title: "You must be logged in to comment." });
      return;
    }

    const postRef = doc(firestore, "posts", post.id);
    const commentRef = doc(collection(firestore, "posts", post.id, "comments"));
    const postAuthorRepliesRef = doc(firestore, `users/${post.authorId}/replies`, commentRef.id);
    
    const isRestricted = postAuthorProfile?.restrictedUsers?.includes(user.uid);
    const commentStatus = isRestricted ? 'pending_approval' : 'approved';


    const newComment: Omit<Comment, 'timestamp'> = {
      id: commentRef.id,
      postId: post.id,
      authorId: user.uid,
      postAuthorId: post.authorId, 
      content: values.content,
      status: commentStatus,
    };
    
    const batch = writeBatch(firestore);
    batch.set(commentRef, {...newComment, timestamp: serverTimestamp()});

    if (commentStatus === 'approved') {
        batch.update(postRef, { commentCount: increment(1) });
    }
    
    const replyData = { ...newComment, id: commentRef.id, timestamp: serverTimestamp() };
    batch.set(postAuthorRepliesRef, replyData);


    batch.commit()
      .then(() => {
        form.reset();
        
        if (user.uid === post.authorId) return;
        
        const notificationRef = doc(collection(firestore, 'users', post.authorId, 'notifications'));
        if (isRestricted) {
             toast({ title: "Comment submitted for approval", description: "The author has restricted comments, so your comment will be visible after they approve it." });
             const notificationData: Partial<Notification> = {
                type: 'comment_approval',
                postId: post.id,
                activityContent: values.content.substring(0, 100),
                fromUserId: user.uid,
                timestamp: serverTimestamp(),
                read: false,
            };
            setDoc(notificationRef, { ...notificationData, id: notificationRef.id }).catch(serverError => {
                console.error("Failed to create approval notification:", serverError);
            });
        } else {
            const notificationData: Partial<Notification> = {
                type: 'comment',
                postId: post.id,
                activityContent: values.content.substring(0, 100),
                fromUserId: user.uid,
                timestamp: serverTimestamp(),
                read: false,
            };
            setDoc(notificationRef, { ...notificationData, id: notificationRef.id }).catch(serverError => {
                console.error("Failed to create comment notification:", serverError);
            });
        }
      })
      .catch(serverError => {
        const permissionError = new FirestorePermissionError({
            path: commentRef.path,
            operation: 'create',
            requestResourceData: newComment,
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };
  
  if (commentsAllowed === false) {
    return (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t z-10 max-w-2xl mx-auto sm:px-4">
            <div className="p-4 text-center text-sm text-muted-foreground">
                The author has turned off replies for this post.
            </div>
        </div>
    );
  }

  const avatar = getAvatar(userProfile);
  const isAvatarUrl = avatar.startsWith('http');

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t z-10 max-w-2xl mx-auto sm:px-4">
        <div className="p-2">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-center gap-2 rounded-full bg-secondary px-3">
                <Avatar className="h-8 w-8">
                    <AvatarImage src={isAvatarUrl ? avatar : undefined} alt={String(formatUserId(user?.uid))} />
                    <AvatarFallback>{!isAvatarUrl ? avatar : ''}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                    <FormItem>
                        <FormControl>
                        <Textarea
                            placeholder="Post your reply"
                            className="text-base border-none focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none p-0 bg-transparent py-2.5 px-2"
                            rows={1}
                            {...field}
                        />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                </div>
                <Button 
                    type="submit" 
                    disabled={form.formState.isSubmitting} 
                    size="icon"
                    className="rounded-full shrink-0 h-8 w-8 bg-black hover:bg-gray-800"
                >
                    <Send className="h-4 w-4" fill="currentColor"/>
                </Button>
                </form>
            </Form>
        </div>
    </div>
  );
}

const updateCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty.").max(280, "Comment is too long."),
});

function CommentItem({ comment, postAuthorId }: { comment: WithId<Comment>, postAuthorId?: string }) {
  const { user } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const isPostOwner = user && user.uid === postAuthorId;
  const isCommentOwner = user && user.uid === comment.authorId;
  const canManage = isPostOwner || isCommentOwner;
  const isPendingApproval = comment.status === 'pending_approval';

  const avatar = getAvatar({id: comment.authorId});
  const isAvatarUrl = avatar.startsWith('http');
  
  const form = useForm<z.infer<typeof updateCommentSchema>>({
    resolver: zodResolver(updateCommentSchema),
    defaultValues: { content: comment.content },
  });


  const handleDelete = () => {
    setIsSheetOpen(false);
    if (!firestore || !canManage) return;

    const commentRef = doc(firestore, "posts", comment.postId, "comments", comment.id);
    const postRef = doc(firestore, "posts", comment.postId);
    const replyRef = doc(firestore, `users/${comment.postAuthorId}/replies`, comment.id);


    const batch = writeBatch(firestore);
    batch.delete(commentRef);
    batch.delete(replyRef); // Also delete the denormalized reply
    if (comment.status === 'approved') {
        batch.update(postRef, { commentCount: increment(-1) });
    }

    batch.commit().catch(serverError => {
        const permissionError = new FirestorePermissionError({
            path: commentRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
    });
  };
  
  const handleEdit = () => {
    setIsSheetOpen(false);
    setIsEditing(true);
  }
  
  const handleUpdate = async (values: z.infer<typeof updateCommentSchema>) => {
    if (!firestore || !isCommentOwner) return;
    setIsUpdating(true);
    
    const commentRef = doc(firestore, "posts", comment.postId, "comments", comment.id);
    const replyRef = doc(firestore, `users/${comment.postAuthorId}/replies`, comment.id);

    const updateData = { 
        content: values.content,
        lastEdited: serverTimestamp()
    };
    
    try {
        const batch = writeBatch(firestore);
        batch.update(commentRef, updateData);
        batch.update(replyRef, updateData);
        await batch.commit();

        setIsEditing(false);
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: commentRef.path,
            operation: 'update',
            requestResourceData: updateData,
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update your comment.' });
    } finally {
        setIsUpdating(false);
    }
  }


  const handleApprove = () => {
      if (!firestore || !isPostOwner) return;
      const commentRef = doc(firestore, "posts", comment.postId, "comments", comment.id);
      const postRef = doc(firestore, "posts", comment.postId);
      const replyRef = doc(firestore, `users/${comment.postAuthorId}/replies`, comment.id);
      
      const batch = writeBatch(firestore);
      batch.update(commentRef, { status: 'approved' });
      batch.update(replyRef, { status: 'approved' });
      batch.update(postRef, { commentCount: increment(1) });
      
      batch.commit()
        .then(() => {
            toast({ title: "Comment Approved" });
        })
        .catch(serverError => {
            const permissionError = new FirestorePermissionError({
                path: commentRef.path,
                operation: 'update',
                requestResourceData: { status: 'approved' }
            });
            errorEmitter.emit('permission-error', permissionError);
      });
  }
  
  if (isPendingApproval && !isPostOwner && !isCommentOwner) {
    return null;
  }


  return (
    <div className="flex space-x-3 p-4 border-b">
      <Avatar className="h-8 w-8">
        <AvatarImage src={isAvatarUrl ? avatar : undefined} alt={String(formatUserId(comment.authorId))} />
        <AvatarFallback>{!isAvatarUrl ? avatar : ''}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                <Link href={`/profile/${comment.authorId}`} className="font-semibold text-sm text-foreground hover:underline">
                    {formatUserId(comment.authorId)}
                </Link>
                <span>•</span>
                <span>
                    {comment.timestamp
                        ? formatTimestamp(comment.timestamp.toDate())
                        : ""}
                </span>
                {comment.lastEdited && (
                    <>
                        <span>•</span>
                        <span className="italic">Edited</span>
                    </>
                )}
            </div>
            {canManage && !isEditing && (
                 <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="rounded-t-[10px]">
                        <SheetHeader className="text-left">
                            <SheetTitle>Options for reply</SheetTitle>
                            <SheetDescription>Manage your reply.</SheetDescription>
                        </SheetHeader>
                        <div className="grid gap-2 py-4">
                             {isCommentOwner && (
                                <div className="border rounded-[10px]">
                                    <Button variant="ghost" className="justify-between text-base py-6 rounded-[10px] w-full" onClick={handleEdit}>
                                        <span className="font-semibold">Edit</span>
                                        <Edit className="h-5 w-5" />
                                    </Button>
                                </div>
                             )}
                            <div className="border rounded-[10px]">
                                <Button variant="ghost" className="justify-between text-base py-6 rounded-[10px] w-full text-destructive hover:text-destructive" onClick={handleDelete}>
                                    <span className="font-semibold">Delete</span>
                                    <Trash2 className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    </SheetContent>
                </Sheet>
            )}
        </div>
        
        {isEditing ? (
             <Form {...form}>
                <form onSubmit={form.handleSubmit(handleUpdate)} className="space-y-3 mt-2">
                    <FormField
                        control={form.control}
                        name="content"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <Textarea {...field} className="text-sm" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
                        <Button type="submit" size="sm" disabled={isUpdating}>
                            {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Save
                        </Button>
                    </div>
                </form>
            </Form>
        ) : (
            <p className={cn("text-sm text-foreground whitespace-pre-wrap", isPendingApproval && "text-muted-foreground")}>{comment.content}</p>
        )}
        
        {isPendingApproval && isPostOwner && (
            <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div>
                        <p className="text-sm font-semibold text-amber-800">This reply is pending your approval</p>
                        <p className="text-xs text-amber-600">This reply is only visible to you and {formatUserId(comment.authorId)} until you approve it.</p>
                        <div className="mt-3 flex items-center gap-2">
                             <Button size="sm" variant="ghost" className="h-8" onClick={handleApprove}>
                                <Check className="h-4 w-4 mr-1" />
                                Approve
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 text-destructive hover:text-destructive" onClick={handleDelete}>
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}

function PostPageSkeleton() {
  return (
    <div>
        <Card className="w-full shadow-none rounded-none border-x-0 border-t-0">
          <CardContent className="p-4">
            <div className="flex space-x-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-[150px]" />
                <Skeleton className="h-8 w-full mt-4" />
                <Skeleton className="h-6 w-3/4" />
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="p-4 border-b">
            <div className="flex space-x-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-8 w-20 ml-auto" />
                </div>
            </div>
        </div>
    </div>
  );
}


export default function PostDetailPage() {
  const { firestore, user } = useFirebase();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const postRef = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return doc(firestore, "posts", id);
  }, [firestore, id]);

  const commentsQuery = useMemoFirebase(() => {
    if (!firestore || !id) return null;
    return query(
      collection(firestore, "posts", id, "comments"),
      orderBy("timestamp", "asc")
    );
  }, [firestore, id]);

  const { data: post, isLoading: isPostLoading, setData: setPost } = useDoc<Post>(postRef);
  const { data: comments, isLoading: areCommentsLoading } = useCollection<Comment>(commentsQuery);
  
  const updatePostState = (updatedData: Partial<Post>) => {
    setPost(currentPost => {
        if (!currentPost) return null;
        return { ...currentPost, ...updatedData };
    });
  };


  if (isPostLoading) {
    return (
      <AppLayout showTopBar={false} showBottomNav={false}>
        <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft />
          </Button>
          <h2 className="text-lg font-bold mx-auto">Post</h2>
        </div>
        <div className="pt-14">
            <PostPageSkeleton />
        </div>
      </AppLayout>
    );
  }
  
  if (!post) {
    return (
      <AppLayout showTopBar={false} showBottomNav={false}>
        <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft />
          </Button>
          <h2 className="text-lg font-bold mx-auto">Post</h2>
        </div>
        <div className="text-center py-20 pt-32">
          <h2 className="text-2xl font-headline text-primary">Post not found</h2>
          <p className="text-muted-foreground mt-2">
            This post may have been deleted.
          </p>
        </div>
      </AppLayout>
    );
  }

  const filteredComments = comments?.filter(comment => {
     const isPostOwner = user && user.uid === post.authorId;
     const isCommentOwner = user && user.uid === comment.authorId;
     return comment.status === 'approved' || isPostOwner || isCommentOwner;
  });

  return (
    <AppLayout showTopBar={false} showBottomNav={false}>
        <motion.div
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
        >
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">Post</h2>
            </div>
            <div className="pt-14 pb-40">
                <PostDetailItem post={post} updatePost={updatePostState} />
                <div>
                    {(post.commentsAllowed !== false && areCommentsLoading) && <div className="p-4 text-center">Loading replies...</div>}
                    
                    {post.commentsAllowed !== false && filteredComments?.map((comment) => (
                        <CommentItem key={comment.id} comment={comment} postAuthorId={post.authorId} />
                    ))}

                    {(post.commentsAllowed !== false && !areCommentsLoading && filteredComments?.length === 0) && (
                    <div className="text-center py-10">
                        <p className="text-muted-foreground">No Replies yet. Be the first to reply!</p>
                    </div>
                    )}
                </div>
            </div>
            <CommentForm post={post} commentsAllowed={post.commentsAllowed} />
        </motion.div>
    </AppLayout>
  );
}
