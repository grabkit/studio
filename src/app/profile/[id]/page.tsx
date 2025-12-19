
"use client";

import AppLayout from "@/components/AppLayout";
import { useFirebase, useMemoFirebase } from "@/firebase";
import { useParams, useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { collection, query, where, doc } from "firebase/firestore";
import { useCollection } from "@/firebase/firestore/use-collection";
import { useDoc } from "@/firebase/firestore/use-doc";
import { ArrowLeft, Grid3x3, FileText, Loader2 } from "lucide-react";
import type { Post, User } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import React, { useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PostGrid = ({ posts, isLoading, emptyState }: { posts: Post[] | null, isLoading: boolean, emptyState: React.ReactNode }) => {
    return (
        <>
            <div className="grid grid-cols-3 gap-1 mt-1">
                {isLoading && Array.from({length: 6}).map((_, i) => (
                    <Skeleton key={i} className="aspect-square w-full" />
                ))}
                {posts?.map((post) => (
                <Link key={post.id} href={`/post/${post.id}`}>
                    <div className="aspect-square bg-muted flex items-center justify-center hover:bg-accent transition-colors">
                        <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                </Link>
                ))}
            </div>
            {!isLoading && posts?.length === 0 && emptyState}
        </>
    )
}

const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
};

const formatUserId = (uid: string | undefined) => {
    if (!uid) return "blur??????";
    return `blur${uid.substring(uid.length - 6)}`;
};


function ProfileSkeleton() {
    return (
        <div className="px-4">
            {/* Header */}
             <div className="flex items-center justify-between mb-6">
                <Skeleton className="h-8 w-32" />
            </div>
            {/* Profile Stats */}
            <div className="flex items-center space-x-5 mb-6">
                <Skeleton className="h-20 w-20 md:h-24 md:w-24 rounded-full" />
                 <div className="flex-1 flex justify-around text-center">
                    <div>
                        <Skeleton className="h-6 w-8 mx-auto mb-1" />
                        <Skeleton className="h-4 w-12 mx-auto" />
                    </div>
                    <div>
                        <Skeleton className="h-6 w-8 mx-auto mb-1" />
                        <Skeleton className="h-4 w-12 mx-auto" />
                    </div>
                    <div>
                        <Skeleton className="h-6 w-8 mx-auto mb-1" />
                        <Skeleton className="h-4 w-16 mx-auto" />
                    </div>
                </div>
            </div>
            {/* User Info */}
            <div className="mb-4 space-y-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-48" />
            </div>
            {/* Tabs */}
            <Skeleton className="h-10 w-full" />
            {/* Grid */}
            <div className="grid grid-cols-3 gap-1 mt-1">
                {Array.from({length: 6}).map((_, i) => (
                    <Skeleton key={i} className="aspect-square w-full" />
                ))}
            </div>
        </div>
    )
}

export default function ProfilePage() {
  const { firestore } = useFirebase();
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const userRef = useMemoFirebase(() => {
    if (!firestore || !userId) return null;
    return doc(firestore, "users", userId);
  }, [firestore, userId]);
  
  const { data: profileUser, isLoading: isUserLoading } = useDoc<User>(userRef);

  const userPostsQuery = useMemoFirebase(() => {
    if (!firestore || !userId) return null;
    return query(
      collection(firestore, "posts"),
      where("authorId", "==", userId)
    );
  }, [firestore, userId]);

  const { data: posts, isLoading: postsLoading } = useCollection<Post>(userPostsQuery);

  const totalLikes = useMemo(() => {
    if (!posts) return 0;
    return posts.reduce((acc, post) => acc + (post.likeCount || 0), 0);
  }, [posts]);
  
  const totalComments = useMemo(() => {
    if (!posts) return 0;
    return posts.reduce((acc, post) => acc + (post.commentCount || 0), 0);
  }, [posts]);

  const isLoading = isUserLoading || postsLoading;

  if (isLoading) {
    return (
        <AppLayout showTopBar={false}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
            </div>
             <div className="pt-14">
                <ProfileSkeleton />
             </div>
        </AppLayout>
    )
  }

  if (!profileUser) {
    return (
       <AppLayout showTopBar={false}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
            </div>
            <div className="pt-14 text-center py-20">
                <h2 className="text-2xl font-headline text-primary">User not found</h2>
                <p className="text-muted-foreground mt-2">
                    This profile may not exist or has been deleted.
                </p>
            </div>
       </AppLayout>
    )
  }

  return (
    <AppLayout showTopBar={false}>
      <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft />
        </Button>
        <h2 className="text-lg font-bold mx-auto -translate-x-4">
            {formatUserId(profileUser?.id)}
        </h2>
      </div>

      <div className="px-4 pt-14">
        <div className="flex items-center space-x-5 mb-6">
          <Avatar className="h-20 w-20 md:h-24 md:w-24">
            {/* User doesn't have a photoURL in this app */}
            <AvatarFallback className="text-3xl font-headline bg-primary text-primary-foreground">
              {getInitials(profileUser?.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 flex justify-around text-center">
              <div>
                <div className="font-bold text-lg">{posts?.length ?? 0}</div>
                <p className="text-sm text-muted-foreground">Posts</p>
              </div>
              <div>
                 <div className="font-bold text-lg">{totalLikes}</div>
                 <p className="text-sm text-muted-foreground">Likes</p>
              </div>
              <div>
                <div className="font-bold text-lg">{totalComments}</div>
                <p className="text-sm text-muted-foreground">Comments</p>
              </div>
          </div>
        </div>


        {/* User Name and Bio */}
        <div className="mb-4">
            <h1 className="font-bold text-base">{profileUser.name}</h1>
            <p className="text-sm text-muted-foreground">{profileUser.email}</p>
        </div>


        <Tabs defaultValue="posts" className="w-full">
            <TabsList className="grid w-full grid-cols-1">
                <TabsTrigger value="posts" className="gap-2"><Grid3x3 className="h-5 w-5" /> Posts</TabsTrigger>
            </TabsList>
            <TabsContent value="posts">
                <PostGrid
                    posts={posts}
                    isLoading={postsLoading}
                    emptyState={
                        <div className="col-span-3 text-center py-16">
                            <h3 className="text-xl font-headline text-primary">No Posts Yet</h3>
                            <p className="text-muted-foreground">This user hasn't posted anything.</p>
                        </div>
                    }
                />
            </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
