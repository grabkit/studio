
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
                // Step 1: Get all posts created by the user.
                const userPostsQuery = query(collection(firestore, 'posts'), where('authorId', '==', userId));
                const postsSnapshot = await getDocs(userPostsQuery);

                if (postsSnapshot.empty) {
                    setReplies([]);
                    setIsLoading(false);
                    return;
                }

                const postsData: { [key: string]: Post } = {};
                postsSnapshot.forEach(doc => {
                    postsData[doc.id] = { id: doc.id, ...doc.data() } as Post;
                });
                const postIds = Object.keys(postsData);

                // Step 2: Fetch all comments where 'postId' is in the list of the user's post IDs.
                // Firestore 'in' queries are limited to 30 items per query.
                const MAX_COMMENTS_FETCH = 30;
                let allComments: WithId<Comment>[] = [];

                for (let i = 0; i < postIds.length; i += MAX_COMMENTS_FETCH) {
                    const chunk = postIds.slice(i, i + MAX_COMMENTS_FETCH);
                    if (chunk.length > 0) {
                        const commentsQuery = query(
                            collectionGroup(firestore, 'comments'),
                            where('postId', 'in', chunk)
                        );
                        const commentsSnapshot = await getDocs(commentsQuery);
                        const chunkComments = commentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WithId<Comment>));
                        allComments = [...allComments, ...chunkComments];
                    }
                }

                // Filter out replies made by the user themselves
                const receivedReplies = allComments.filter(comment => comment.authorId !== userId);
                
                // Sort replies by timestamp client-side
                receivedReplies.sort((a, b) => {
                    const timeA = a.timestamp?.toMillis() || 0;
                    const timeB = b.timestamp?.toMillis() || 0;
                    return timeB - timeA;
                });

                // Step 3: Combine comment data with original post data
                const fetchedReplies: WithId<ReplyItem>[] = receivedReplies.map(comment => {
                    const post = postsData[comment.postId];
                    return {
                        ...comment,
                        id: comment.id,
                        postContent: post?.content || "Original post content not found.",
                        postAuthorId: post?.authorId, // The author of the original post
                    };
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
                        <Link href={`/profile/${reply.authorId}`} className="text-primary hover:underline">{formatUserId(reply.authorId)}</Link> replied to your post: 
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
