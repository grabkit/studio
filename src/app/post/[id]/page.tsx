

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
  getDoc
} from "firebase/firestore";
import { useCollection, type WithId } from "@/firebase/firestore/use-collection";
import { useDoc } from "@/firebase/firestore/use-doc";
import type { Post, Comment, Notification, User as UserProfile } from "@/lib/types";
import { useParams, useRouter } from "next/navigation";
import React, { useState } from "react";
import Link from 'next/link';

import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Heart, MessageCircle, ArrowUpRight, Trash2, MoreHorizontal, Edit, ArrowLeft, Repeat, Check, AlertTriangle } from "lucide-react";
import { cn, formatTimestamp, getInitials } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useForm } from "react-hook-form";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
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


const formatUserId = (uid: string | undefined) => {
  if (!uid) return "blur??????";
  return `blur${uid.substring(uid.length - 6)}`;
};

function PostDetailItem({ post }: { post: WithId<Post> }) {
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

    const postRef = doc(firestore, "posts", post.id);
    const payload = {
        likes: hasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
        likeCount: increment(hasLiked ? -1 : 1),
    };

    try {
        await updateDoc(postRef, payload);

        if (!isOwner && !hasLiked) {
            const notificationRef = doc(collection(firestore, 'users', post.authorId, 'notifications'));
            const notificationData: Omit<Notification, 'id'> = {
                type: 'like',
                postId: post.id,
                postContent: post.content.substring(0, 100),
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

  return (
    <>
    <Card className="w-full shadow-none rounded-none border-x-0 border-t-0 border-b">
      <CardContent className="p-4">
        <div className="flex space-x-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback>{getInitials(post.authorId)}</AvatarFallback>
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

            <p className="text-foreground text-base whitespace-pre-wrap">{post.content}</p>

            <div className="border-t border-b -mx-4 my-2 px-4 py-2 text-sm text-muted-foreground flex items-center justify-around">
                <div className="flex items-center space-x-2">
                    <span className="font-bold text-foreground">{post.likeCount}</span>
                    <span>Likes</span>
                </div>
                 <div className="flex items-center space-x-2">
                    <span className="font-bold text-foreground">{post.commentCount}</span>
                    <span>Replies</span>
                </div>
                 <div className="flex items-center space-x-2">
                    <span className="font-bold text-foreground">0</span>
                    <span>Reposts</span>
                </div>
            </div>

            <div className="flex items-center justify-around pt-2 text-muted-foreground">
                <button
                    onClick={handleLike}
                    className="flex items-center space-x-1 hover:text-pink-500"
                >
                    <Heart
                    className={cn("h-5 w-5", hasLiked && "text-pink-500 fill-pink-500")}
                    />
                </button>
                <button className="flex items-center space-x-1 hover:text-primary">
                    <MessageCircle className="h-5 w-5" />
                </button>
                <button className="flex items-center space-x-1 hover:text-green-500">
                    <Repeat className={cn("h-5 w-5")} />
                </button>
                 <button onClick={handleShare} className="flex items-center space-x-1 hover:text-primary">
                    <ArrowUpRight className="h-5 w-5" />
                  </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
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
    </>
  );
}

const CommentFormSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty.").max(280),
});

function CommentForm({ post, commentsAllowed }: { post: WithId<Post>, commentsAllowed?: boolean }) {
  const { user } = useUser();
  const { firestore, userProfile } = useFirebase();
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
    
    const isRestricted = postAuthorProfile?.restrictedUsers?.includes(user.uid);
    const commentStatus = isRestricted ? 'pending_approval' : 'approved';


    const newComment: Omit<Comment, 'timestamp'> = {
      id: commentRef.id,
      postId: post.id,
      authorId: user.uid,
      content: values.content,
      status: commentStatus,
    };
    
    const batch = writeBatch(firestore);
    batch.set(commentRef, {...newComment, timestamp: serverTimestamp()});
    batch.update(postRef, { commentCount: increment(1) });

    batch.commit()
      .then(() => {
        form.reset();
        
        if(isRestricted) {
             toast({ title: "Comment submitted for approval", description: "The author has restricted comments, so your comment will be visible after they approve it." });
        }
        
        if (user.uid !== post.authorId && !isRestricted) {
            const notificationRef = doc(collection(firestore, 'users', post.authorId, 'notifications'));
            const notificationData: Omit<Notification, 'id'> = {
                type: 'comment',
                postId: post.id,
                postContent: post.content.substring(0, 100),
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


  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t z-10 max-w-2xl mx-auto sm:px-4">
        <div className="p-4">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-center space-x-3">
                <Avatar className="h-8 w-8">
                    <AvatarFallback>{getInitials(user?.displayName)}</AvatarFallback>
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
                            className="text-base border-none focus-visible:ring-0 shadow-none p-0"
                            rows={1}
                            {...field}
                        />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                </div>
                <Button type="submit" disabled={form.formState.isSubmitting} size="sm">
                    Reply
                </Button>
                </form>
            </Form>
        </div>
    </div>
  );
}

function CommentItem({ comment, postAuthorId }: { comment: WithId<Comment>, postAuthorId?: string }) {
  const { user } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const isPostOwner = user && user.uid === postAuthorId;
  const isCommentOwner = user && user.uid === comment.authorId;
  const canDelete = isPostOwner || isCommentOwner;
  const isPendingApproval = comment.status === 'pending_approval';

  const handleDelete = () => {
    if (!firestore || !canDelete) return;

    const commentRef = doc(firestore, "posts", comment.postId, "comments", comment.id);
    const postRef = doc(firestore, "posts", comment.postId);

    const batch = writeBatch(firestore);
    batch.delete(commentRef);
    batch.update(postRef, { commentCount: increment(-1) });

    batch.commit().catch(serverError => {
        const permissionError = new FirestorePermissionError({
            path: commentRef.path,
            operation: 'delete',
        });
        errorEmitter.emit('permission-error', permissionError);
    });
  };
  
  const handleApprove = () => {
      if (!firestore || !isPostOwner) return;
      const commentRef = doc(firestore, "posts", comment.postId, "comments", comment.id);
      updateDoc(commentRef, { status: 'approved' })
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
        <AvatarFallback>{getInitials(comment.authorId)}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
                <Link href={`/profile/${comment.authorId}`} className="font-semibold text-sm hover:underline">
                    {formatUserId(comment.authorId)}
                </Link>
                <span className="text-xs text-muted-foreground">
                {comment.timestamp
                    ? formatTimestamp(comment.timestamp.toDate())
                    : ""}
                </span>
            </div>
        </div>
        <p className={cn("text-sm text-foreground whitespace-pre-wrap", isPendingApproval && "text-muted-foreground")}>{comment.content}</p>
        
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

  const { data: post, isLoading: isPostLoading } = useDoc<Post>(postRef);
  const { data: comments, isLoading: areCommentsLoading } = useCollection<Comment>(commentsQuery);

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
        <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
                <ArrowLeft />
            </Button>
            <h2 className="text-lg font-bold mx-auto -translate-x-4">Post</h2>
        </div>
        <div className="pt-14 pb-40">
            <PostDetailItem post={post} />
            <div>
                {(post.commentsAllowed !== false && areCommentsLoading) && <div className="p-4 text-center">Loading comments...</div>}
                
                {post.commentsAllowed !== false && filteredComments?.map((comment) => (
                    <CommentItem key={comment.id} comment={comment} postAuthorId={post.authorId} />
                ))}

                {(post.commentsAllowed !== false && !areCommentsLoading && filteredComments?.length === 0) && (
                <div className="text-center py-10">
                    <p className="text-muted-foreground">No comments yet. Be the first to reply!</p>
                </div>
                )}
            </div>
        </div>
        <CommentForm post={post} commentsAllowed={post.commentsAllowed} />
    </AppLayout>
  );
}
