
"use client";

import { useParams, useRouter } from "next/navigation";
import { useFirebase, useMemoFirebase, useCollection, type WithId, useDoc } from "@/firebase";
import { doc, collection, query, where, getDocs, serverTimestamp, setDoc, getDoc, updateDoc, increment, arrayUnion, arrayRemove, deleteField, runTransaction } from "firebase/firestore";
import type { Post, User, Notification, Conversation } from "@/lib/types";
import React, { useMemo, useState, useEffect, useCallback, useRef, type TouchEvent } from "react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

import AppLayout from "@/components/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, MessageSquare, ArrowUpRight, ArrowUp, MoreHorizontal, ShieldAlert, Flag, VolumeX, Info, MinusCircle, Link as LinkIcon, QrCode, Calendar, Badge, User as UserIcon, Volume2, BarChart3, RefreshCw } from "lucide-react";
import { getAvatar, cn, formatLastSeen, formatUserId } from "@/lib/utils";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";
import { PostItem as HomePostItem, PostSkeleton } from "@/app/home/page";
import type { Bookmark } from "@/lib/types";
import { RepliesList } from "@/components/RepliesList";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import { ReportDialog } from "@/components/ReportDialog";
import { QrCodeDialog } from "@/components/QrCodeDialog";


function AboutProfileSheet({ user, isOpen, onOpenChange }: { user: WithId<User>, isOpen: boolean, onOpenChange: (open: boolean) => void }) {

    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="rounded-t-2xl">
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
    
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullPosition, setPullPosition] = useState(0);
    const touchStartRef = useRef(0);
    const containerRef = useRef<HTMLDivElement>(null);

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

    // Fetch conversation status
    const conversationId = useMemo(() => {
        if (!currentUser || !userId) return null;
        return [currentUser.uid, userId].sort().join('_');
    }, [currentUser, userId]);

    const conversationRef = useMemoFirebase(() => {
        if (!firestore || !conversationId) return null;
        return doc(firestore, 'conversations', conversationId);
    }, [firestore, conversationId]);

    const { data: conversation, isLoading: isConversationLoading } = useDoc<Conversation>(conversationRef);

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

    const fetchPosts = useCallback(async () => {
        if (!firestore || !userId) return;
        setPostsLoading(true);
        try {
            const postsQuery = query(
                collection(firestore, "posts"),
                where("authorId", "==", userId)
            );
            const querySnapshot = await getDocs(postsQuery);
            let userPosts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WithId<Post>));

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
    }, [firestore, userId]);
    
    useEffect(() => {
      fetchPosts();
    }, [fetchPosts]);

    const fetchProfile = useCallback(async () => {
        if (!userRef) return;
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
            setFetchedUser({ id: userDoc.id, ...userDoc.data() } as WithId<User>);
        }
    }, [userRef, setFetchedUser]);

    const handleRefresh = async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        window.navigator.vibrate?.(50);
        await Promise.all([fetchPosts(), fetchProfile()]);
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

    const updatePostState = useCallback((postId: string, updatedData: Partial<Post>) => {
        setPosts(currentPosts => {
            if (!currentPosts) return [];
            return currentPosts.map(p =>
                p.id === postId ? { ...p, ...updatedData } : p
            );
        });
    }, []);


    const bookmarksQuery = useMemoFirebase(() => {
        if (!firestore || !currentUser) return null;
        return collection(firestore, 'users', currentUser.uid, 'bookmarks');
    }, [firestore, currentUser]);

    const { data: bookmarks, isLoading: bookmarksLoading } = useCollection<Bookmark>(bookmarksQuery);

    
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
        if (!currentUser || !firestore || !userId || currentUser.uid === userId || !conversationRef) return;
        
        // If conversation already exists (pending or accepted), just navigate
        if (conversation) {
            router.push(`/messages/${userId}`);
            return;
        }

        // If conversation doesn't exist, create it
        try {
            const newConversationData = {
                id: conversationId,
                participantIds: [currentUser.uid, userId].sort(),
                lastMessage: '',
                lastUpdated: serverTimestamp(),
                status: 'pending',
                requesterId: currentUser.uid,
                unreadCounts: { [currentUser.uid]: 0, [userId]: 0 },
                lastReadTimestamps: { [currentUser.uid]: serverTimestamp() }
            };
            await setDoc(conversationRef, newConversationData);
            
            const notificationRef = doc(collection(firestore, 'users', userId, 'notifications'));
            const notificationData: Omit<Notification, 'id'> = {
                type: 'message_request',
                fromUserId: currentUser.uid,
                timestamp: serverTimestamp(),
                read: false,
            };
            await setDoc(notificationRef, { ...notificationData, id: notificationRef.id });

            // No navigation here, the button state will change to "Requested"
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
             if (error.name === 'AbortError' || error.name === 'NotAllowedError') {
                // User cancelled the share action or permission was denied.
                // Do nothing, fail silently.
                return;
             }
            
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
        if (!currentUser || !user || !userRef || !firestore) return;

        const currentUserRef = doc(firestore, 'users', currentUser.uid);

        runTransaction(firestore, async (transaction) => {
            const targetUserDoc = await transaction.get(userRef);
            const currentUserDoc = await transaction.get(currentUserRef);

            if (!targetUserDoc.exists() || !currentUserDoc.exists()) {
                throw "One of the user documents does not exist!";
            }
            
            const targetUser = targetUserDoc.data() as User;
            const userHasUpvoted = (targetUser.upvotedBy || []).includes(currentUser.uid);

            if (userHasUpvoted) {
                 // Un-upvote
                transaction.update(userRef, {
                    upvotes: increment(-1),
                    upvotedBy: arrayRemove(currentUser.uid)
                });
                transaction.update(currentUserRef, {
                    upvotedCount: increment(-1),
                    upvotedTo: arrayRemove(user.id)
                });
            } else {
                 // Upvote
                 transaction.update(userRef, {
                    upvotes: increment(1),
                    upvotedBy: arrayUnion(currentUser.uid)
                });
                transaction.update(currentUserRef, {
                    upvotedCount: increment(1),
                    upvotedTo: arrayUnion(user.id)
                });
            }
        }).then(() => {
             if (!hasUpvotedUser) {
                const notificationRef = doc(collection(firestore, 'users', user.id, 'notifications'));
                const notificationData: Omit<Notification, 'id'> = {
                    type: 'upvote',
                    fromUserId: currentUser.uid,
                    timestamp: serverTimestamp(),
                    read: false,
                };
                setDoc(notificationRef, { ...notificationData, id: notificationRef.id }).catch(serverError => {
                    console.error("Failed to create upvote notification:", serverError);
                });
            }
        })
        .catch(err => {
            console.error("Upvote transaction failed:", err);
            const permissionError = new FirestorePermissionError({
                path: userRef.path,
                operation: 'update',
                requestResourceData: { upvotes: 'transactional update'},
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
    
    const handleBackNavigation = () => {
        router.back();
    };


    if (userLoading || (currentUser && userId === currentUser.uid)) {
        return (
            <AppLayout showTopBar={false}>
                 <div className="flex items-center justify-between h-14 px-4 bg-background">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                    <h2 className="text-lg font-semibold font-headline">
                        <Skeleton className="h-7 w-32" />
                    </h2>
                     <Skeleton className="h-10 w-10" />
                </div>
                <div className="pt-14">
                    <div className="px-4 pt-4">
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
                                    <p className="text-sm text-muted-foreground">Upvotes</p>
                                </div>
                                <div>
                                    <div className="font-bold text-lg"><Skeleton className="h-6 w-8 mx-auto" /></div>
                                    <p className="text-sm text-muted-foreground">Upvoted</p>
                                </div>
                            </div>
                        </div>
                        <div className="mb-4 space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-2/3" />
                        </div>
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
                <div className="flex items-center justify-between h-14 px-4 bg-background">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                     <div className="w-10"></div>
                </div>
                <div className="text-center py-20 pt-32">
                    <h2 className="text-2xl font-headline text-primary">User not found</h2>
                    <p className="text-muted-foreground mt-2">
                        This user may have been deleted.
                    </p>
                </div>
            </AppLayout>
        )
    }

    const isLoading = postsLoading || userLoading || isConversationLoading;
    
    const getMessageButton = () => {
        if (!conversation) {
            return (
                <Button onClick={handleStartConversation} variant="secondary" className="flex-1 font-bold rounded-[5px]">
                    Message
                </Button>
            );
        }

        if (conversation.status === 'pending') {
            return (
                <Button variant="secondary" className="flex-1 font-bold rounded-[5px]" disabled>
                    Requested
                </Button>
            );
        }

        // status === 'accepted'
        return (
            <Button asChild variant="secondary" className="flex-1 font-bold rounded-[5px]">
                <Link href={`/messages/${userId}`}>Message</Link>
            </Button>
        );
    };

    return (
        <AppLayout showTopBar={false} showBottomNav={true}>
            <div
                ref={containerRef}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <Sheet open={isMoreOptionsSheetOpen} onOpenChange={setIsMoreOptionsSheetOpen}>
                    <div className="flex items-center justify-between h-14 px-4 bg-background">
                        <Button variant="ghost" size="icon" onClick={handleBackNavigation}>
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

                    <div 
                        className="absolute top-0 left-0 right-0 flex justify-center items-center h-12 text-muted-foreground transition-opacity duration-300 z-10 pointer-events-none"
                        style={{ opacity: isRefreshing ? 1 : pullPosition / 70 }}
                    >
                        <div style={{ transform: `rotate(${isRefreshing ? 0 : pullPosition * 3}deg)` }}>
                            <RefreshCw className={cn('h-5 w-5', isRefreshing && 'animate-spin')} />
                        </div>
                    </div>
                    
                    <div style={{ transform: `translateY(${pullPosition}px)` }} className="transition-transform duration-300 bg-background">
                        <div className="px-4 pt-4">
                            <div className="flex items-center justify-between space-x-5 mb-4">
                                <div className="flex-shrink-0">
                                    <div className="relative inline-block">
                                        <Avatar className="h-20 w-20 md:h-24 md:w-24">
                                            <AvatarImage
                                                src={undefined}
                                                alt={user?.name || "User"}
                                            />
                                            <AvatarFallback className="text-3xl font-headline bg-secondary">
                                                {getAvatar(user?.id)}
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
                                    <Link href={`/profile/${userId}/social?tab=upvotes`} className="cursor-pointer hover:bg-secondary/50 rounded-md p-1 -m-1">
                                        {isLoading ? (
                                        <div className="font-bold text-lg"><Skeleton className="h-6 w-8 mx-auto" /></div>
                                        ) : (
                                        <div className="font-bold text-lg">{user?.upvotes || 0}</div>
                                        )}
                                        <p className="text-sm text-muted-foreground">Upvotes</p>
                                    </Link>
                                    <Link href={`/profile/${userId}/social?tab=upvoted`} className="cursor-pointer hover:bg-secondary/50 rounded-md p-1 -m-1">
                                        {isLoading ? (
                                        <div className="font-bold text-lg"><Skeleton className="h-6 w-8 mx-auto" /></div>
                                        ) : (
                                        <div className="font-bold text-lg">{user?.upvotedCount || 0}</div>
                                        )}
                                        <p className="text-sm text-muted-foreground">Upvoted</p>
                                    </Link>
                                </div>
                            </div>
                            <div className="mb-4 space-y-1">
                                <p className="font-semibold font-headline">{formatUserId(user?.id)}</p>
                                {user?.bio && <p className="text-sm">{user.bio}</p>}
                                {user?.website && (
                                    <a href={user.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-500 hover:underline">
                                        <LinkIcon className="h-4 w-4" />
                                        <span>{user.website.replace(/^(https?:\/\/)?(www\.)?/, '')}</span>
                                    </a>
                                )}
                            </div>
                            <div className="mb-4 flex items-center space-x-2">
                                <Button onClick={handleUpvoteUser} variant={hasUpvotedUser ? "secondary" : "default"} className="flex-1 font-bold rounded-[5px]">
                                    {hasUpvotedUser ? "Upvoted" : "Upvote"}
                                </Button>
                                {getMessageButton()}
                            </div>
                        </div>

                        <Tabs defaultValue="posts" className="w-full">
                           <div className="sticky top-0 bg-background z-10">
                                <TabsList variant="underline" className="grid w-full grid-cols-2">
                                    <TabsTrigger value="posts" variant="profile" className="font-semibold">Posts</TabsTrigger>
                                    <TabsTrigger value="replies" variant="profile" className="font-semibold">Replies</TabsTrigger>
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
                                        <div className="text-center py-16">
                                            <h3 className="text-xl font-headline text-primary">No Posts Yet</h3>
                                            <p className="text-muted-foreground">This user hasn't posted anything.</p>
                                        </div>
                                    )}
                                    {posts?.map((post) => (
                                        <HomePostItem 
                                        key={post.id} 
                                        post={post} 
                                        bookmarks={bookmarks} 
                                        updatePost={updatePostState}
                                        showPinStatus={true} 
                                        />
                                    ))}
                                </div>
                            </TabsContent>
                            <TabsContent value="replies" className="mt-0">
                                {userId && <RepliesList userId={userId} />}
                            </TabsContent>
                        </Tabs>
                    </div>

                    <SheetContent side="bottom" className="rounded-t-2xl">
                        <SheetHeader className="text-left sr-only">
                        <SheetTitle>Options for {formatUserId(user.id)}</SheetTitle>
                        <SheetDescription>Manage your interaction with this user.</SheetDescription>
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

    