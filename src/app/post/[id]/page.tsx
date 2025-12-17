
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
} from "firebase/firestore";
import { useCollection, type WithId } from "@/firebase/firestore/use-collection";
import { useDoc } from "@/firebase/firestore/use-doc";
import type { Post, Comment } from "@/lib/types";
import { useParams, useRouter } from "next/navigation";
import React, { useState } from "react";

import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Heart, MessageCircle, Repeat, Send, Trash2, MoreHorizontal, Edit, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
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

const getInitials = (name: string | null | undefined) => {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
};

function PostDetailItem({ post }: { post: WithId<Post> }) {
  const { user } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const hasLiked = user ? post.likes?.includes(user.uid) : false;
  const hasReposted = user ? post.reposts?.includes(user.uid) : false;
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
    const batch = writeBatch(firestore);

    if (hasLiked) {
      batch.update(postRef, {
        likes: arrayRemove(user.uid),
        likeCount: increment(-1),
      });
    } else {
      batch.update(postRef, {
        likes: arrayUnion(user.uid),
        likeCount: increment(1),
      });
    }

    batch.commit().catch((serverError) => {
      const payload = {
          likes: hasLiked
            ? arrayRemove(user.uid)
            : arrayUnion(user.uid),
          likeCount: increment(hasLiked ? -1 : 1),
      };
      const permissionError = new FirestorePermissionError({
          path: postRef.path,
          operation: 'update',
          requestResourceData: payload,
      });
      errorEmitter.emit('permission-error', permissionError);
    });
  };

  const handleRepost = async () => {
    if (!user || !firestore) {
        toast({
            variant: "destructive",
            title: "Authentication Error",
            description: "You must be logged in to repost.",
        });
        return;
    }

    const postRef = doc(firestore, 'posts', post.id);
    const batch = writeBatch(firestore);

    if (hasReposted) {
      batch.update(postRef, {
        reposts: arrayRemove(user.uid),
        repostCount: increment(-1)
      });
    } else {
      batch.update(postRef, {
        reposts: arrayUnion(user.uid),
        repostCount: increment(1)
      });
    }

    batch.commit().catch((serverError) => {
        const payload = {
            reposts: hasReposted ? arrayRemove(user.uid) : arrayUnion(user.uid),
            repostCount: increment(hasReposted ? -1 : 1)
        };
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
              <div className="flex items-center">
                <span className="text-sm font-semibold">
                  {formatUserId(post.authorId)}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                 <span className="text-xs text-muted-foreground">
                    {post.timestamp
                    ? formatDistanceToNow(new Date(post.timestamp.toDate()), {
                        addSuffix: true,
                        })
                    : ""}
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

            <p className="text-foreground text-base">{post.content}</p>

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
                    <span className="font-bold text-foreground">{post.repostCount}</span>
                    <span>Reposts</span>
                </div>
            </div>

            <div className="flex items-center space-x-6 pt-2 text-muted-foreground justify-around">
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
              <button onClick={handleRepost} className="flex items-center space-x-1 hover:text-green-500">
                <Repeat className={cn("h-5 w-5", hasReposted && "text-green-500")} />
              </button>
              <button className="flex items-center space-x-1 hover:text-primary">
                <Send className="h-5 w-5" />
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

function CommentForm({ postId }: { postId: string }) {
  const { user } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const form = useForm<z.infer<typeof CommentFormSchema>>({
    resolver: zodResolver(CommentFormSchema),
    defaultValues: { content: "" },
  });

  const onSubmit = async (values: z.infer<typeof CommentFormSchema>) => {
    if (!user || !firestore) {
      toast({ variant: "destructive", title: "You must be logged in to comment." });
      return;
    }

    const postRef = doc(firestore, "posts", postId);
    const commentRef = doc(collection(firestore, "posts", postId, "comments"));

    const newComment = {
      id: commentRef.id,
      postId: postId,
      authorId: user.uid,
      content: values.content,
      timestamp: serverTimestamp(),
    };
    
    const batch = writeBatch(firestore);
    batch.set(commentRef, newComment);
    batch.update(postRef, { commentCount: increment(1) });
    
    batch.commit()
        .then(() => form.reset())
        .catch(serverError => {
            const permissionError = new FirestorePermissionError({
                path: commentRef.path,
                operation: 'create',
                requestResourceData: newComment,
            });
            errorEmitter.emit('permission-error', permissionError);
        });
  };

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
                            className="text-base border-none focus-visible:ring-0 shadow-none p-0 -ml-2"
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

  const canDelete = user && (user.uid === comment.authorId || user.uid === postAuthorId);

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
  }

  return (
    <div className="flex space-x-3 p-4 border-b">
       <Avatar className="h-8 w-8">
        <AvatarFallback>{getInitials(comment.authorId)}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex justify-between items-center">
            <span className="font-semibold text-sm">{formatUserId(comment.authorId)}</span>
            <div className="flex items-center space-x-2">
                <span className="text-xs text-muted-foreground">
                {comment.timestamp
                    ? formatDistanceToNow(new Date(comment.timestamp.toDate()), {
                        addSuffix: true,
                    })
                    : ""}
                </span>
                {canDelete && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDelete}>
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                )}
            </div>
        </div>
        <p className="text-sm text-foreground">{comment.content}</p>
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
  const { firestore } = useFirebase();
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
                {areCommentsLoading && <div className="p-4 text-center">Loading comments...</div>}
                {comments?.map((comment) => (
                <CommentItem key={comment.id} comment={comment} postAuthorId={post.authorId} />
                ))}
                {!areCommentsLoading && comments?.length === 0 && (
                <div className="text-center py-10">
                    <p className="text-muted-foreground">No comments yet. Be the first to reply!</p>
                </div>
                )}
            </div>
        </div>
        <CommentForm postId={post.id} />
    </AppLayout>
  );
}
