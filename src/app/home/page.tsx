

"use client";

import AppLayout from "@/components/AppLayout";
import { useFirebase, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, orderBy, limit, doc, updateDoc, arrayUnion, arrayRemove, increment, deleteDoc, setDoc, serverTimestamp, deleteDoc as deleteBookmarkDoc, runTransaction } from "firebase/firestore";
import { useCollection, type WithId } from "@/firebase/firestore/use-collection";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import type { Post, Bookmark, PollOption } from "@/lib/types";
import { Heart, MessageCircle, Repeat, Send, MoreHorizontal, Edit, Trash2, Bookmark as BookmarkIcon, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import React, { useState, useMemo } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useRouter } from "next/navigation";


const formatUserId = (uid: string | undefined) => {
  if (!uid) return "blur??????";
  return `blur${uid.substring(uid.length - 6)}`;
};

const getInitials = (name: string | null | undefined) => {
  if (!name) return "U";
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
};


function PollComponent({ post, user }: { post: WithId<Post>, user: any }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    
    const userVoteIndex = post.voters && user ? post.voters[user.uid] : undefined;
    const hasVoted = userVoteIndex !== undefined;

    const totalVotes = useMemo(() => {
        return post.pollOptions?.reduce((acc, option) => acc + option.votes, 0) || 0;
    }, [post.pollOptions]);

    const handleVote = async (optionIndex: number) => {
        if (!user || !firestore) {
            toast({ variant: "destructive", title: "You must be logged in to vote." });
            return;
        }
        if (hasVoted || isProcessing) return;

        setIsProcessing(true);

        const postRef = doc(firestore, 'posts', post.id);

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
            const permissionError = new FirestorePermissionError({
                path: postRef.path,
                operation: 'update',
                requestResourceData: { vote: optionIndex },
            });
            errorEmitter.emit('permission-error', permissionError);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="mt-4 space-y-2.5">
            {post.pollOptions?.map((option, index) => {
                const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
                const isUserChoice = userVoteIndex === index;

                if (hasVoted) {
                    return (
                        <div key={index} className="relative w-full h-10 rounded-full overflow-hidden bg-secondary">
                             <div
                                className={cn(
                                    "absolute left-0 top-0 h-full rounded-full transition-all duration-500 ease-out",
                                    isUserChoice ? "bg-primary" : "bg-primary/20"
                                )}
                                style={{ width: `${percentage}%` }}
                            />
                            <div className="absolute inset-0 flex items-center justify-between px-4">
                                <div className="flex items-center gap-2">
                                     {isUserChoice && <CheckCircle2 className="h-4 w-4 text-primary-foreground" />}
                                    <span className={cn(
                                        "font-medium truncate",
                                        isUserChoice ? "text-primary-foreground" : "text-primary"
                                    )}>
                                        {option.option}
                                    </span>
                                </div>
                                <span className={cn(
                                    "font-semibold",
                                    isUserChoice && percentage < 99 ? "text-primary" :
                                    isUserChoice ? "text-primary-foreground" : "text-primary"
                                )}>
                                    {percentage.toFixed(0)}%
                                </span>
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

function PostItem({ post, bookmarks }: { post: WithId<Post>, bookmarks: WithId<Bookmark>[] | null }) {
  const { user, firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const hasLiked = user ? post.likes?.includes(user.uid) : false;
  const isOwner = user?.uid === post.authorId;
  const isBookmarked = useMemo(() => bookmarks?.some(b => b.postId === post.id), [bookmarks, post.id]);


  const handleLike = async () => {
    if (!user || !firestore) {
        toast({
            variant: "destructive",
            title: "Authentication Error",
            description: "You must be logged in to like a post.",
        });
        return;
    }

    const postRef = doc(firestore, 'posts', post.id);
    const payload = {
        likes: hasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
        likeCount: increment(hasLiked ? -1 : 1)
    };
    
    updateDoc(postRef, payload).catch((serverError) => {
        const permissionError = new FirestorePermissionError({
            path: postRef.path,
            operation: 'update',
            requestResourceData: payload,
        });
        errorEmitter.emit('permission-error', permissionError);
    });
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
        setIsDeleteDialogOpen(false);
      })
      .catch((serverError) => {
        const permissionError = new FirestorePermissionError({
          path: postRef.path,
          operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
      });
  };

  const handleRepost = () => {
    const encodedContent = encodeURIComponent(post.content);
    router.push(`/post?content=${encodedContent}`);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Check out this post on Blur',
          text: post.content,
          url: `${window.location.origin}/post/${post.id}`,
        });
      } catch (error) {
        // Silently fail. The user likely canceled the share action.
      }
    } else {
      toast({
        variant: "destructive",
        title: "Not Supported",
        description: "Your browser does not support the Web Share API.",
      });
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
        deleteBookmarkDoc(bookmarkRef).catch(serverError => {
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


  return (
    <Card className="w-full shadow-none border-x-0 border-t-0 rounded-none">
      <CardContent className="p-4">
        <div className="flex space-x-3">
          {isOwner ? (
            <Link href="/account">
              <Avatar className="h-10 w-10">
                <AvatarFallback>{getInitials(post.authorId)}</AvatarFallback>
              </Avatar>
            </Link>
          ) : (
            <Avatar className="h-10 w-10">
              <AvatarFallback>{getInitials(post.authorId)}</AvatarFallback>
            </Avatar>
          )}
          <div className="flex-1 space-y-2">
            <div className="flex justify-between items-start">
              <div className="flex items-center">
                 {isOwner ? (
                    <Link href="/account" className="text-sm font-semibold hover:underline">
                        {formatUserId(post.authorId)}
                    </Link>
                 ) : (
                    <span className="text-sm font-semibold">
                        {formatUserId(post.authorId)}
                    </span>
                 )}
              </div>
               <div className="flex items-center space-x-2">
                 <span className="text-xs text-muted-foreground">
                    {post.timestamp ? formatDistanceToNow(new Date(post.timestamp.toDate()), { addSuffix: true }) : ''}
                 </span>
                 {isOwner && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" />
                          <span>Edit Post</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setIsDeleteDialogOpen(true)} className="text-destructive">
                           <Trash2 className="mr-2 h-4 w-4" />
                           <span>Delete Post</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                 )}
               </div>
            </div>
            
            <p className="text-foreground text-sm whitespace-pre-wrap">{post.content}</p>

            {post.type === 'poll' && post.pollOptions && (
              <PollComponent post={post} user={user} />
            )}


            <div className="flex items-center justify-between pt-2 text-muted-foreground">
                <div className="flex items-center space-x-6">
                  <button onClick={handleLike} className="flex items-center space-x-1 hover:text-pink-500">
                    <Heart className={cn("h-4 w-4", hasLiked && "text-pink-500 fill-pink-500")} />
                    <span className="text-xs">{post.likeCount > 0 ? post.likeCount : ''}</span>
                  </button>
                  <Link href={`/post/${post.id}`} className="flex items-center space-x-1 hover:text-primary">
                    <MessageCircle className="h-4 w-4" />
                     <span className="text-xs">{post.commentCount > 0 ? post.commentCount : ''}</span>
                  </Link>
                  <button onClick={handleRepost} className="flex items-center space-x-1 hover:text-green-500">
                    <Repeat className={cn("h-4 w-4")} />
                  </button>
                  <button onClick={handleShare} className="flex items-center space-x-1 hover:text-primary">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                 <button onClick={handleBookmark} className="flex items-center space-x-1 hover:text-blue-500">
                    <BookmarkIcon className={cn("h-4 w-4", isBookmarked && "text-blue-500 fill-blue-500")} />
                </button>
            </div>
          </div>
        </div>
      </CardContent>
       <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your
              post and remove its data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePost} className={cn(buttonVariants({variant: 'destructive'}))}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function PostSkeleton() {
  return (
    <Card className="w-full shadow-none border-x-0 border-t-0 rounded-none">
      <CardContent className="p-4">
        <div className="flex space-x-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-[150px]" />
              <Skeleton className="h-3 w-[100px]" />
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
  const { firestore, user } = useFirebase();

  const postsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'posts'),
      orderBy("timestamp", "desc"),
      limit(50)
    );
  }, [firestore]);

  const bookmarksQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'users', user.uid, 'bookmarks');
  }, [firestore, user]);

  const { data: posts, isLoading: postsLoading } = useCollection<Post>(postsQuery);
  const { data: bookmarks, isLoading: bookmarksLoading } = useCollection<Bookmark>(bookmarksQuery);

  const isLoading = postsLoading || bookmarksLoading;

  return (
    <AppLayout>
      <div className="divide-y border-b">
        {isLoading && (
          <>
            <PostSkeleton />
            <PostSkeleton />
            <PostSkeleton />
          </>
        )}
        {!isLoading && posts?.length === 0 && (
          <div className="text-center py-10">
            <h2 className="text-2xl font-headline text-primary">No posts yet!</h2>
            <p className="text-muted-foreground mt-2">Be the first to post something.</p>
          </div>
        )}
        {posts?.map((post) => (
          <PostItem key={post.id} post={post} bookmarks={bookmarks} />
        ))}
      </div>
    </AppLayout>
  );
}
