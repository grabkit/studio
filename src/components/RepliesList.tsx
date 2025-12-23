
"use client";

import React, { useState, useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { collectionGroup, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import type { WithId } from '@/firebase/firestore/use-collection';
import type { Comment, Post, ReplyItem } from '@/lib/types';
import { Skeleton } from './ui/skeleton';
import { Avatar, AvatarFallback } from './ui/avatar';
import { getInitials, formatTimestamp } from '@/lib/utils';
import Link from 'next/link';

function ReplySkeleton() {
    return (
        <div className="flex space-x-3 p-4 border-b">
            <Avatar className="h-8 w-8">
                <Skeleton className="h-8 w-8 rounded-full" />
            </Avatar>
            <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
            </div>
        </div>
    )
}

const formatUserId = (uid: string | undefined) => {
    if (!uid) return "blur??????";
    return `blur${uid.substring(uid.length - 6)}`;
};

export function RepliesList({ userId }: { userId: string }) {
    const { firestore } = useFirebase();
    const [replies, setReplies] = useState<WithId<ReplyItem>[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!firestore || !userId) return;

        const fetchUserReplies = async () => {
            setIsLoading(true);
            try {
                // Step 1: Get all posts by the user
                const postsQuery = query(collection(firestore, 'posts'), where('authorId', '==', userId));
                const postsSnapshot = await getDocs(postsQuery);
                const postIds = postsSnapshot.docs.map(doc => doc.id);

                if (postIds.length === 0) {
                    setReplies([]);
                    setIsLoading(false);
                    return;
                }
                
                const postsData = Object.fromEntries(
                    postsSnapshot.docs.map(doc => [doc.id, doc.data() as Post])
                );

                // Step 2: Use a collection group query to get all comments on those posts
                const commentsQuery = query(
                    collectionGroup(firestore, 'comments'),
                    where('postId', 'in', postIds),
                    orderBy('timestamp', 'desc'),
                    limit(50)
                );
                
                const commentsSnapshot = await getDocs(commentsQuery);
                
                const fetchedReplies = commentsSnapshot.docs.map(doc => {
                    const comment = doc.data() as Comment;
                    const post = postsData[comment.postId];
                    return {
                        ...comment,
                        id: doc.id,
                        postContent: post?.content || "Original post content not found."
                    } as WithId<ReplyItem>;
                });

                setReplies(fetchedReplies);

            } catch (error) {
                console.error("Error fetching user replies:", error);
                // Note: This could be a missing index error. The console will provide a link to create it.
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserReplies();
    }, [firestore, userId]);


    if (isLoading) {
        return (
            <div className="divide-y">
                <ReplySkeleton />
                <ReplySkeleton />
                <ReplySkeleton />
            </div>
        )
    }

    if (replies.length === 0) {
        return (
            <div className="text-center py-16">
                <h3 className="text-xl font-headline text-primary">No Replies Yet</h3>
                <p className="text-muted-foreground">Replies to this user's posts will appear here.</p>
            </div>
        );
    }

    return (
        <div className="divide-y border-b">
            {replies.map(reply => (
                <div key={reply.id} className="p-4 space-y-3">
                    {/* Original Post Snippet */}
                    <div className="text-sm text-muted-foreground pl-10">
                        Replying to <Link href={`/post/${reply.postId}`} className="text-primary hover:underline">your post</Link>: 
                        <span className="italic"> "{reply.postContent.substring(0, 50)}..."</span>
                    </div>

                    {/* The Reply */}
                    <div className="flex space-x-3">
                        <Avatar className="h-8 w-8">
                            <AvatarFallback>{getInitials(reply.authorId)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center space-x-2">
                                    <Link href={`/profile/${reply.authorId}`} className="font-semibold text-sm hover:underline">
                                        {formatUserId(reply.authorId)}
                                    </Link>
                                    <span className="text-xs text-muted-foreground">
                                    {reply.timestamp
                                        ? formatTimestamp(reply.timestamp.toDate())
                                        : ""}
                                    </span>
                                </div>
                            </div>
                            <p className="text-sm text-foreground whitespace-pre-wrap">{reply.content}</p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
