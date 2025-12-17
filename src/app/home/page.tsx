"use client";

import AppLayout from "@/components/AppLayout";
import { useFirebase, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, orderBy, limit, doc, writeBatch, arrayUnion, arrayRemove, increment } from "firebase/firestore";
import { useCollection, type WithId } from "@/firebase/firestore/use-collection";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import type { Post } from "@/lib/types";
import { Heart, MessageCircle, Repeat, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";


const formatUserId = (uid: string | undefined) => {
  if (!uid) return "blur??????";
  return `blur${uid.substring(uid.length - 6)}`;
};

const getInitials = (name: string | null | undefined) => {
  if (!name) return "U";
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
};

function PostItem({ post }: { post: WithId<Post> }) {
  const { user } = useUser();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const hasLiked = user ? post.likes?.includes(user.uid) : false;

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
      // User is unliking the post
      batch.update(postRef, {
        likes: arrayRemove(user.uid),
        likeCount: increment(-1)
      });
    } else {
      // User is liking the post
      batch.update(postRef, {
        likes: arrayUnion(user.uid),
        likeCount: increment(1)
      });
    }

    // Non-blocking write with error handling
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
        console.error("Error updating likes: ", serverError);
    });
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
              <span className="text-xs text-muted-foreground">
                {post.timestamp ? formatDistanceToNow(new Date(post.timestamp.toDate()), { addSuffix: true }) : ''}
              </span>
            </div>
            
            <p className="text-foreground text-sm">{post.content}</p>
            
            <div className="flex items-center space-x-6 pt-2 text-muted-foreground">
              <button onClick={handleLike} className="flex items-center space-x-1 hover:text-pink-500">
                <Heart className={cn("h-4 w-4", hasLiked && "text-pink-500 fill-pink-500")} />
                <span className="text-xs">{post.likeCount > 0 ? post.likeCount : ''}</span>
              </button>
              <button className="flex items-center space-x-1 hover:text-primary">
                <MessageCircle className="h-4 w-4" />
              </button>
              <button className="flex items-center space-x-1 hover:text-green-500">
                <Repeat className="h-4 w-4" />
              </button>
              <button className="flex items-center space-x-1 hover:text-primary">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </CardContent>
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
            <div className="flex items-center space-x-6 pt-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-4" />
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
