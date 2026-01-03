
"use client";

import AppLayout from "@/components/AppLayout";
import { useFirebase, useMemoFirebase } from "@/firebase";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { collection, query, where, getDocs, getDoc, doc, updateDoc, arrayUnion, arrayRemove, increment, setDoc, serverTimestamp, deleteField } from "firebase/firestore";
import { useCollection, type WithId } from "@/firebase/firestore/use-collection";
import { Menu, Share2, Link as LinkIcon, Plus, BarChart3, Trash2 } from "lucide-react";
import type { Post, Bookmark, User, Notification } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import React, { useMemo, useState, useEffect, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getInitials, cn } from "@/lib/utils";

import { PostItem as HomePostItem, PostSkeleton } from "@/app/home/page";
import { RepliesList } from "@/components/RepliesList";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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

    const updatePostState = (postId: string, updatedData: Partial<Post>) => {
        setBookmarkedPosts(currentPosts => {
            if (!currentPosts) return [];
            return currentPosts.map(p =>
                p.id === postId ? { ...p, ...updatedData } : p
            );
        });
    };

    return (
        <div className="divide-y border-b">
            {bookmarkedPosts.map(post => (
                <HomePostItem key={post.id} post={post} bookmarks={bookmarks} updatePost={updatePostState} />
            ))}
        </div>
    )
}


export default function AccountPage() {
  const { user: authUser, userProfile, firestore, showVoiceStatusPlayer } = useFirebase();
  const { toast } = useToast();
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
            let userPosts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WithId<Post>));
            
            // Sort by pinned status first, then by timestamp
            userPosts.sort((a, b) => {
                if (a.isPinned && !b.isPinned) return -1;
                if (!a.isPinned && b.isPinned) return 1;
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

  const updatePostState = useCallback((postId: string, updatedData: Partial<Post>) => {
        setPosts(currentPosts => {
            if (!currentPosts) return [];
            const newPosts = currentPosts.map(p =>
                p.id === postId ? { ...p, ...updatedData } : p
            );
            return newPosts;
        });

        // Also update firestore in the background
        if (firestore) {
            const postRef = doc(firestore, 'posts', postId);
            const currentPost = posts.find(p => p.id === postId);
            if (!currentPost || !authUser) return;

            const hasLiked = updatedData.likes?.includes(authUser.uid);

            const payload = {
                likes: hasLiked ? arrayUnion(authUser.uid) : arrayRemove(authUser.uid),
                likeCount: increment(hasLiked ? 1 : -1)
            };

            updateDoc(postRef, payload).catch(serverError => {
                 // Revert optimistic update on error
                setPosts(currentPosts);
                const permissionError = new FirestorePermissionError({
                    path: postRef.path,
                    operation: 'update',
                    requestResourceData: payload,
                });
                errorEmitter.emit('permission-error', permissionError);
            });
        }
    }, [firestore, authUser, posts]);

  const handleDeletePost = useCallback((postId: string) => {
    setPosts(currentPosts => currentPosts.filter(p => p.id !== postId));
  }, []);

  const handlePinPost = useCallback((postId: string, currentStatus: boolean) => {
    if (!firestore) return;

    // Optimistic update
    setPosts(currentPosts => {
        const newPosts = currentPosts.map(p =>
            p.id === postId ? { ...p, isPinned: !currentStatus } : p
        );
        newPosts.sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            const timeA = a.timestamp?.toMillis() || 0;
            const timeB = b.timestamp?.toMillis() || 0;
            return timeB - timeA;
        });
        return newPosts;
    });


    // Server update
    const postRef = doc(firestore, 'posts', postId);
    updateDoc(postRef, { isPinned: !currentStatus })
      .then(() => {
        toast({ title: currentStatus ? "Post unpinned" : "Post pinned" });
      })
      .catch(serverError => {
        // Revert optimistic update on error
        setPosts(currentPosts => {
            const revertedPosts = currentPosts.map(p =>
                p.id === postId ? { ...p, isPinned: currentStatus } : p
            );
             revertedPosts.sort((a, b) => {
                if (a.isPinned && !b.isPinned) return -1;
                if (!a.isPinned && b.isPinned) return 1;
                const timeA = a.timestamp?.toMillis() || 0;
                const timeB = b.timestamp?.toMillis() || 0;
                return timeB - timeA;
            });
            return revertedPosts;
        });
        const permissionError = new FirestorePermissionError({
            path: postRef.path,
            operation: 'update',
            requestResourceData: { isPinned: !currentStatus },
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: 'destructive', title: "Error", description: "Could not update pin status."});
      });
  }, [firestore, toast]);



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
  
  const handleShareProfile = async () => {
    const shareData = {
      title: `Check out ${formatUserId(authUser?.uid)} on Blur`,
      text: `View ${formatUserId(authUser?.uid)}'s profile on Blur.`,
      url: window.location.origin + `/profile/${authUser?.uid}`,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shareData.url);
        toast({
          title: "Profile Link Copied",
          description: "Link to your profile has been copied to your clipboard.",
        });
      }
    } catch (error: any) {
      if (error.name === 'AbortError') return; // User cancelled the share action
      console.error("Error sharing profile:", error);
      toast({
        variant: "destructive",
        title: "Could not share",
        description: "There was an error trying to share your profile.",
      });
    }
  };


  const isLoading = postsLoading || bookmarksLoading;
  
  const hasVoiceStatus = useMemo(() => {
    if (!userProfile?.voiceStatusUrl || !userProfile?.voiceStatusTimestamp) return false;
    // Check if the status is within the last 24 hours
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    return userProfile.voiceStatusTimestamp.toMillis() > twentyFourHoursAgo;
  }, [userProfile]);

  const handleAvatarClick = () => {
      if (hasVoiceStatus && userProfile && showVoiceStatusPlayer) {
          showVoiceStatusPlayer(userProfile);
      }
  };


  return (
    <AppLayout showTopBar={false}>
      <div className="flex items-center justify-between h-14 px-4">
        <Button variant="ghost" size="icon" asChild>
            <Link href="/post">
                <Plus className="h-6 w-6" />
            </Link>
        </Button>
        <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" asChild>
                <Link href="/account/settings">
                    <Menu className="h-6 w-6" />
                </Link>
            </Button>
        </div>
      </div>
      <div className="px-4">
        <div className="flex items-start space-x-5 mb-2">
            <div className="flex-shrink-0 text-center">
                <div className="relative inline-block">
                    <Avatar className="h-20 w-20 md:h-24 md:w-24 mx-auto">
                        <AvatarImage
                            src={authUser?.photoURL || undefined}
                            alt={userProfile?.name || "User"}
                        />
                        <AvatarFallback className="text-3xl font-headline bg-secondary">
                            {getInitials(userProfile?.name)}
                        </AvatarFallback>
                    </Avatar>
                    {hasVoiceStatus && (
                        <div className="absolute bottom-0 right-0 bg-background p-1 rounded-full border-2 cursor-pointer" onClick={handleAvatarClick} role="button">
                            <div className="flex items-center justify-center h-4 w-4 gap-0.5">
                                <div className="audio-wave-bar-avatar" />
                                <div className="audio-wave-bar-avatar" />
                                <div className="audio-wave-bar-avatar" />
                                <div className="audio-wave-bar-avatar" />
                                <div className="audio-wave-bar-avatar" />
                            </div>
                        </div>
                    )}
                </div>

                <p className="font-semibold font-headline mt-2">{formatUserId(authUser?.uid)}</p>
            </div>
            <div className="flex-1 flex justify-around text-center pt-6">
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
        <div className="mb-4 space-y-2">
            {userProfile?.bio && <p className="text-sm">{userProfile.bio}</p>}
            {userProfile?.website && (
                <a href={userProfile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-500 hover:underline">
                    <LinkIcon className="h-4 w-4" />
                    <span>{userProfile.website.replace(/^(https?:\/\/)?(www\.)?/, '')}</span>
                </a>
            )}
        </div>


        <div className="mb-4 flex items-center space-x-2">
            <Button variant="secondary" size="sm" className="flex-1 font-bold" asChild>
              <Link href="/account/settings/edit-profile">Edit Profile</Link>
            </Button>
            <Button variant="secondary" size="sm" className="flex-1 font-bold" onClick={handleShareProfile}>
                Share Profile
            </Button>
        </div>

      </div>

        <Tabs defaultValue="posts" className="w-full">
            <div className="sticky top-0 bg-background z-10">
              <TabsList variant="underline" className="grid w-full grid-cols-3">
                  <TabsTrigger value="posts" variant="underline" className="font-semibold">Posts</TabsTrigger>
                  <TabsTrigger value="replies" variant="underline" className="font-semibold">Replies</TabsTrigger>
                  <TabsTrigger value="bookmarks" variant="underline" className="font-semibold">Bookmarks</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="posts" className="mt-0">
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
                        <HomePostItem key={post.id} post={post} bookmarks={bookmarks} updatePost={updatePostState} onDelete={handleDeletePost} onPin={handlePinPost} />
                    ))}
                </div>
            </TabsContent>
             <TabsContent value="replies" className="mt-0">
                 {authUser?.uid && <RepliesList userId={authUser.uid} />}
            </TabsContent>
             <TabsContent value="bookmarks" className="mt-0">
                 <BookmarksList bookmarks={bookmarks} bookmarksLoading={bookmarksLoading} />
            </TabsContent>
        </Tabs>

    </AppLayout>
  );
}

    