

"use client";

import AppLayout from "@/components/AppLayout";
import { useFirebase, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, orderBy, limit, doc, writeBatch, arrayUnion, arrayRemove, increment, deleteDoc, updateDoc, runTransaction } from "firebase/firestore";
import { useCollection, type WithId } from "@/firebase/firestore/use-collection";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import type { Post } from "@/lib/types";
import { Heart, MessageCircle, Repeat, Send, MoreHorizontal, Edit, Trash2 } from "lucide-react";
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
import React, { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Progress } from "@/components/ui/progress";


const formatUserId = (uid: string | undefined) => {
  if (!uid) return "blur??????";
  return `blur${uid.substring(uid.length - 6)}`;
};

const getInitials = (name: string | null | undefined) => {
  if (!name) return "U";
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
};

function PollComponent({ post }: { post: WithId<Post> }) {
  const { user, firestore } = useFirebase();
  const { toast } = useToast();
  
  if (post.type !== 'poll' || !post.pollOptions) return null;

  const userVote = user ? post.voters?.[user.uid] : undefined;
  const totalVotes = post.pollOptions.reduce((acc, option) => acc + option.votes, 0);

  const handleVote = async (optionIndex: number) => {
    if (!user || !firestore) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "You must be logged in to vote.",
      });
      return;
    }
    
    if (userVote !== undefined) {
        toast({
            variant: "destructive",
            title: "Already Voted",
            description: "You can only vote once per poll.",
        });
        return;
    }

    const postRef = doc(firestore, 'posts', post.id);

    try {
        await runTransaction(firestore, async (transaction) => {
            const postDoc = await transaction.get(postRef);
            if (!postDoc.exists()) {
                throw "Post does not exist!";
            }

            const currentPost = postDoc.data() as Post;
            const newPollOptions = [...(currentPost.pollOptions || [])];
            newPollOptions[optionIndex].votes += 1;

            transaction.update(postRef, {
                pollOptions: newPollOptions,
                [`voters.${user.uid}`]: optionIndex
            });
        });
    } catch (e: any) {
        console.error("Vote transaction failed: ", e);
         const permissionError = new FirestorePermissionError({
            path: postRef.path,
            operation: 'update',
            requestResourceData: { [`voters.${user.uid}`]: optionIndex },
        });
        errorEmitter.emit('permission-error', permissionError);
    }
  };

  return (
    <div className="space-y-2 mt-4">
      {post.pollOptions.map((option, index) => {
        const percentage = totalVotes > 0 ? (option.votes / totalVotes) * 100 : 0;
        const didVoteForThis = userVote === index;
        
        if (userVote !== undefined) {
          // Show results
          return (
             <div key={index} className="relative">
                <Progress value={percentage} className="h-8" />
                <div className="absolute inset-0 flex items-center justify-between px-3 text-sm">
                    <span className={cn("font-medium", didVoteForThis ? "text-primary-foreground" : "text-foreground")}>{option.option}</span>
                    <span className={cn("font-medium", didVoteForThis ? "text-primary-foreground" : "text-muted-foreground")}>{percentage.toFixed(0)}%</span>
                </div>
            </div>
          )
        } else {
          // Show voting buttons
          return (
            <Button
              key={index}
              variant="outline"
              className="w-full justify-start h-8"
              onClick={() => handleVote(index)}
            >
              {option.option}
            </Button>
          )
        }
      })}
       {userVote !== undefined && (
         <p className="text-xs text-muted-foreground text-right">{totalVotes} votes</p>
       )}
    </div>
  );
}


function PostItem({ post }: { post: WithId<Post> }) {
  const { user, firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const hasLiked = user ? post.likes?.includes(user.uid) : false;
  const isOwner = user?.uid === post.authorId;

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


  return (
    <Card className="w-full shadow-none border-x-0 border-t-0 rounded-none">
      <CardContent className="p-4">
        <div className="flex space-x-3">
          <Avatar className="h-10 w-10">
            {/* The user's name is not available on the post object, so we show initials */}
            <AvatarFallback>{getInitials(post.authorId)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <div className="flex justify-between items-start">
              <div className="flex items-center">
                 <div className="text-sm font-semibold">
                    {formatUserId(post.authorId)}
                 </div>
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
            
            {post.type === 'poll' && <PollComponent post={post} />}

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
  const { firestore } = useFirebase();

  const postsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'posts'),
      orderBy("timestamp", "desc"),
      limit(50)
    );
  }, [firestore]);

  const { data: posts, isLoading } = useCollection<Post>(postsQuery);

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
          <PostItem key={post.id} post={post} />
        ))}
      </div>
    </AppLayout>
  );
}
