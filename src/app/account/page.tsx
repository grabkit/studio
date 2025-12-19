"use client";

import AppLayout from "@/components/AppLayout";
import { useUser, useFirebase, useMemoFirebase } from "@/firebase";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { collection, query, where, getDocs, doc } from "firebase/firestore";
import { useCollection } from "@/firebase/firestore/use-collection";
import { useDoc } from "@/firebase/firestore/use-doc";
import { Settings, LogOut, Grid3x3, FileText, Bookmark as BookmarkIcon } from "lucide-react";
import { signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import type { Post, Bookmark } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import React, { useState, useMemo, useEffect } from "react";
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

const BookmarkedPostsGrid = () => {
    const { user, firestore } = useFirebase();
    const [bookmarkedPosts, setBookmarkedPosts] = useState<Post[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const bookmarksCollectionRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return collection(firestore, "users", user.uid, "bookmarks");
    }, [firestore, user]);

    const { data: bookmarks } = useCollection<Bookmark>(bookmarksCollectionRef);

    useEffect(() => {
        if (!firestore || !bookmarks) {
            setIsLoading(bookmarks === null);
            return;
        }

        const fetchPosts = async () => {
            setIsLoading(true);
            if (bookmarks.length === 0) {
                setBookmarkedPosts([]);
                setIsLoading(false);
                return;
            }
            
            const postIds = bookmarks.map(b => b.itemId);
            const posts: Post[] = [];
            
            // Firestore 'in' query is limited to 30 items, so we fetch in batches if needed.
            for (let i = 0; i < postIds.length; i += 30) {
                const batchIds = postIds.slice(i, i + 30);
                const postsQuery = query(collection(firestore, "posts"), where("id", "in", batchIds));
                const querySnapshot = await getDocs(postsQuery);
                querySnapshot.forEach((doc) => {
                    posts.push({ id: doc.id, ...doc.data() } as Post);
                });
            }

            setBookmarkedPosts(posts);
            setIsLoading(false);
        };

        fetchPosts();

    }, [bookmarks, firestore]);

    return (
        <PostGrid 
            posts={bookmarkedPosts} 
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
                <TabsTrigger value="bookmarks" className="gap-2"><BookmarkIcon className="h-5 w-5" /> Bookmarks</TabsTrigger>
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
            <TabsContent value="bookmarks">
                <BookmarkedPostsGrid />
            </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
