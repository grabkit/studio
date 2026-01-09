
"use client";

import AppLayout from "@/components/AppLayout";
import { useFirebase, useMemoFirebase } from "@/firebase";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { collection, query, where, getDocs, getDoc, doc, updateDoc, arrayUnion, arrayRemove, increment, setDoc, serverTimestamp, deleteField, runTransaction, deleteDoc } from "firebase/firestore";
import { useCollection, type WithId } from "@/firebase/firestore/use-collection";
import { Menu, Share2, Link as LinkIcon, Plus, BarChart3, Trash2, RefreshCw, Settings } from "lucide-react";
import type { Post, Bookmark, User, Notification } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import React, { useMemo, useState, useEffect, useCallback, useRef, type TouchEvent } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getAvatar, cn, formatUserId } from "@/lib/utils";

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
    const { firestore, user } = useFirebase();
    const { toast } = useToast();
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

    const handleLikeInBookmark = (postId: string, updatedData: Partial<Post>) => {
        setBookmarkedPosts(currentPosts => 
            currentPosts.map(p => p.id === postId ? { ...p, ...updatedData } : p)
        );
    }

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
                <HomePostItem 
                    key={post.id} 
                    post={post} 
                    bookmarks={bookmarks} 
                    updatePost={handleLikeInBookmark}
                    onDelete={() => setBookmarkedPosts(posts => posts.filter(p => p.id !== post.id))}
                />
            ))}
        </div>
    )
}


export default function AccountPage() {
  const { user: authUser, userProfile, firestore, showVoiceStatusPlayer, setUserProfile } = useFirebase();
  const { toast } = useToast();
  const [posts, setPosts] = useState<WithId<Post>[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullPosition, setPullPosition] = useState(0);
  const touchStartRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePostState = useCallback((postId: string, updatedData: Partial<Post>) => {
    setPosts(currentPosts => {
        if (!currentPosts) return [];
        return currentPosts.map(p =>
            p.id === postId ? { ...p, ...updatedData } : p
        );
    });
    }, []);

    const fetchPosts = useCallback(async () => {
        if (!firestore || !authUser) return;
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
    }, [firestore, authUser]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

    const fetchProfile = useCallback(async () => {
        if (!firestore || !authUser) return;
        const userDocRef = doc(firestore, "users", authUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            setUserProfile({ id: userDoc.id, ...userDoc.data() } as WithId<User>);
        }
    }, [firestore, authUser, setUserProfile]);

    const handleRefresh = async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        window.navigator.vibrate?.(50);
        await Promise.all([fetchPosts(), fetchProfile()]); // Fetch both posts and profile
        setTimeout(() => {
            setIsRefreshing(false);
            setPullPosition(0);
            window.navigator.vibrate?.(50);
        }, 500);
    };

    const handleTouchStart = (e: TouchEvent) => {
        touchStartRef.current = e.targetTouches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
        const touchY = e.targetTouches[0].clientY;
        const pullDistance = touchY - touchStartRef.current;
        if (window.scrollY === 0 && pullDistance > 0 && !isRefreshing) {
            e.preventDefault();
            const newPullPosition = Math.min(pullDistance, 120);
            if (pullPosition <= 70 && newPullPosition > 70) {
                window.navigator.vibrate?.(50);
            }
            setPullPosition(newPullPosition);
        }
    };

    const handleTouchEnd = () => {
        if (pullPosition > 70) {
            handleRefresh();
        } else {
            setPullPosition(0);
        }
    };

  const handleDeletePost = useCallback((postId: string) => {
    setPosts(currentPosts => currentPosts.filter(p => p.id !== postId));
  }, []);

  const handlePinPost = useCallback((postId: string, currentStatus: boolean) => {
    if (!firestore) return;

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


    const postRef = doc(firestore, 'posts', postId);
    updateDoc(postRef, { isPinned: !currentStatus })
      .then(() => {
        toast({ title: currentStatus ? "Post unpinned" : "Post pinned" });
      })
      .catch(serverError => {
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
  
  const avatar = useMemo(() => getAvatar(userProfile), [userProfile]);
  const isAvatarUrl = avatar.startsWith('http');


  return (
    <AppLayout showTopBar={false}>
       <div
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
         <div 
          className="absolute top-0 left-0 right-0 flex justify-center items-center h-12 text-muted-foreground transition-opacity duration-300 z-10 pointer-events-none"
          style={{ opacity: isRefreshing ? 1 : pullPosition / 70 }}
        >
          <div style={{ transform: `rotate(${isRefreshing ? 0 : pullPosition * 3}deg)` }}>
            <RefreshCw className={cn('h-5 w-5', isRefreshing && 'animate-spin')} />
          </div>
        </div>

        <div style={{ transform: `translateY(${pullPosition}px)` }} className="transition-transform duration-300 bg-background">
            <div className="flex items-center justify-between h-14 px-4 bg-background">
                <Link href="/post" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
                    <Plus className="h-6 w-6" />
                </Link>
                <h2 className="text-lg font-bold font-headline">
                    {formatUserId(authUser?.uid)}
                </h2>
                <div className="flex items-center space-x-2">
                    <Link href="/account/settings" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}>
                    <Menu className="h-6 w-6" />
                    </Link>
                </div>
            </div>
            <div className="px-4 pt-4">
                <div className="flex items-center justify-between space-x-5 mb-4">
                    <div className="flex-shrink-0">
                        <div className="relative inline-block">
                            <Avatar className="h-20 w-20 md:h-24 md:w-24">
                                <AvatarImage
                                    src={isAvatarUrl ? avatar : undefined}
                                    alt={userProfile?.name || "User"}
                                />
                                <AvatarFallback className="text-3xl font-headline bg-secondary">
                                    {!isAvatarUrl ? avatar : ''}
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
                    </div>
                    <div className="flex-1 flex justify-around text-center">
                        <div>
                            {isLoading ? (
                                <div className="font-bold text-lg"><Skeleton className="h-6 w-8 mx-auto" /></div>
                            ) : (
                                <div className="font-bold text-lg">{posts?.length ?? 0}</div>
                            )}
                            <p className="text-sm text-muted-foreground">Posts</p>
                        </div>
                        <Link href={`/profile/${authUser?.uid}/social?tab=followers`} className="cursor-pointer hover:bg-secondary/50 rounded-md p-1 -m-1">
                            {isLoading ? (
                                <div className="font-bold text-lg"><Skeleton className="h-6 w-8 mx-auto" /></div>
                            ) : (
                                <div className="font-bold text-lg">{userProfile?.followersCount || 0}</div>
                            )}
                            <p className="text-sm text-muted-foreground">Followers</p>
                        </Link>
                        <Link href={`/profile/${authUser?.uid}/social?tab=following`} className="cursor-pointer hover:bg-secondary/50 rounded-md p-1 -m-1">
                            {isLoading ? (
                                <div className="font-bold text-lg"><Skeleton className="h-6 w-8 mx-auto" /></div>
                            ) : (
                                <div className="font-bold text-lg">{userProfile?.followingCount || 0}</div>
                            )}
                            <p className="text-sm text-muted-foreground">Following</p>
                        </Link>
                    </div>
                </div>
                
                <div className="mb-4 space-y-1">
                    <p className="font-semibold font-headline">{formatUserId(authUser?.uid)}</p>
                    {userProfile?.bio && <p className="text-sm">{userProfile.bio}</p>}
                    {userProfile?.website && (
                        <a href={userProfile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-500 hover:underline">
                            <LinkIcon className="h-4 w-4" />
                            <span>{userProfile.website.replace(/^(https?:\/\/)?(www\.)?/, '')}</span>
                        </a>
                    )}
                </div>


                <div className="mb-4 flex items-center space-x-2">
                    <Button variant="secondary" size="sm" className="flex-1 font-bold rounded-[5px]" asChild>
                    <Link href="/account/settings/edit-profile">Edit Profile</Link>
                    </Button>
                    <Button variant="secondary" size="sm" className="flex-1 font-bold rounded-[5px]" onClick={handleShareProfile}>
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
                                <HomePostItem 
                                key={post.id} 
                                post={post} 
                                bookmarks={bookmarks} 
                                updatePost={updatePostState}
                                onDelete={handleDeletePost} 
                                onPin={handlePinPost} 
                                showPinStatus={true}
                                authorProfile={userProfile}
                                />
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
            </div>
        </div>
    </AppLayout>
  )
}

    


    
