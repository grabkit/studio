
"use client";

import AppLayout from "@/components/AppLayout";
import { useFirebase, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, orderBy, limit, doc, updateDoc, arrayUnion, arrayRemove, increment, deleteDoc, setDoc, serverTimestamp, getDoc, runTransaction, getDocs } from "firebase/firestore";
import { useCollection, type WithId } from "@/firebase/firestore/use-collection";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import type { Post, Bookmark, PollOption, Notification, User, Conversation, LinkMetadata } from "@/lib/types";
import { Heart, MessageCircle, Repeat, ArrowUpRight, MoreHorizontal, Edit, Trash2, Bookmark as BookmarkIcon, CheckCircle2, Slash, RefreshCw } from "lucide-react";
import { cn, formatTimestamp, getInitials } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";
import Link from "next/link";
import Image from "next/image";
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
import React, { useState, useMemo, useRef, TouchEvent } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { usePresence } from "@/hooks/usePresence";


const formatUserId = (uid: string | undefined) => {
  if (!uid) return "blur??????";
  return `blur${uid.substring(uid.length - 6)}`;
};


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
                    toast({ variant: "default", title: "You have already voted." });
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

export function PostItem({ post, bookmarks }: { post: WithId<Post>, bookmarks: WithId<Bookmark>[] | null }) {
  const { user, firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const hasLiked = user ? post.likes?.includes(user.uid) : false;
  const isOwner = user?.uid === post.authorId;
  const isBookmarked = useMemo(() => bookmarks?.some(b => b.postId === post.id), [bookmarks, post.id]);
  const repliesAllowed = post.commentsAllowed !== false;


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
    
    try {
        await updateDoc(postRef, payload);

        if (!isOwner && !hasLiked) {
            const notificationRef = doc(collection(firestore, 'users', post.authorId, 'notifications'));
            const notificationData: Omit<Notification, 'id'> = {
                type: 'like',
                postId: post.id,
                postContent: post.content.substring(0, 100), // snippet of post content
                fromUserId: user.uid,
                timestamp: serverTimestamp(),
                read: false,
            };
            setDoc(notificationRef, { ...notificationData, id: notificationRef.id }).catch(serverError => {
                console.error("Failed to create like notification:", serverError);
            });
        }
    } catch (serverError) {
        const permissionError = new FirestorePermissionError({
            path: postRef.path,
            operation: 'update',
            requestResourceData: payload,
        });
        errorEmitter.emit('permission-error', permissionError);
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
    const shareData = {
      title: `Post by ${formatUserId(post.authorId)}`,
      text: post.content,
      url: `${window.location.origin}/post/${post.id}`,
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
    } catch (error: any) {
      // Ignore user cancellation of share sheet
      if (error.name === 'NotAllowedError') return;

      console.error("Error sharing:", error);
      toast({
        variant: "destructive",
        title: "Could not share",
        description: "There was an error trying to share this post.",
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
    <Card className="w-full shadow-none border-x-0 border-t-0 rounded-none">
      <CardContent className="p-4">
        <div className="flex space-x-3">
          <Link href={`/profile/${post.authorId}`}>
            <Avatar className="h-10 w-10">
              <AvatarFallback>{getInitials(post.authorId)}</AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 space-y-2">
            <div className="flex justify-between items-start">
                <div className="flex items-center space-x-2">
                    <Link href={`/profile/${post.authorId}`} className="text-sm font-semibold hover:underline">
                        {formatUserId(post.authorId)}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                        {post.timestamp ? formatTimestamp(post.timestamp.toDate()) : ''}
                    </span>
                </div>
               <div className="flex items-center">
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
            
            <Link href={`/post/${post.id}`} className="block !mt-0">
                <p className="text-foreground text-sm whitespace-pre-wrap">{post.content}</p>
            </Link>


             {post.linkMetadata && <LinkPreview metadata={post.linkMetadata} />}


            {post.type === 'poll' && post.pollOptions && (
              <PollComponent post={post} user={user} />
            )}


            <div className="flex items-center justify-between pt-2 text-muted-foreground">
                <div className="flex items-center space-x-6">
                  <button onClick={handleLike} className="flex items-center space-x-1 hover:text-pink-500">
                    <Heart className={cn("h-4 w-4", hasLiked && "text-pink-500 fill-pink-500")} />
                    <span className="text-xs">{post.likeCount > 0 ? post.likeCount : ''}</span>
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
                    <span className="text-xs">{post.commentCount > 0 ? post.commentCount : ''}</span>
                  </CommentButtonWrapper>
                  <button onClick={handleRepost} className="flex items-center space-x-1 hover:text-green-500">
                    <Repeat className={cn("h-4 w-4")} />
                  </button>
                  <button onClick={handleShare} className="flex items-center space-x-1 hover:text-primary">
                    <ArrowUpRight className="h-4 w-4" />
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
  const [posts, setPosts] = useState<WithId<Post>[] | null>(null);
  const [postsLoading, setPostsLoading] = useState(true);

  // Pull to refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullPosition, setPullPosition] = useState(0);
  const touchStartRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);


  const bookmarksQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'users', user.uid, 'bookmarks');
  }, [firestore, user]);

  const { data: bookmarks, isLoading: bookmarksLoading } = useCollection<Bookmark>(bookmarksQuery);

  const fetchPosts = async () => {
    if (!firestore) return;
    try {
        const postsQuery = query(collection(firestore, 'posts'), orderBy("timestamp", "desc"), limit(50));
        const querySnapshot = await getDocs(postsQuery);
        let fetchedPosts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WithId<Post>));
        
        // Shuffle the posts for a dynamic feed feel on refresh
        fetchedPosts.sort(() => Math.random() - 0.5);

        setPosts(fetchedPosts);
    } catch (error) {
        console.error("Error fetching posts:", error);
    } finally {
        setPostsLoading(false);
    }
  };

  React.useEffect(() => {
      setPostsLoading(true);
      fetchPosts();
  }, [firestore]);


  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await fetchPosts();
    setTimeout(() => {
      setIsRefreshing(false);
      setPullPosition(0);
    }, 500); // Animation delay
  };

  const handleTouchStart = (e: TouchEvent) => {
      touchStartRef.current = e.targetTouches[0].clientY;
  };

  const handleTouchMove = (e: TouchEvent) => {
    const touchY = e.targetTouches[0].clientY;
    const pullDistance = touchY - touchStartRef.current;
    
    // Only allow pulling when scrolled to the top
    if (containerRef.current && containerRef.current.scrollTop === 0 && pullDistance > 0 && !isRefreshing) {
      setPullPosition(Math.min(pullDistance, 120)); // Max pull
    }
  };

  const handleTouchEnd = () => {
    if (pullPosition > 70) {
      handleRefresh();
    } else {
      setPullPosition(0);
    }
  };


  const isLoading = postsLoading || bookmarksLoading;

  const filteredPosts = useMemo(() => {
    if (!posts) return [];
    const mutedUsers = userProfile?.mutedUsers || [];
    return posts.filter(post => !mutedUsers.includes(post.authorId));
  }, [posts, userProfile]);

  return (
    <AppLayout>
       <div 
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative h-full overflow-y-auto pt-12"
       >
        <div 
          className="absolute top-0 left-0 right-0 flex justify-center items-center overflow-hidden text-muted-foreground transition-all duration-300"
          style={{ height: isRefreshing ? `50px` : `${pullPosition}px`, opacity: isRefreshing ? 1 : Math.min(pullPosition/70, 1) }}
        >
           <div style={{ transform: `rotate(${isRefreshing ? 0 : Math.min(pullPosition, 70) * 3}deg)` }}>
             <RefreshCw className={cn("h-5 w-5", isRefreshing && "animate-spin")} />
           </div>
        </div>
        <div 
          className="divide-y border-b transition-transform duration-300"
          style={{ transform: `translateY(${isRefreshing ? '50px' : '0px'})` }}
        >
          {isLoading && !isRefreshing && (
            <>
              <PostSkeleton />
              <PostSkeleton />
              <PostSkeleton />
            </>
          )}
          {!isLoading && filteredPosts.length === 0 && (
            <div className="text-center py-10 h-screen">
              <h2 className="text-2xl font-headline text-primary">No posts yet!</h2>
              <p className="text-muted-foreground mt-2">Be the first to post something.</p>
            </div>
          )}
          {filteredPosts.map((post) => (
            <PostItem key={post.id} post={post} bookmarks={bookmarks} />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}

    

    

    
