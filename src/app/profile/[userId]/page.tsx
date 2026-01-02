

"use client";

import { useParams, useRouter } from "next/navigation";
import { useFirebase, useMemoFirebase, useCollection, type WithId, useDoc } from "@/firebase";
import { doc, collection, query, where, getDocs, serverTimestamp, setDoc, getDoc, updateDoc, increment, arrayUnion, arrayRemove, deleteField } from "firebase/firestore";
import type { Post, User } from "@/lib/types";
import React, { useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

import AppLayout from "@/components/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, MessageSquare, ArrowUpRight, ArrowUp, MoreHorizontal, ShieldAlert, Flag, VolumeX, Info, MinusCircle, Link as LinkIcon, QrCode, Calendar, Badge, User as UserIcon, Volume2, BarChart3 } from "lucide-react";
import { getInitials, cn, formatLastSeen } from "@/lib/utils";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";
import { PostItem as HomePostItem, PostSkeleton } from "@/app/home/page";
import type { Bookmark } from "@/lib/types";
import { RepliesList } from "@/components/RepliesList";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import { ReportDialog } from "@/components/ReportDialog";
import { QrCodeDialog } from "@/components/QrCodeDialog";


function AboutProfileSheet({ user, isOpen, onOpenChange }: { user: WithId<User>, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
    const formatUserId = (uid: string | undefined) => {
        if (!uid) return "blur??????";
        return `blur${uid.substring(uid.length - 6)}`;
    };

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="rounded-t-lg">
                <SheetHeader className="text-left mb-4">
                    <SheetTitle>About this account</SheetTitle>
                </SheetHeader>
                <div className="space-y-4">
                    <div className="flex items-center">
                        <UserIcon className="h-5 w-5 mr-3 text-muted-foreground" />
                        <div>
                            <p className="text-sm text-muted-foreground">User ID</p>
                            <p className="font-mono text-sm">{formatUserId(user.id)}</p>
                        </div>
                    </div>
                    {user.createdAt && (
                        <div className="flex items-center">
                            <Calendar className="h-5 w-5 mr-3 text-muted-foreground" />
                            <div>
                                <p className="text-sm text-muted-foreground">Joined</p>
                                <p className="font-semibold">{format(user.createdAt.toDate(), "MMMM yyyy")}</p>
                            </div>
                        </div>
                    )}
                    <div className="flex items-center">
                        <Badge className="h-5 w-5 mr-3 text-muted-foreground" />
                        <div>
                            <p className="text-sm text-muted-foreground">Account Status</p>
                            <p className="font-semibold capitalize">{user.status || 'Active'}</p>
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}


export default function UserProfilePage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const userId = params.userId as string;
    const { firestore, user: currentUser, userProfile: currentUserProfile, showVoiceStatusPlayer, setUserProfile: setCurrentUserProfile, setActiveUserProfile, userProfile } = useFirebase();
    const user = userProfile;

    const [posts, setPosts] = useState<WithId<Post>[]>([]);
    const [postsLoading, setPostsLoading] = useState(true);
    const [isMoreOptionsSheetOpen, setIsMoreOptionsSheetOpen] = useState(false);
    const [isAboutSheetOpen, setIsAboutSheetOpen] = useState(false);
    const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);

    const userRef = useMemoFirebase(() => {
        if (!firestore || !userId) return null;
        return doc(firestore, "users", userId);
    }, [firestore, userId]);
    
    const { data: fetchedUser, isLoading: userLoading, setData: setFetchedUser } = useDoc<User>(userRef);

    useEffect(() => {
        if(fetchedUser) {
            setActiveUserProfile(fetchedUser);
        }
        return () => {
            setActiveUserProfile(null);
        }
    }, [fetchedUser, setActiveUserProfile]);

    useEffect(() => {
        if (currentUser && userId === currentUser.uid) {
            router.replace('/account');
        }
    }, [currentUser, userId, router]);
    
    useEffect(() => {
      if (!firestore || !userId) return;
  
      const fetchPosts = async () => {
          setPostsLoading(true);
          try {
              const postsQuery = query(
                  collection(firestore, "posts"),
                  where("authorId", "==", userId)
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
    }, [firestore, userId]);

     const updatePostState = useCallback((postId: string, updatedData: Partial<Post>) => {
        setPosts(currentPosts => {
            if (!currentPosts) return [];
            return currentPosts.map(p =>
                p.id === postId ? { ...p, ...updatedData } : p
            );
        });
        
        // Also update firestore in the background
        if (firestore && currentUser) {
            const postRef = doc(firestore, 'posts', postId);
            const currentPost = posts.find(p => p.id === postId);
            if (!currentPost) return;

            const hasLiked = updatedData.likes?.includes(currentUser.uid);

            const payload = {
                likes: hasLiked ? arrayUnion(currentUser.uid) : arrayRemove(currentUser.uid),
                likeCount: increment(hasLiked ? 1 : -1)
            };

            updateDoc(postRef, payload).catch(serverError => {
                 // Revert optimistic update on error
                setPosts(posts);
                const permissionError = new FirestorePermissionError({
                    path: postRef.path,
                    operation: 'update',
                    requestResourceData: payload,
                });
                errorEmitter.emit('permission-error', permissionError);
            });
        }
    }, [firestore, currentUser, posts]);

    const bookmarksQuery = useMemoFirebase(() => {
        if (!firestore || !currentUser) return null;
        return collection(firestore, 'users', currentUser.uid, 'bookmarks');
    }, [firestore, currentUser]);

    const { data: bookmarks, isLoading: bookmarksLoading } = useCollection<Bookmark>(bookmarksQuery);


    const karmaScore = useMemo(() => {
        if (!posts) return 0;
        return posts.reduce((acc, post) => acc + (post.likeCount || 0), 0);
    }, [posts]);

    const formatUserId = (uid: string | undefined) => {
        if (!uid) return "blur??????";
        return `blur${uid.substring(uid.length - 6)}`;
    };
    
    const isBlocked = useMemo(() => {
        return currentUserProfile?.blockedUsers?.includes(userId) ?? false;
    }, [currentUserProfile, userId]);

    const isMuted = useMemo(() => {
        return currentUserProfile?.mutedUsers?.includes(userId) ?? false;
    }, [currentUserProfile, userId]);

    const isRestricted = useMemo(() => {
        return currentUserProfile?.restrictedUsers?.includes(userId) ?? false;
    }, [currentUserProfile, userId]);

    const handleBlockUser = async () => {
        if (!currentUser || !firestore || !currentUserProfile) {
             toast({ variant: "destructive", title: "You must be logged in to block a user." });
            return;
        }

        const currentUserDocRef = doc(firestore, "users", currentUser.uid);
        const newBlockedUsers = isBlocked 
            ? currentUserProfile?.blockedUsers?.filter(id => id !== userId)
            : [...(currentUserProfile?.blockedUsers || []), userId];

        try {
            await updateDoc(currentUserDocRef, { blockedUsers: newBlockedUsers });
             // Optimistic update of the local state
            setCurrentUserProfile(current => current ? { ...current, blockedUsers: newBlockedUsers } : null);
            toast({ title: isBlocked ? "User Unblocked" : "User Blocked" });
        } catch (error) {
            console.error("Error blocking/unblocking user:", error);
            const permissionError = new FirestorePermissionError({
                path: currentUserDocRef.path,
                operation: 'update',
                requestResourceData: { blockedUsers: `[... ${userId}]` },
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: "destructive", title: "Error", description: "Could not complete the action." });
        } finally {
            setIsMoreOptionsSheetOpen(false);
        }
    };

    const handleMuteUser = async () => {
        if (!currentUser || !firestore || !currentUserProfile) {
            toast({ variant: "destructive", title: "You must be logged in to mute a user." });
            return;
        }

        const currentUserDocRef = doc(firestore, "users", currentUser.uid);
        const newMutedUsers = isMuted
            ? currentUserProfile?.mutedUsers?.filter(id => id !== userId)
            : [...(currentUserProfile?.mutedUsers || []), userId];

        try {
            await updateDoc(currentUserDocRef, { mutedUsers: newMutedUsers });
            setCurrentUserProfile(current => current ? { ...current, mutedUsers: newMutedUsers } : null);
            toast({ title: isMuted ? "User Unmuted" : "User Muted" });
        } catch (error) {
            console.error("Error muting/unmuting user:", error);
            const permissionError = new FirestorePermissionError({
                path: currentUserDocRef.path,
                operation: 'update',
                requestResourceData: { mutedUsers: newMutedUsers },
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: "destructive", title: "Error", description: "Could not mute user." });
        } finally {
            setIsMoreOptionsSheetOpen(false);
        }
    };
    
    const handleRestrictUser = async () => {
        if (!currentUser || !firestore || !currentUserProfile) {
            toast({ variant: "destructive", title: "You must be logged in to restrict a user." });
            return;
        }

        const currentUserDocRef = doc(firestore, "users", currentUser.uid);
        const newRestrictedUsers = isRestricted
            ? currentUserProfile?.restrictedUsers?.filter(id => id !== userId)
            : [...(currentUserProfile?.restrictedUsers || []), userId];

        try {
            await updateDoc(currentUserDocRef, { restrictedUsers: newRestrictedUsers });
             setCurrentUserProfile(current => current ? { ...current, restrictedUsers: newRestrictedUsers } : null);
            toast({ title: isRestricted ? "User Unrestricted" : "User Restricted" });
        } catch (error) {
            console.error("Error restricting user:", error);
            const permissionError = new FirestorePermissionError({
                path: currentUserDocRef.path,
                operation: 'update',
                requestResourceData: { restrictedUsers: newRestrictedUsers },
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: "destructive", title: "Error", description: "Could not restrict user." });
        } finally {
            setIsMoreOptionsSheetOpen(false);
        }
    }


    const handleStartConversation = async () => {
        if (!currentUser || !firestore || !userId || currentUser.uid === userId) return;

        const currentUserId = currentUser.uid;
        const conversationId = [currentUserId, userId].sort().join('_');
        const conversationRef = doc(firestore, 'conversations', conversationId);

        try {
            const docSnap = await getDoc(conversationRef);

            if (!docSnap.exists()) {
                const newConversationData = {
                    id: conversationId,
                    participantIds: [currentUserId, userId].sort(),
                    lastMessage: '',
                    lastUpdated: serverTimestamp(),
                    status: 'pending',
                    requesterId: currentUserId,
                    unreadCounts: { [currentUserId]: 0, [userId]: 0 },
                    lastReadTimestamps: { [currentUserId]: serverTimestamp() }
                };
                await setDoc(conversationRef, newConversationData);
            }
            
            router.push(`/messages/${userId}`);

        } catch (error: any) {
            console.error("Error handling conversation:", error);
            const permissionError = new FirestorePermissionError({
                path: conversationRef.path,
                operation: 'create', 
                requestResourceData: { info: "Failed to start conversation." }
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Could not start the conversation.",
            });
        }
    };
    
    const handleShare = async () => {
        if (!user) return;
        const shareData = {
            title: `Check out ${formatUserId(user.id)} on Blur`,
            text: `View ${formatUserId(user.id)}'s profile on Blur.`,
            url: window.location.href,
        };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                 handleCopyLink();
            }
        } catch (error: any) {
             if (error.name === 'AbortError') return;
            
            console.error("Error sharing profile:", error);
            toast({
                variant: "destructive",
                title: "Could not share",
                description: "There was an error trying to share this profile.",
            });
        } finally {
            setIsMoreOptionsSheetOpen(false);
        }
    };

    const handleCopyLink = () => {
         navigator.clipboard.writeText(window.location.href);
         toast({
            title: "Profile Link Copied",
            description: "Link to this profile has been copied to your clipboard.",
        });
        setIsMoreOptionsSheetOpen(false);
    }
    
    const handleOpenQrCode = () => {
        setIsMoreOptionsSheetOpen(false);
        setIsQrDialogOpen(true);
    }

    const handleOpenAbout = () => {
        setIsMoreOptionsSheetOpen(false);
        setIsAboutSheetOpen(true);
    }
    
    const hasUpvotedUser = useMemo(() => {
        if (!user || !currentUser) return false;
        return user.upvotedBy?.includes(currentUser.uid) || false;
    }, [user, currentUser]);

    const handleUpvoteUser = () => {
        if (!currentUser || !user || !userRef) return;

        const payload = {
            upvotes: increment(hasUpvotedUser ? -1 : 1),
            upvotedBy: hasUpvotedUser ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
        };

        updateDoc(userRef, payload)
        .catch(err => {
            const permissionError = new FirestorePermissionError({
                path: userRef.path,
                operation: 'update',
                requestResourceData: payload,
            });
            errorEmitter.emit('permission-error', permissionError);
             toast({
                variant: "destructive",
                title: "Error",
                description: "Could not process upvote.",
            });
        })
    };
    
    const hasVoiceStatus = useMemo(() => {
        if (!user?.voiceStatusUrl || !user?.voiceStatusTimestamp) return false;
        // Check if the status is within the last 24 hours
        const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
        return user.voiceStatusTimestamp.toMillis() > twentyFourHoursAgo;
    }, [user]);

    const handleAvatarClick = () => {
        if (hasVoiceStatus && user && showVoiceStatusPlayer) {
            showVoiceStatusPlayer(user);
        }
    }


    if (userLoading || (currentUser && userId === currentUser.uid)) {
        return (
            <AppLayout showTopBar={false}>
                 <div className="flex items-center justify-between h-14 px-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                    <h2 className="text-lg font-semibold font-headline">
                        <Skeleton className="h-7 w-32" />
                    </h2>
                     <Skeleton className="h-10 w-10" />
                </div>
                <div className="px-4">
                    <div className="flex items-start space-x-5 mb-2">
                        <div className="flex-shrink-0 text-center">
                            <Skeleton className="h-20 w-20 md:h-24 md:w-24 rounded-full" />
                            <Skeleton className="h-5 w-24 mt-2 mx-auto" />
                        </div>
                        <div className="flex-1 flex justify-around text-center pt-6">
                            <div>
                                <div className="font-bold text-lg"><Skeleton className="h-6 w-8 mx-auto" /></div>
                                <p className="text-sm text-muted-foreground">Posts</p>
                            </div>
                            <div>
                                <div className="font-bold text-lg"><Skeleton className="h-6 w-8 mx-auto" /></div>
                                <p className="text-sm text-muted-foreground">Karma</p>
                            </div>
                            <div>
                                <div className="font-bold text-lg"><Skeleton className="h-6 w-8 mx-auto" /></div>
                                <p className="text-sm text-muted-foreground">Upvotes</p>
                            </div>
                        </div>
                    </div>
                    <div className="mb-4 space-y-2">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                    </div>
                    <div className="divide-y border-b">
                        <PostSkeleton />
                    </div>
                </div>
            </AppLayout>
        )
    }

    if (!user) {
        return (
             <AppLayout showTopBar={false}>
                <div className="flex items-center justify-between h-14 px-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                     <div className="w-10"></div>
                </div>
                <div className="text-center py-20">
                    <h2 className="text-2xl font-headline text-primary">User not found</h2>
                    <p className="text-muted-foreground mt-2">
                        This user may not exist.
                    </p>
                </div>
            </AppLayout>
        )
    }

    const isLoading = postsLoading || userLoading;

    return (
        <AppLayout showTopBar={false}>
            <div>
                 <Sheet open={isMoreOptionsSheetOpen} onOpenChange={setIsMoreOptionsSheetOpen}>
                    <div className="flex items-center justify-between h-14 px-4">
                         <Button variant="ghost" size="icon" onClick={() => router.back()}>
                            <ArrowLeft className="h-6 w-6" />
                        </Button>
                        <h2 className="text-lg font-semibold font-headline">
                          {formatUserId(user.id)}
                        </h2>
                        <SheetTrigger asChild>
                            <Button variant="ghost" size="icon" className="justify-self-end">
                                <MoreHorizontal className="h-6 w-6" />
                            </Button>
                        </SheetTrigger>
                    </div>

                    <div className="px-4">
                         <div className="flex items-start space-x-5 mb-2">
                            <div className="flex-shrink-0 text-center">
                                <div className="relative inline-block" onClick={handleAvatarClick} role={hasVoiceStatus ? "button" : "none"}>
                                    <Avatar className="h-20 w-20 md:h-24 md:w-24 mx-auto">
                                        <AvatarImage
                                            src={undefined}
                                            alt={user?.name || "User"}
                                        />
                                        {!hasVoiceStatus && (
                                            <AvatarFallback className="text-3xl font-headline bg-secondary">
                                                {getInitials(user?.name)}
                                            </AvatarFallback>
                                        )}
                                    </Avatar>
                                    {hasVoiceStatus && (
                                        <div className="absolute inset-0 flex items-center justify-center rounded-full">
                                            <div className="flex items-center justify-center h-10 gap-1.5">
                                                <div className="audio-wave-bar-avatar" />
                                                <div className="audio-wave-bar-avatar" />
                                                <div className="audio-wave-bar-avatar" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <p className="font-semibold font-headline mt-2">{formatUserId(user?.id)}</p>
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
                                    <div className="font-bold text-lg">{user?.upvotes || 0}</div>
                                    )}
                                    <p className="text-sm text-muted-foreground">Upvotes</p>
                                </div>
                            </div>
                        </div>

                        {/* User Name and Bio */}
                        <div className="mb-4 space-y-2">
                            {user?.bio && <p className="text-sm">{user.bio}</p>}
                            {user?.website && (
                                <a href={user.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-500 hover:underline">
                                    <LinkIcon className="h-4 w-4" />
                                    <span>{user.website.replace(/^(https?:\/\/)?(www\.)?/, '')}</span>
                                </a>
                            )}
                        </div>
                        
                        <div className="mb-4 flex items-center space-x-2">
                             <Button onClick={handleUpvoteUser} variant={hasUpvotedUser ? "default" : "secondary"} className="flex-1 font-bold">
                                {hasUpvotedUser ? "Upvoted" : "Upvote"}
                            </Button>
                            <Button onClick={handleStartConversation} variant="secondary" className="flex-1 font-bold">
                                Message
                            </Button>
                        </div>
                    </div>
                    <Tabs defaultValue="posts" className="w-full">
                        <div className="sticky top-0 bg-background z-10">
                            <TabsList variant="underline" className="grid w-full grid-cols-2">
                                <TabsTrigger value="posts" variant="profile" className="font-semibold">Posts</TabsTrigger>
                                <TabsTrigger value="replies" variant="profile" className="font-semibold">Replies</TabsTrigger>
                            </TabsList>
                        </div>
                        <div>
                            <TabsContent value="posts" className="mt-0">
                            <div className="divide-y border-b">
                                    {(postsLoading || bookmarksLoading) && (
                                        <>
                                            <PostSkeleton />
                                            <PostSkeleton />
                                        </>
                                    )}
                                    {!(postsLoading || bookmarksLoading) && posts?.length === 0 && (
                                        <div className="text-center py-16">
                                            <h3 className="text-xl font-headline text-primary">No Posts Yet</h3>
                                            <p className="text-muted-foreground">This user hasn't posted anything.</p>
                                        </div>
                                    )}
                                    {posts?.map((post) => (
                                        <HomePostItem key={post.id} post={post} bookmarks={bookmarks} updatePost={updatePostState} />
                                    ))}
                                </div>
                            </TabsContent>
                            <TabsContent value="replies" className="mt-0">
                                {userId && <RepliesList userId={userId} />}
                            </TabsContent>
                        </div>
                    </Tabs>
                    <SheetContent side="bottom" className="rounded-t-lg">
                        <SheetHeader className="text-left">
                            <SheetTitle>Options for {formatUserId(user?.id)}</SheetTitle>
                            <SheetDescription>
                                Manage your interaction with this user.
                            </SheetDescription>
                        </SheetHeader>
                         <div className="grid gap-2 py-4">
                             <div className="border rounded-2xl">
                                 <Button variant="ghost" className="justify-between text-base py-6 rounded-2xl w-full" onClick={handleMuteUser}>
                                    <span>{isMuted ? "Unmute" : "Mute"}</span>
                                    {isMuted ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                                </Button>
                                <div className="border-t"></div>
                                <Button variant="ghost" className="justify-between text-base py-6 rounded-2xl w-full" onClick={handleRestrictUser}>
                                    <span>{isRestricted ? "Unrestrict" : "Restrict"}</span>
                                    <MinusCircle className="h-5 w-5" />
                                </Button>
                             </div>
                             <div className="border rounded-2xl">
                                <Button variant="ghost" className="justify-between text-base py-6 rounded-2xl w-full" onClick={handleOpenAbout}>
                                    <span>About this profile</span>
                                    <Info className="h-5 w-5" />
                                </Button>
                            </div>
                             <div className="border rounded-2xl">
                                <Button variant="ghost" className="justify-between text-base py-6 rounded-2xl w-full" onClick={handleShare}>
                                    <span>Share via...</span>
                                    <ArrowUpRight className="h-5 w-5" />
                                </Button>
                                <div className="border-t"></div>
                                <Button variant="ghost" className="justify-between text-base py-6 rounded-2xl w-full" onClick={handleCopyLink}>
                                    <span>Copy Link</span>
                                    <LinkIcon className="h-5 w-5" />
                                </Button>
                                 <div className="border-t"></div>
                                <Button variant="ghost" className="justify-between text-base py-6 rounded-2xl w-full" onClick={handleOpenQrCode}>
                                    <span>QR Code</span>
                                    <QrCode className="h-5 w-5" />
                                </Button>
                            </div>
                            <div className="border rounded-2xl">
                                <ReportDialog reportedUserId={user.id} reportedUserName={formatUserId(user.id)}>
                                    <Button variant="ghost" className="justify-between text-base py-6 rounded-2xl w-full text-destructive hover:text-destructive">
                                        <span>Report</span>
                                        <Flag className="h-5 w-5" />
                                    </Button>
                                </ReportDialog>
                                <div className="border-t"></div>
                                <Button variant="ghost" className="justify-between text-base py-6 rounded-2xl w-full text-destructive hover:text-destructive" onClick={handleBlockUser}>
                                    <span>{isBlocked ? "Unblock" : "Block"}</span>
                                    <ShieldAlert className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    </SheetContent>
                </Sheet>
                {user && <AboutProfileSheet user={user} isOpen={isAboutSheetOpen} onOpenChange={setIsAboutSheetOpen} />}
                 <QrCodeDialog
                    isOpen={isQrDialogOpen}
                    onOpenChange={setIsQrDialogOpen}
                    user={user}
                />
            </div>
        </AppLayout>
    );
}
