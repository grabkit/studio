

"use client";

import { useParams, useRouter } from "next/navigation";
import { useFirebase, useMemoFirebase } from "@/firebase";
import { doc, collection, query, where, getDocs, serverTimestamp, setDoc, getDoc } from "firebase/firestore";
import { useDoc } from "@/firebase/firestore/use-doc";
import { useCollection } from "@/firebase/firestore/use-collection";
import type { Post, User, UserPost, Bookmark } from "@/lib/types";
import React, { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

import AppLayout from "@/components/AppLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Grid3x3, FileText, ArrowLeft, Bookmark as BookmarkIcon, MessageSquare, ArrowUpRight } from "lucide-react";
import { getInitials } from "@/lib/utils";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";

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

function ProfilePageSkeleton() {
    return (
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
                        <p className="text-sm text-muted-foreground">Likes</p>
                    </div>
                     <div>
                        <div className="font-bold text-lg"><Skeleton className="h-6 w-8 mx-auto" /></div>
                        <p className="text-sm text-muted-foreground">Comments</p>
                    </div>
                </div>
            </div>
            <div className="mb-4">
                 <Skeleton className="h-5 w-32 mb-2" />
                 <Skeleton className="h-4 w-48" />
            </div>
             <Skeleton className="h-px w-full" />
             <div className="grid grid-cols-3 gap-1 mt-4">
                {Array.from({length: 3}).map((_, i) => (
                    <Skeleton key={i} className="aspect-square w-full" />
                ))}
            </div>
        </div>
    )
}


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

    const userPostsQuery = useMemoFirebase(() => {
        if (!firestore || !userId) return null;
        return query(
        collection(firestore, "posts"),
        where("authorId", "==", userId)
        );
    }, [firestore, userId]);

    const { data: user, isLoading: userLoading } = useDoc<User>(userRef);
    const { data: posts, isLoading: postsLoading } = useCollection<Post>(userPostsQuery);

    const totalLikes = useMemo(() => {
        if (!posts) return 0;
        return posts.reduce((acc, post) => acc + (post.likeCount || 0), 0);
    }, [posts]);
    
    const totalComments = useMemo(() => {
        if (!posts) return 0;
        return posts.reduce((acc, post) => acc + (post.commentCount || 0), 0);
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
                // If conversation already exists (pending or accepted), just navigate.
                router.push(`/messages/${userId}`);
            } else {
                // If it doesn't exist, create a new pending request.
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
            
            // This error is more likely to happen on the 'setDoc' (create) operation
            const permissionError = new FirestorePermissionError({
                path: conversationRef.path,
                operation: 'create', // We are attempting to create if it doesn't exist.
                requestResourceData: { status: 'pending' } // A sample of what we tried to create
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
        } catch (error) {
            console.error("Error sharing profile:", error);
            toast({
                variant: "destructive",
                title: "Could not share",
                description: "There was an error trying to share this profile.",
            });
        }
    };


    if (userLoading || (currentUser && userId === currentUser.uid)) {
        return (
            <AppLayout showTopBar={false}>
                 <div className="grid grid-cols-3 items-center mb-6 -ml-2 px-2">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                    <h2 className="text-2xl font-semibold font-headline text-center">
                        <Skeleton className="h-8 w-32 mx-auto" />
                    </h2>
                </div>
                <ProfilePageSkeleton />
            </AppLayout>
        )
    }

    if (!user) {
        return (
             <AppLayout showTopBar={false}>
                <div className="text-center py-20 pt-32">
                    <h2 className="text-2xl font-headline text-primary">User not found</h2>
                    <p className="text-muted-foreground mt-2">
                        This user may not exist.
                    </p>
                </div>
            </AppLayout>
        )
    }

    return (
        <AppLayout showTopBar={false}>
            <div className="px-4">
                <div className="grid grid-cols-3 items-center mb-6 -ml-2">
                     <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                    <h2 className="text-2xl font-semibold font-headline text-center">
                      {formatUserId(user?.id)}
                    </h2>
                </div>

                <div className="flex items-center space-x-5 mb-6">
                <Avatar className="h-20 w-20 md:h-24 md:w-24">
                    <AvatarImage
                    src={undefined} // No photoURL for other users for now
                    alt={user?.name || "User"}
                    />
                    <AvatarFallback className="text-3xl font-headline bg-primary text-primary-foreground">
                    {getInitials(user?.name)}
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
                        <p className="text-sm text-muted-foreground">Likes</p>
                    </div>
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
                    <h1 className="font-bold text-base">{user?.name}</h1>
                    {/* Hiding email for privacy on public profiles */}
                </div>
                
                 <div className="mb-4 flex items-center space-x-2">
                    <Button onClick={handleShareProfile} className="flex-1">
                        <ArrowUpRight className="mr-2 h-4 w-4" /> Share Profile
                    </Button>
                    <Button onClick={handleStartConversation} variant="secondary" className="flex-1">
                        <MessageSquare className="mr-2 h-4 w-4" /> Message
                    </Button>
                </div>

                <Tabs defaultValue="posts" className="w-full">
                    <TabsList className="grid w-full grid-cols-1">
                        <TabsTrigger value="posts" className="gap-2"><Grid3x3 className="h-5 w-5" /> Posts</TabsTrigger>
                    </TabsList>
                    <TabsContent value="posts">
                        <PostGrid
                            posts={posts}
                            isLoading={postsLoading}
                            emptyState={
                                <div className="col-span-3 text-center py-16">
                                    <h3 className="text-xl font-headline text-primary">No Posts Yet</h3>
                                    <p className="text-muted-foreground">This user hasn't posted anything.</p>
                                </div>
                            }
                        />
                    </TabsContent>
                </Tabs>


            </div>
        </AppLayout>
    );
}

    
