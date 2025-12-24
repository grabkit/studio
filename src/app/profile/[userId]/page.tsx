

"use client";

import { useParams, useRouter } from "next/navigation";
import { useFirebase, useMemoFirebase } from "@/firebase";
import { doc, collection, query, where, getDocs, serverTimestamp, setDoc, getDoc, updateDoc, increment, arrayUnion, arrayRemove, orderBy } from "firebase/firestore";
import { useDoc } from "@/firebase/firestore/use-doc";
import { useCollection } from "@/firebase/firestore/use-collection";
import type { Post, User } from "@/lib/types";
import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

import AppLayout from "@/components/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, MessageSquare, ArrowUpRight, ArrowUp } from "lucide-react";
import { getInitials, cn } from "@/lib/utils";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";
import { PostItem as HomePostItem, PostSkeleton } from "@/app/home/page";
import type { Bookmark } from "@/lib/types";
import { WithId } from "@/firebase/firestore/use-collection";
import { RepliesList } from "@/components/RepliesList";


export default function UserProfilePage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const userId = params.userId as string;
    const { firestore, user: currentUser } = useFirebase();

    useEffect(() => {
        if (currentUser && userId === currentUser.uid) {
            router.replace('/account');
        }
    }, [currentUser, userId, router]);

    const userRef = useMemoFirebase(() => {
        if (!firestore || !userId) return null;
        return doc(firestore, "users", userId);
    }, [firestore, userId]);
    
    const postsQuery = useMemoFirebase(() => {
        if (!firestore || !userId) return null;
        return query(
            collection(firestore, "posts"),
            where("authorId", "==", userId),
            orderBy("timestamp", "desc")
        );
    }, [firestore, userId]);

    const { data: user, isLoading: userLoading } = useDoc<User>(userRef);
    const { data: posts, isLoading: postsLoading } = useCollection<Post>(postsQuery);

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

    const handleStartConversation = async () => {
        if (!currentUser || !firestore || !userId || currentUser.uid === userId) return;
    
        const currentUserId = currentUser.uid;
        const conversationId = [currentUserId, userId].sort().join('_');
        const conversationRef = doc(firestore, 'conversations', conversationId);
    
        try {
            const conversationSnap = await getDoc(conversationRef);

            if (conversationSnap.exists()) {
                router.push(`/messages/${userId}`);
            } else {
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
                router.push(`/messages/${userId}`);
            }
        } catch (error: any) {
            console.error("Error handling conversation:", error);
            
            const permissionError = new FirestorePermissionError({
                path: conversationRef.path,
                operation: 'create', 
                requestResourceData: { status: 'pending' } 
            });
            errorEmitter.emit('permission-error', permissionError);
            
            toast({
                variant: "destructive",
                title: "Error",
                description: "Could not start the conversation. You may not have the required permissions.",
            });
        }
    };
    
    const handleShareProfile = async () => {
        if (!user) return;
        const shareData = {
            title: `Check out ${user.name || formatUserId(user.id)} on Blur`,
            text: `View ${user.name || formatUserId(user.id)}'s profile on Blur.`,
            url: window.location.href,
        };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(shareData.url);
                toast({
                    title: "Profile Link Copied",
                    description: "Link to this profile has been copied to your clipboard.",
                });
            }
        } catch (error: any) {
            // Ignore user cancellation of share sheet
            if (error.name === 'NotAllowedError') return;
            
            console.error("Error sharing profile:", error);
            toast({
                variant: "destructive",
                title: "Could not share",
                description: "There was an error trying to share this profile.",
            });
        }
    };

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


    if (userLoading || (currentUser && userId === currentUser.uid)) {
        return (
            <AppLayout showTopBar={false}>
                 <div className="grid grid-cols-3 items-center mb-6 px-4 -ml-2">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                    <h2 className="text-2xl font-semibold font-headline text-center">
                        <Skeleton className="h-8 w-32 mx-auto" />
                    </h2>
                </div>
                <div className="px-4">
                    <div className="flex items-center space-x-5 mb-6">
                        <Skeleton className="h-20 w-20 md:h-24 md:w-24 rounded-full" />
                        <div className="flex-1 flex justify-around text-center">
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
                    <div className="mb-4">
                        <Skeleton className="h-5 w-32 mb-2" />
                        <Skeleton className="h-4 w-48" />
                    </div>
                    <Skeleton className="h-px w-full" />
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
                <div className="grid grid-cols-3 items-center mb-6 px-4 -ml-2">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
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
                <div className="grid grid-cols-3 items-center mb-6 px-4 -ml-2">
                     <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                    <h2 className="text-2xl font-semibold font-headline text-center">
                      {formatUserId(user?.id)}
                    </h2>
                </div>

                <div className="px-4">
                    <div className="flex items-center space-x-5 mb-6">
                        <Avatar className="h-20 w-20 md:h-24 md:w-24">
                            <AvatarImage
                            src={undefined}
                            alt={user?.name || "User"}
                            />
                            <AvatarFallback className="text-3xl font-headline bg-primary text-primary-foreground">
                            {getInitials(user?.name)}
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
                                <div className="font-bold text-lg">{user?.upvotes || 0}</div>
                                )}
                                <p className="text-sm text-muted-foreground">Upvotes</p>
                            </div>
                        </div>
                    </div>


                    {/* User Name and Bio */}
                    <div className="mb-4">
                        <h1 className="font-bold text-base">{user?.name}</h1>
                        {/* Hiding email for privacy on public profiles */}
                    </div>
                    
                    <div className="mb-4 flex items-center space-x-2">
                         <Button onClick={handleUpvoteUser} variant={hasUpvotedUser ? "default" : "secondary"} className="flex-1">
                            <ArrowUp className={cn("mr-2 h-4 w-4", hasUpvotedUser && "fill-current")} /> {hasUpvotedUser ? "Upvoted" : "Upvote"}
                        </Button>
                        <Button onClick={handleStartConversation} variant="secondary" className="flex-1">
                            <MessageSquare className="mr-2 h-4 w-4" /> Message
                        </Button>
                         <Button onClick={handleShareProfile} variant="secondary" size="icon">
                            <ArrowUpRight className="h-4 w-4" />
                        </Button>
                    </div>

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
                                <div className="text-center py-16">
                                    <h3 className="text-xl font-headline text-primary">No Posts Yet</h3>
                                    <p className="text-muted-foreground">This user hasn't posted anything.</p>
                                </div>
                            )}
                            {posts?.map((post) => (
                                <HomePostItem key={post.id} post={post} bookmarks={bookmarks} />
                            ))}
                        </div>
                    </TabsContent>
                    <TabsContent value="replies">
                        {userId && <RepliesList userId={userId} />}
                    </TabsContent>
                </Tabs>


            </div>
        </AppLayout>
    );

    
}
