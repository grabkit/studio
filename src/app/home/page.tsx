

"use client";

import AppLayout from "@/components/AppLayout";
import { useFirebase, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, orderBy, limit, doc, writeBatch, arrayUnion, arrayRemove, increment, deleteDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { useCollection, type WithId } from "@/firebase/firestore/use-collection";
import { useDoc } from "@/firebase/firestore/use-doc";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import type { Post, Bookmark } from "@/lib/types";
import { Heart, MessageCircle, Repeat, Send, MoreHorizontal, Edit, Trash2, Bookmark as BookmarkIcon } from "lucide-react";
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


const formatUserId = (uid: string | undefined) => {
  if (!uid) return "blur??????";
  return `blur${uid.substring(uid.length - 6)}`;
};

const getInitials = (name: string | null | undefined) => {
  if (!name) return "U";
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
};

function PostItem({ post }: { post: WithId<Post> }) {
  const { user, firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  const hasLiked = user ? post.likes?.includes(user.uid) : false;
  const isOwner = user?.uid === post.authorId;

  const bookmarkRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, "users", user.uid, "bookmarks", post.id);
  }, [firestore, user, post.id]);

  const { data: bookmark, isLoading: isBookmarkLoading } = useDoc<Bookmark>(bookmarkRef);
  const isBookmarked = !!bookmark;


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
    const batch = writeBatch(firestore);

    if (hasLiked) {
      batch.update(postRef, {
        likes: arrayRemove(user.uid),
        likeCount: increment(-1)
      });
    } else {
      batch.update(postRef, {
        likes: arrayUnion(user.uid),
        likeCount: increment(1)
      });
    }

    batch.commit().catch((serverError) => {
        const payload = {
            likes: hasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
            likeCount: increment(hasLiked ? -1 : 1)
        };
        const permissionError = new FirestorePermissionError({
            path: postRef.path,
            operation: 'update',
            requestResourceData: payload,
        });
        errorEmitter.emit('permission-error', permissionError);
    });
  };

  const handleBookmark = () => {
    if (!bookmarkRef) return;

    if (isBookmarked) {
        deleteDoc(bookmarkRef).catch(error => {
            const permissionError = new FirestorePermissionError({ path: bookmarkRef.path, operation: 'delete' });
            errorEmitter.emit('permission-error', permissionError);
        });
    } else {
        const newBookmark: Bookmark = {
            itemId: post.id,
            itemType: 'post',
            originalOwnerId: post.authorId,
            createdAt: serverTimestamp(),
        }
        setDoc(bookmarkRef, newBookmark).catch(error => {
            const permissionError = new FirestorePermissionError({ path: bookmarkRef.path, operation: 'create', requestResourceData: newBookmark });
            errorEmitter.emit('permission-error', permissionError);
        })
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
                <span className="text-sm font-semibold">{formatUserId(post.authorId)}</span>
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
            
            <p className="text-foreground text-sm">{post.content}</p>
            
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
                 <button onClick={handleBookmark} disabled={isBookmarkLoading} className="flex items-center space-x-1 hover:text-yellow-500">
                    <BookmarkIcon className={cn("h-4 w-4", isBookmarked && "text-yellow-500 fill-yellow-500")} />
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
                <Skeleton className="h-4 w-4" />
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
