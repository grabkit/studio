
"use client";

import AppLayout from "@/components/AppLayout";
import { useUser, useFirebase, useMemoFirebase } from "@/firebase";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useCollection, type WithId } from "@/firebase/firestore/use-collection";
import { Settings, LogOut } from "lucide-react";
import { signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import type { Post, Bookmark } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import React, { useMemo, useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getInitials } from "@/lib/utils";

import { PostItem as HomePostItem, PostSkeleton } from "@/app/home/page";
import { RepliesList } from "@/components/RepliesList";


export default function AccountPage() {
  const { user } = useUser();
  const { auth, firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const [posts, setPosts] = useState<WithId<Post>[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !user) return;

    const fetchPosts = async () => {
        setPostsLoading(true);
        try {
            const postsQuery = query(
                collection(firestore, "posts"),
                where("authorId", "==", user.uid)
            );
            const querySnapshot = await getDocs(postsQuery);
            const userPosts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WithId<Post>));
            
            userPosts.sort((a, b) => {
                const timeA = a.timestamp?.toMillis() || 0;
                const timeB = b.timestamp?.toMillis() || 0;
                return timeB - timeA;
            });

            setPosts(userPosts);
        } catch (error) {
            console.error("Error fetching user posts:", error);
        } finally {
            setPostsLoading(false);
        }
    };

    fetchPosts();
}, [firestore, user]);


  const bookmarksQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, 'users', user.uid, 'bookmarks');
  }, [firestore, user]);

  const { data: bookmarks, isLoading: bookmarksLoading } = useCollection<Bookmark>(bookmarksQuery);

  const totalLikes = useMemo(() => {
    if (!posts) return 0;
    return posts.reduce((acc, post) => acc + (post.likeCount || 0), 0);
  }, [posts]);
  
  const totalComments = useMemo(() => {
    if (!posts) return 0;
    return posts.reduce((acc, post) => acc + (post.commentCount || 0), 0);
  }, [posts]);


  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/auth");
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Logout Failed",
        description: error.message,
      });
    }
  };

  const formatUserId = (uid: string | undefined) => {
    if (!uid) return "blur??????";
    return `blur${uid.substring(uid.length - 6)}`;
  };


  return (
    <AppLayout showTopBar={false}>
      <div className="px-4">
        {/* Profile Header */}
        <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold font-headline">
              {formatUserId(user?.uid)}
            </h2>
            <div className="flex items-center space-x-2">
                <Button variant="ghost" size="icon">
                    <Settings className="h-6 w-6" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleLogout}>
                    <LogOut className="h-6 w-6 text-destructive" />
                </Button>
            </div>
        </div>

        <div className="flex items-center space-x-5 mb-6">
          <Avatar className="h-20 w-20 md:h-24 md:w-24">
            <AvatarImage
              src={user?.photoURL || undefined}
              alt={user?.displayName || "User"}
            />
            <AvatarFallback className="text-3xl font-headline bg-primary text-primary-foreground">
              {getInitials(user?.displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 flex justify-around text-center">
              <div>
                {postsLoading ? (
                    <div className="font-bold text-lg"><Skeleton className="h-6 w-8 mx-auto" /></div>
                ) : (
                    <div className="font-bold text-lg">{posts?.length ?? 0}</div>
                )}
                <p className="text-sm text-muted-foreground">Posts</p>
              </div>
              <div>
                 {postsLoading ? (
                    <div className="font-bold text-lg"><Skeleton className="h-6 w-8 mx-auto" /></div>
                ) : (
                    <div className="font-bold text-lg">{totalLikes}</div>
                )}
                <p className="text-sm text-muted-foreground">Likes</p>              </div>
              <div>
                {postsLoading ? (
                  <div className="font-bold text-lg"><Skeleton className="h-6 w-8 mx-auto" /></div>
                ) : (
                  <div className="font-bold text-lg">{totalComments}</div>
                )}
                <p className="text-sm text-muted-foreground">Comments</p>
              </div>
          </div>
        </div>


        {/* User Name and Bio */}
        <div className="mb-4">
            <h1 className="font-bold text-base">{user?.displayName}</h1>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>

        <div className="mb-4">
            <Button variant="secondary" size="sm" className="w-full">Edit Profile</Button>
        </div>


        <Tabs defaultValue="posts" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="posts">Posts</TabsTrigger>
                <TabsTrigger value="replies">Replies</TabsTrigger>
            </TabsList>
            <TabsContent value="posts">
                <div className="divide-y border-b">
                    {(postsLoading || bookmarksLoading) && (
                        <>
                            <PostSkeleton />
                            <PostSkeleton />
                        </>
                    )}
                    {!(postsLoading || bookmarksLoading) && posts?.length === 0 && (
                         <div className="col-span-3 text-center py-16">
                            <h3 className="text-xl font-headline text-primary">No Posts Yet</h3>
                            <p className="text-muted-foreground">Start sharing your thoughts!</p>
                        </div>
                    )}
                    {posts?.map((post) => (
                        <HomePostItem key={post.id} post={post} bookmarks={bookmarks} />
                    ))}
                </div>
            </TabsContent>
             <TabsContent value="replies">
                 {user?.uid && <RepliesList userId={user.uid} />}
            </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
