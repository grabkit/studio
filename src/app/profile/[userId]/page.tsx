
"use client";

import { useParams, useRouter } from "next/navigation";
import { useFirebase, useMemoFirebase, useCollection, type WithId, useDoc } from "@/firebase";
import { doc, collection, query, where, getDocs, serverTimestamp, setDoc, getDoc, updateDoc, increment, arrayUnion, arrayRemove, deleteField, runTransaction } from "firebase/firestore";
import type { Post, User, Notification, Conversation } from "@/lib/types";
import React, { useMemo, useState, useEffect, useCallback, useRef, type TouchEvent } from "react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { motion } from "framer-motion";

import AppLayout from "@/components/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, MessageSquare, ArrowUpRight, MoreHorizontal, ShieldAlert, Flag, VolumeX, Info, MinusCircle, Link as LinkIcon, QrCode, Calendar, Badge, User as UserIcon, Volume2, BarChart3, ChevronDown, Loader2, ChevronRight } from "lucide-react";
import { getAvatar, cn, formatLastSeen, formatUserId, getFormattedUserIdString } from "@/lib/utils.tsx";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";
import { PostItem as HomePostItem, PostSkeleton } from "@/app/home/page.tsx";
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

function ProfileOptionsItem({ label, icon: Icon, onClick }: { label: string, icon: React.ElementType, onClick?: () => void }) {
    return (
        <div onClick={onClick} className="flex items-center justify-between p-4 transition-colors hover:bg-accent/50 cursor-pointer">
            <div className="flex items-center space-x-4">
                <Icon className="h-5 w-5 text-foreground" />
                <span className="text-base">{label}</span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
    )
}

function DestructiveProfileOptionsItem({ label, icon: Icon, onClick }: { label: string, icon: React.ElementType, onClick?: () => void }) {
    return (
        <div onClick={onClick} className="flex items-center space-x-4 p-4 transition-colors hover:bg-destructive/10 cursor-pointer text-destructive">
            <Icon className="h-5 w-5" />
            <span className="text-base font-medium">{label}</span>
        </div>
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
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isMoreOptionsSheetOpen, setIsMoreOptionsSheetOpen] = useState(false);
    const [isAboutSheetOpen, setIsAboutSheetOpen] = useState(false);
    const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
    const [isUnfollowSheetOpen, setIsUnfollowSheetOpen] = useState(false);

    const userRef = useMemoFirebase(() => {
        if (!firestore || !userId) return null;
        return doc(firestore, "users", userId);
    }, [firestore, userId]);
    
    const { data: fetchedUser, isLoading: userLoading, setData: setFetchedUser } = useDoc<User>(userRef);
    
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 30000); // Check every 30s
        return () => clearInterval(timer);
    }, []);

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

    const filteredPosts = useMemo(() => {
        if (!posts) return [];
        const now = currentTime;
        return posts.filter(post => !post.expiresAt || post.expiresAt.toDate() > now);
    }, [posts, currentTime]);
    
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
            title: `Check out ${getFormattedUserIdString(user.id)} on Blur`,
            text: `View ${getFormattedUserIdString(user.id)}'s profile on Blur.`,
            url: window.location.href,
        };
        try {
            const androidInterface = (window as any).Android;
            if (androidInterface && typeof androidInterface.share === 'function') {
                androidInterface.share(shareData.title, shareData.text, shareData.url);
            } else if (navigator.share) {
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
    
    const isFollowing = useMemo(() => {
        if (!user || !currentUser) return false;
        return user.followedBy?.includes(currentUser.uid) || false;
    }, [user, currentUser]);

    const handleFollowUser = () => {
        if (!currentUser || !user || !userRef || !firestore) return;

        const currentUserRef = doc(firestore, 'users', currentUser.uid);
        
        // Optimistic Update
        const originalUser = { ...user };
        const currentlyFollowing = originalUser.followedBy?.includes(currentUser.uid) ?? false;
        
        const updatedFollowedBy = currentlyFollowing
            ? originalUser.followedBy?.filter(id => id !== currentUser.uid)
            : [...(originalUser.followedBy || []), currentUser.uid];
            
        const updatedFollowersCount = currentlyFollowing
            ? (originalUser.followersCount ?? 1) - 1
            : (originalUser.followersCount ?? 0) + 1;

        setFetchedUser({
            ...originalUser,
            followedBy: updatedFollowedBy,
            followersCount: updatedFollowersCount
        } as WithId<User>);

        runTransaction(firestore, async (transaction) => {
            const targetUserDoc = await transaction.get(userRef);
            const currentUserDoc = await transaction.get(currentUserRef);

            if (!targetUserDoc.exists() || !currentUserDoc.exists()) {
                throw "One of the user documents does not exist!";
            }
            
            if (currentlyFollowing) {
                 // Unfollow
                transaction.update(userRef, {
                    followersCount: increment(-1),
                    followedBy: arrayRemove(currentUser.uid)
                });
                transaction.update(currentUserRef, {
                    followingCount: increment(-1),
                    following: arrayRemove(user.id)
                });
            } else {
                 // Follow
                 transaction.update(userRef, {
                    followersCount: increment(1),
                    followedBy: arrayUnion(currentUser.uid)
                });
                transaction.update(currentUserRef, {
                    followingCount: increment(1),
                    following: arrayUnion(user.id)
                });
            }
            return { didFollow: !currentlyFollowing };
        }).then(({ didFollow }) => {
             if (didFollow) {
                const notificationRef = doc(collection(firestore, 'users', user.id, 'notifications'));
                const notificationData: Omit<Notification, 'id'> = {
                    type: 'follow',
                    fromUserId: currentUser.uid,
                    timestamp: serverTimestamp(),
                    read: false,
                };
                setDoc(notificationRef, { ...notificationData, id: notificationRef.id }).catch(serverError => {
                    console.error("Failed to create follow notification:", serverError);
                });
            }
        })
        .catch(err => {
            // Revert optimistic update on failure
            setFetchedUser(originalUser as WithId<User>);

            console.error("Follow transaction failed:", err);
            const permissionError = new FirestorePermissionError({
                path: userRef.path,
                operation: 'update',
                requestResourceData: { followersCount: 'transactional update'},
            });
            errorEmitter.emit('permission-error', permissionError);
             toast({
                variant: "destructive",
                title: "Error",
                description: "Could not process follow action.",
            });
        })
        .finally(() => {
            // Close sheet if open
            setIsUnfollowSheetOpen(false);
        });
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
                                    <p className="text-sm text-muted-foreground">Followers</p>
                                </div>
                                <div>
                                    <div className="font-bold text-lg"><Skeleton className="h-6 w-8 mx-auto" /></div>
                                    <p className="text-sm text-muted-foreground">Following</p>
                                </div>
                            </div>
                        </div>
                        <div className="mb-4 space-y-2">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-2/3" />
                        </div>
                    </div>
                    <div className="">
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
                    <h2 className="text-2xl font-headline text-foreground">User not found</h2>
                    <p className="text-muted-foreground mt-2">
                        This user may have been deleted.
                    </p>
                </div>
            </AppLayout>
        )
    }
    
    const avatar = getAvatar(user);
    const isAvatarUrl = avatar.startsWith('http');
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
            <motion.div
                className="h-full"
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
            >
                <Sheet open={isMoreOptionsSheetOpen} onOpenChange={setIsMoreOptionsSheetOpen}>
                    <div
                        className="relative h-full overflow-y-auto"
                    >
                        <div>
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
                            <div className="px-4 pt-4">
                                <div className="flex items-center justify-between space-x-5 mb-4">
                                    <div className="flex-shrink-0">
                                        <div className="relative inline-block">
                                            <Avatar className="h-20 w-20 md:h-24 md:w-24">
                                                <AvatarImage
                                                    src={isAvatarUrl ? avatar : undefined}
                                                    alt={user?.name || "User"}
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
                                                <div className="font-bold text-lg">{filteredPosts?.length ?? 0}</div>
                                            )}
                                            <p className="text-sm text-muted-foreground">Posts</p>
                                        </div>
                                        <Link href={`/profile/${userId}/social?tab=followers`} className="cursor-pointer hover:bg-secondary/50 rounded-md p-1 -m-1">
                                            {isLoading ? (
                                            <div className="font-bold text-lg"><Skeleton className="h-6 w-8 mx-auto" /></div>
                                            ) : (
                                            <div className="font-bold text-lg">{user?.followersCount || 0}</div>
                                            )}
                                            <p className="text-sm text-muted-foreground">Followers</p>
                                        </Link>
                                        <Link href={`/profile/${userId}/social?tab=following`} className="cursor-pointer hover:bg-secondary/50 rounded-md p-1 -m-1">
                                            {isLoading ? (
                                            <div className="font-bold text-lg"><Skeleton className="h-6 w-8 mx-auto" /></div>
                                            ) : (
                                            <div className="font-bold text-lg">{user?.followingCount || 0}</div>
                                            )}
                                            <p className="text-sm text-muted-foreground">Following</p>
                                        </Link>
                                    </div>
                                </div>
                                <div className="mb-4 space-y-1">
                                    <p className="font-semibold font-headline">{formatUserId(user?.id)}</p>
                                    <p className="text-sm">{user?.bio || "Hey there! I’m using Blur."}</p>
                                    {user?.website && (
                                        <a href={user.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-500 hover:underline">
                                            <LinkIcon className="h-4 w-4" />
                                            <span>{user.website.replace(/^(https?:\/\/)?(www\.)?/, '')}</span>
                                        </a>
                                    )}
                                </div>
                                <div className="mb-4 flex items-center space-x-2">
                                     {isFollowing ? (
                                        <Sheet open={isUnfollowSheetOpen} onOpenChange={setIsUnfollowSheetOpen}>
                                            <SheetTrigger asChild>
                                                 <Button variant="secondary" className="flex-1 font-bold rounded-[5px] gap-1">
                                                    Following
                                                    <ChevronDown className="h-4 w-4" />
                                                </Button>
                                            </SheetTrigger>
                                            <SheetContent side="bottom" className="rounded-t-2xl">
                                                <SheetHeader className="text-center pb-4">
                                                    <SheetTitle>Unfollow {formatUserId(user.id)}?</SheetTitle>
                                                </SheetHeader>
                                                <Button onClick={handleFollowUser} variant="default" className="w-full rounded-full">
                                                    Unfollow
                                                </Button>
                                                <SheetClose asChild>
                                                    <Button variant="outline" className="w-full mt-2 rounded-full">Cancel</Button>
                                                </SheetClose>
                                            </SheetContent>
                                        </Sheet>
                                     ) : (
                                        <Button onClick={handleFollowUser} variant="default" className="flex-1 font-bold rounded-[5px]">
                                            Follow
                                        </Button>
                                     )}
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
                                    <div className="">
                                        {(postsLoading || bookmarksLoading) && (
                                            <>
                                                <PostSkeleton />
                                                <PostSkeleton />
                                            </>
                                        )}
                                        {!(postsLoading || bookmarksLoading) && filteredPosts?.length === 0 && (
                                            <div className="text-center py-16">
                                                <h3 className="text-xl font-headline text-foreground">No Posts Yet</h3>
                                                <p className="text-muted-foreground">This user hasn't posted anything.</p>
                                            </div>
                                        )}
                                        {filteredPosts?.map((post) => (
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
                    </div>

                    <SheetContent side="bottom" className="rounded-t-2xl p-0">
                        <SheetHeader className="text-center p-4 border-b">
                            <SheetTitle>Options</SheetTitle>
                        </SheetHeader>
                        <div className="p-4 space-y-6 overflow-y-auto">
                            <div>
                                <h3 className="px-2 mb-1 text-sm font-semibold text-muted-foreground">Interaction</h3>
                                <div className="bg-card rounded-xl">
                                    <ProfileOptionsItem
                                        icon={isMuted ? Volume2 : VolumeX}
                                        label={isMuted ? "Unmute" : "Mute"}
                                        onClick={handleMuteUser}
                                    />
                                    <div className="h-px bg-border/50 mx-4 opacity-50" />
                                    <ProfileOptionsItem
                                        icon={MinusCircle}
                                        label={isRestricted ? "Unrestrict" : "Restrict"}
                                        onClick={handleRestrictUser}
                                    />
                                </div>
                            </div>
                            <div>
                                <h3 className="px-2 mb-1 text-sm font-semibold text-muted-foreground">Share & Info</h3>
                                <div className="bg-card rounded-xl">
                                    <ProfileOptionsItem
                                        icon={Info}
                                        label="About this profile"
                                        onClick={handleOpenAbout}
                                    />
                                    <div className="h-px bg-border/50 mx-4 opacity-50" />
                                    <ProfileOptionsItem
                                        icon={ArrowUpRight}
                                        label="Share via..."
                                        onClick={handleShare}
                                    />
                                    <div className="h-px bg-border/50 mx-4 opacity-50" />
                                    <ProfileOptionsItem
                                        icon={LinkIcon}
                                        label="Copy Link"
                                        onClick={handleCopyLink}
                                    />
                                    <div className="h-px bg-border/50 mx-4 opacity-50" />
                                    <ProfileOptionsItem
                                        icon={QrCode}
                                        label="QR Code"
                                        onClick={handleOpenQrCode}
                                    />
                                </div>
                            </div>
                            <div>
                                <h3 className="px-2 mb-1 text-sm font-semibold text-muted-foreground">Danger Zone</h3>
                                <div className="bg-card rounded-xl">
                                    <ReportDialog reportedUserId={user.id} reportedUserName={getFormattedUserIdString(user.id).toString()}>
                                        <DestructiveProfileOptionsItem
                                            icon={Flag}
                                            label="Report"
                                        />
                                    </ReportDialog>
                                    <div className="h-px bg-border/50 mx-4 opacity-50" />
                                    <DestructiveProfileOptionsItem
                                        icon={ShieldAlert}
                                        label={isBlocked ? "Unblock" : "Block"}
                                        onClick={handleBlockUser}
                                    />
                                </div>
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
            </motion.div>
        </AppLayout>
    );
}
