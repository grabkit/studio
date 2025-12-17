"use client";

import AppLayout from "@/components/AppLayout";
import { useFirebase, useUser } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { useCollection, type WithId } from "@/firebase/firestore/use-collection";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import type { Post } from "@/lib/types";


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
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center space-x-3">
          <Avatar>
            <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || "User"} />
            <AvatarFallback>{getInitials(user?.displayName)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-semibold">{user?.displayName || "Anonymous User"}</span>
            <span className="text-xs text-muted-foreground font-mono">{formatUserId(post.authorId)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-foreground">{post.content}</p>
        <p className="text-xs text-muted-foreground mt-2">
          {formatDistanceToNow(new Date(post.timestamp), { addSuffix: true })}
        </p>
      </CardContent>
    </Card>
  );
}

function PostSkeleton() {
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center space-x-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[150px]" />
             <Skeleton className="h-3 w-[100px]" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4 mt-2" />
        <Skeleton className="h-3 w-[120px] mt-4" />
      </CardContent>
    </Card>
  );
}


export default function HomePage() {
  const { firestore } = useFirebase();
  const { user } = useUser();

  const postsQuery = firestore && user ? query(
    collection(firestore, `users/${user.uid}/posts`),
    orderBy("timestamp", "desc"),
    limit(20)
  ) : null;

  const { data: posts, isLoading } = useCollection<Post>(postsQuery);

  return (
    <AppLayout>
      <div className="space-y-4">
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
            <p className="text-muted-foreground mt-2">Click the '+' button to create your first post.</p>
          </div>
        )}
        {posts?.map((post) => (
          <PostItem key={post.id} post={post} />
        ))}
      </div>
    </AppLayout>
  );
}
