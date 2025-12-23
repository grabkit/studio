
"use client";

import React, { useState, useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { collectionGroup, query, where, getDocs, orderBy, limit, collection } from 'firebase/firestore';
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
                // Step 1: Get all comments by the user.
                // orderBy is removed to prevent needing a composite index. Sorting will be done client-side.
                const commentsByUserQuery = query(
                    collectionGroup(firestore, 'comments'), 
                    where('authorId', '==', userId),
                    limit(50)
                );

                const commentsSnapshot = await getDocs(commentsByUserQuery);
                if (commentsSnapshot.empty) {
                    setReplies([]);
                    setIsLoading(false);
                    return;
                }
                
                const userComments = commentsSnapshot.docs.map(doc => doc.data() as Comment);
                
                // Sort comments client-side
                userComments.sort((a, b) => {
                    const timeA = a.timestamp?.toMillis() || 0;
                    const timeB = b.timestamp?.toMillis() || 0;
                    return timeB - timeA;
                });

                const postIds = [...new Set(userComments.map(comment => comment.postId))];
                
                // Step 2: Fetch the corresponding posts
                const postsData: { [key: string]: Post } = {};
                // Firestore 'in' query supports up to 30 elements
                const MAX_POSTS_FETCH = 30;
                if (postIds.length > 0) {
                    for (let i = 0; i < postIds.length; i += MAX_POSTS_FETCH) {
                        const chunk = postIds.slice(i, i + MAX_POSTS_FETCH);
                        if (chunk.length > 0) {
                           const postsQuery = query(collection(firestore, 'posts'), where('id', 'in', chunk));
                            const postsSnapshot = await getDocs(postsQuery);
                            postsSnapshot.forEach(doc => {
                                postsData[doc.id] = doc.data() as Post;
                            });
                        }
                    }
                }
                
                const fetchedReplies = userComments.map(comment => {
                    const post = postsData[comment.postId];
                    const postAuthor = post?.authorId;
                    return {
                        ...comment,
                        id: comment.id,
                        postContent: post?.content || "Original post content not found.",
                        postAuthorId: postAuthor,
                    } as WithId<ReplyItem>;
                });

                setReplies(fetchedReplies);

            } catch (error) {
                console.error("Error fetching user replies:", error);
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
                <p className="text-muted-foreground">This user hasn't replied to any posts.</p>
            </div>
        );
    }

    return (
        <div className="divide-y border-b">
            {replies.map(reply => (
                <div key={reply.id} className="p-4 space-y-3">
                    {/* Original Post Snippet */}
                    <div className="text-sm text-muted-foreground pl-10">
                        Replying to <Link href={`/profile/${reply.postAuthorId}`} className="text-primary hover:underline">{formatUserId(reply.postAuthorId)}'s post</Link>: 
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
                            <Link href={`/post/${reply.postId}`}>
                                <p className="text-sm text-foreground whitespace-pre-wrap hover:bg-secondary/50 rounded p-1 -m-1">{reply.content}</p>
                            </Link>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
