
"use client";

import AppLayout from "@/components/AppLayout";
import { useFirebase, useMemoFirebase } from "@/firebase";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { collection, query, where, getDocs, getDoc, doc } from "firebase/firestore";
import { useCollection, type WithId } from "@/firebase/firestore/use-collection";
import { Settings } from "lucide-react";
import type { Post, Bookmark, User } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import React, { useMemo, useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getInitials } from "@/lib/utils";

import { PostItem as HomePostItem, PostSkeleton } from "@/app/home/page";
import { RepliesList } from "@/components/RepliesList";
import Link from "next/link";


function BookmarksList({ bookmarks, bookmarksLoading }: { bookmarks: WithId<Bookmark>[] | null, bookmarksLoading: boolean }) {
    const { firestore } = useFirebase();
    const [bookmarkedPosts, setBookmarkedPosts] = useState<WithId<Post>[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!firestore || bookmarksLoading) return;

        if (!bookmarks || bookmarks.length === 0) {
            setBookmarkedPosts([]);
            setIsLoading(false);
            return;
        }

        const fetchBookmarkedPosts = async () => {
            setIsLoading(true);
            const postIds = bookmarks.map(b => b.postId);
            const posts: WithId<Post>[] = [];

            // Firestore 'in' query is limited to 30 items. 
            // For simplicity, we fetch one by one. For a real app, batching would be better.
            for (const postId of postIds) {
                const postRef = doc(firestore, 'posts', postId);
                const postSnap = await getDoc(postRef);
                if (postSnap.exists()) {
                    posts.push({ id: postSnap.id, ...postSnap.data() } as WithId<Post>);
                }
            }

            // Sort by bookmark timestamp, not post timestamp
             posts.sort((a, b) => {
                const bookmarkA = bookmarks.find(bm => bm.postId === a.id);
                const bookmarkB = bookmarks.find(bm => bm.postId === b.id);
                const timeA = bookmarkA?.timestamp?.toMillis() || 0;
                const timeB = bookmarkB?.timestamp?.toMillis() || 0;
                return timeB - timeA;
            });

            setBookmarkedPosts(posts);
            setIsLoading(false);
        };

        fetchBookmarkedPosts();

    }, [firestore, bookmarks, bookmarksLoading]);

    if (isLoading) {
        return (
            <>
                <PostSkeleton />
                <PostSkeleton />
            </>
        );
    }

    if (bookmarkedPosts.length === 0) {
        return (
            <div className="text-center py-16">
                <h3 className="text-xl font-headline text-primary">No Bookmarks Yet</h3>
                <p className="text-muted-foreground">You haven't bookmarked any posts.</p>
            </div>
        )
    }

    return (
        <div className="divide-y border-b">
            {bookmarkedPosts.map(post => (
                <HomePostItem key={post.id} post={post} bookmarks={bookmarks} />
            ))}
        </div>
    )
}


export default function AccountPage() {
  const { user: authUser, userProfile } = useFirebase();
  const { firestore } = useFirebase();

  const [posts, setPosts] = useState<WithId<Post>[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !authUser) return;

    const fetchPosts = async () => {
        setPostsLoading(true);
        try {
            const postsQuery = query(
                collection(firestore, "posts"),
                where("authorId", "==", authUser.uid)
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
}, [firestore, authUser]);


  const bookmarksQuery = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return collection(firestore, 'users', authUser.uid, 'bookmarks');
  }, [firestore, authUser]);

  const { data: bookmarks, isLoading: bookmarksLoading } = useCollection<Bookmark>(bookmarksQuery);
  
  const karmaScore = useMemo(() => {
    if (!posts) return 0;
    // For now, karma is just total post likes. Can be extended later.
    return posts.reduce((acc, post) => acc + (post.likeCount || 0), 0);
  }, [posts]);


  const formatUserId = (uid: string | undefined) => {
    if (!uid) return "blur??????";
    return `blur${uid.substring(uid.length - 6)}`;
  };

  const isLoading = postsLoading || bookmarksLoading;


  return (
    <AppLayout showTopBar={false}>
      <div className="px-4">
        {/* Profile Header */}
        <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold font-headline">
              {formatUserId(authUser?.uid)}
            </h2>
            <div className="flex items-center space-x-2">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/account/settings">
                        <Settings className="h-6 w-6" />
                    </Link>
                </Button>
            </div>
        </div>

        <div className="flex items-center space-x-5 mb-6">
          <Avatar className="h-20 w-20 md:h-24 md:w-24">
            <AvatarImage
              src={authUser?.photoURL || undefined}
              alt={authUser?.displayName || "User"}
            />
            <AvatarFallback className="text-3xl font-headline bg-primary text-primary-foreground">
              {getInitials(authUser?.displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 flex justify-around text-center">
              <div>
                {isLoading ? (
                    <div className="font-bold text-lg"><Skeleton className="h-6 w-8 mx-auto" /></div>
                ) : (
                    <div className="font-bold text-lg">{posts?.length ?? 0}</div>
                )}
                <p className="text-sm text-muted-foreground">Posts</p>
              </div>
              <div>
                 {isLoading ? (
                    <div className="font-bold text-lg"><Skeleton className="h-6 w-8 mx-auto" /></div>
                ) : (
                    <div className="font-bold text-lg">{karmaScore}</div>
                )}
                <p className="text-sm text-muted-foreground">Karma</p>
              </div>
              <div>
                {isLoading ? (
                  <div className="font-bold text-lg"><Skeleton className="h-6 w-8 mx-auto" /></div>
                ) : (
                  <div className="font-bold text-lg">{userProfile?.upvotes || 0}</div>
                )}
                <p className="text-sm text-muted-foreground">Upvotes</p>
              </div>
          </div>
        </div>


        {/* User Name and Bio */}
        <div className="mb-4">
            <h1 className="font-bold text-base">{authUser?.displayName}</h1>
            <p className="text-sm text-muted-foreground">{authUser?.email}</p>
        </div>

        <div className="mb-4">
            <Button variant="secondary" size="sm" className="w-full">Edit Profile</Button>
        </div>


        <Tabs defaultValue="posts" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="posts">Posts</TabsTrigger>
                <TabsTrigger value="replies">Replies</TabsTrigger>
                <TabsTrigger value="bookmarks">Bookmarks</TabsTrigger>
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
                 {authUser?.uid && <RepliesList userId={authUser.uid} />}
            </TabsContent>
             <TabsContent value="bookmarks">
                 <BookmarksList bookmarks={bookmarks} bookmarksLoading={bookmarksLoading} />
            </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
