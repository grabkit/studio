"use client";

import AppLayout from "@/components/AppLayout";
import { useUser, useFirebase, useMemoFirebase } from "@/firebase";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import { useCollection } from "@/firebase/firestore/use-collection";
import { Settings, LogOut, Grid3x3, FileText, Bookmark as BookmarkIcon } from "lucide-react";
import { signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import type { Post, UserPost, Bookmark } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import React, { useMemo, useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getInitials } from "@/lib/utils";


const PostGrid = ({ posts, isLoading, emptyState }: { posts: (Post | UserPost)[] | null, isLoading: boolean, emptyState: React.ReactNode }) => {
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

function BookmarkedPosts() {
    const { user, firestore } = useFirebase();
    const [posts, setPosts] = useState<UserPost[] | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const bookmarksQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, "users", user.uid, "bookmarks"),
            orderBy("timestamp", "desc")
        );
    }, [firestore, user]);

    const { data: bookmarks } = useCollection<Bookmark>(bookmarksQuery);

    useEffect(() => {
        if (!bookmarks || !firestore) {
            setIsLoading(bookmarks === null); // Still loading if bookmarks haven't been fetched
            return;
        };

        const fetchPosts = async () => {
            if (bookmarks.length === 0) {
                setPosts([]);
                setIsLoading(false);
                return;
            }
            const postIds = bookmarks.map(b => b.postId);
            const postsQuery = query(collection(firestore, 'posts'), where('id', 'in', postIds));
            
            try {
                const postSnapshots = await getDocs(postsQuery);
                const fetchedPosts = postSnapshots.docs.map(doc => ({ ...doc.data(), id: doc.id } as UserPost));
                
                // Order posts according to bookmark timestamp
                const orderedPosts = bookmarks.map(bookmark => fetchedPosts.find(p => p.id === bookmark.postId)).filter(p => p) as UserPost[];

                setPosts(orderedPosts);
            } catch (error) {
                console.error("Error fetching bookmarked posts:", error);
                setPosts([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPosts();
    }, [bookmarks, firestore]);

    return (
        <PostGrid
            posts={posts}
            isLoading={isLoading}
            emptyState={
                <div className="col-span-3 text-center py-16">
                    <h3 className="text-xl font-headline text-primary">No Bookmarks Yet</h3>
                    <p className="text-muted-foreground">Save posts to see them here.</p>
                </div>
            }
        />
    )
}


export default function AccountPage() {
  const { user } = useUser();
  const { auth, firestore } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const userPostsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
      collection(firestore, "posts"),
      where("authorId", "==", user.uid)
    );
  }, [firestore, user]);

  const { data: posts, isLoading: postsLoading } = useCollection<Post>(userPostsQuery);

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
                <TabsTrigger value="posts" className="gap-2"><Grid3x3 className="h-5 w-5" /> Posts</TabsTrigger>
                <TabsTrigger value="bookmarked" className="gap-2"><BookmarkIcon className="h-5 w-5" /> Bookmarked</TabsTrigger>
            </TabsList>
            <TabsContent value="posts">
                <PostGrid
                    posts={posts}
                    isLoading={postsLoading}
                    emptyState={
                        <div className="col-span-3 text-center py-16">
                            <h3 className="text-xl font-headline text-primary">No Posts Yet</h3>
                            <p className="text-muted-foreground">Start sharing your thoughts!</p>
                        </div>
                    }
                />
            </TabsContent>
            <TabsContent value="bookmarked">
                <BookmarkedPosts />
            </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
