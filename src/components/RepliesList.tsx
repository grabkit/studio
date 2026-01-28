'use client';

import React, { useState, useEffect } from 'react';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, orderBy, limit, doc, where, documentId } from 'firebase/firestore';
import type { WithId } from '@/firebase/firestore/use-collection';
import type { Comment, Post } from '@/lib/types';
import { Skeleton } from './ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { getAvatar, formatTimestamp, formatUserId } from '@/lib/utils.tsx';
import Link from 'next/link';


function ReplySkeleton() {
    return (
        <div className="flex space-x-3 p-4">
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

function Reply({ comment, post }: { comment: WithId<Comment>, post: WithId<Post> | null }) {
    const { user } = useFirebase();
    const avatar = getAvatar({id: comment.authorId});
    const isAvatarUrl = avatar.startsWith('http');

    return (
         <div className="p-4 space-y-3">
             {post && (
                <div className="text-sm text-muted-foreground pl-10">
                   Replied to <Link href={`/profile/${post.authorId}`} className="text-primary hover:underline">{formatUserId(post.authorId)}</Link>
                </div>
             )}

            <div className="flex space-x-3">
                <Avatar className="h-8 w-8">
                    <AvatarImage src={isAvatarUrl ? avatar : undefined} alt={String(formatUserId(comment.authorId))} />
                    <AvatarFallback>{!isAvatarUrl ? avatar : ''}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                            <Link href={`/profile/${comment.authorId}`} className="font-semibold text-sm text-foreground hover:underline">
                                {formatUserId(comment.authorId)}
                            </Link>
                            <span>•</span>
                            <span>
                            {comment.timestamp
                                ? formatTimestamp(comment.timestamp.toDate())
                                : ""}
                            </span>
                        </div>
                    </div>
                    <Link href={`/post/${comment.postId}`}>
                        <p className="text-sm text-foreground whitespace-pre-wrap hover:bg-secondary/50 rounded p-1 -m-1">{comment.content}</p>
                    </Link>
                </div>
            </div>
        </div>
    )
}


export function RepliesList({ userId }: { userId: string }) {
    const { firestore } = useFirebase();
    const [hydratedReplies, setHydratedReplies] = useState<{ comment: WithId<Comment>, post: WithId<Post> }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        if (!firestore || !userId) {
            setIsLoading(false);
            return;
        }

        const fetchRepliesAndPosts = async () => {
            setIsLoading(true);
            
            const repliesQuery = query(
                collection(firestore, 'users', userId, 'replies'),
                orderBy('timestamp', 'desc'),
                limit(50)
            );
            const repliesSnapshot = await getDocs(repliesQuery);
            const replies = repliesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WithId<Comment>));

            if (replies.length === 0) {
                setHydratedReplies([]);
                setIsLoading(false);
                return;
            }

            const postIds = [...new Set(replies.map(r => r.postId))];
            
            const postPromises = [];
            for (let i = 0; i < postIds.length; i += 30) {
                const chunk = postIds.slice(i, i + 30);
                const postsQuery = query(collection(firestore, 'posts'), where(documentId(), 'in', chunk));
                postPromises.push(getDocs(postsQuery));
            }

            const postSnapshots = await Promise.all(postPromises);
            const postsMap = new Map<string, WithId<Post>>();
            postSnapshots.forEach(snapshot => {
                snapshot.docs.forEach(doc => {
                    postsMap.set(doc.id, { id: doc.id, ...doc.data() } as WithId<Post>);
                });
            });

            const finalHydratedReplies = replies
                .map(comment => ({
                    comment,
                    post: postsMap.get(comment.postId)
                }))
                .filter((item): item is { comment: WithId<Comment>; post: WithId<Post>; } => !!item.post);

            setHydratedReplies(finalHydratedReplies);
            setIsLoading(false);
        };

        fetchRepliesAndPosts();

    }, [firestore, userId]);


    if (isLoading) {
        return (
            <div>
                <ReplySkeleton />
                <ReplySkeleton />
                <ReplySkeleton />
            </div>
        )
    }

    if (hydratedReplies.length === 0) {
        return (
            <div className="text-center py-16">
                <h3 className="text-xl font-headline text-foreground">No Replies Yet</h3>
                <p className="text-muted-foreground mt-2">Replies to this user's posts will appear here.</p>
            </div>
        );
    }

    return (
        <div className="divide-y">
            {hydratedReplies.map(({ comment, post }) => (
                <Reply key={comment.id} comment={comment} post={post} />
            ))}
        </div>
    );
}