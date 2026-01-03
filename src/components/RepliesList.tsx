

"use client";

import React, { useState, useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc, collectionGroup } from 'firebase/firestore';
import type { WithId } from '@/firebase/firestore/use-collection';
import type { Comment, Post } from '@/lib/types';
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

function Reply({ comment, post }: { comment: WithId<Comment>, post: WithId<Post> | null }) {
    const { user } = useFirebase();

    return (
         <div className="p-4 space-y-3">
             {post && (
                <div className="text-sm text-muted-foreground pl-10">
                   Replied to <Link href={`/profile/${post.authorId}`} className="text-primary hover:underline">{formatUserId(post.authorId)}</Link>
                </div>
             )}

            <div className="flex space-x-3">
                <Avatar className="h-8 w-8">
                    <AvatarFallback>{getInitials(formatUserId(comment.authorId))}</AvatarFallback>
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

function ReplyItemWrapper({ comment }: { comment: WithId<Comment> }) {
    const { firestore } = useFirebase();
    const [post, setPost] = useState<WithId<Post> | null>(null);
    
    useEffect(() => {
        if (!firestore) return;
        const postRef = doc(firestore, 'posts', comment.postId);
        getDoc(postRef).then(docSnap => {
            if (docSnap.exists()) {
                setPost({ id: docSnap.id, ...docSnap.data() } as WithId<Post>);
            }
        });
    }, [firestore, comment.postId]);
    
    if (!post) {
        // We show a skeleton, but it could be that the post was deleted.
        // A more robust solution might handle that case specifically.
        return <ReplySkeleton />;
    }

    return <Reply comment={comment} post={post} />;
}


export function RepliesList({ userId }: { userId: string }) {
    const { firestore } = useFirebase();
    const [replies, setReplies] = useState<WithId<Comment>[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!firestore || !userId) return;

        const fetchUserReplies = async () => {
            setIsLoading(true);
            try {
                // Step 1: Get all the post IDs for the user
                const postsQuery = query(collection(firestore, "posts"), where("authorId", "==", userId));
                const postsSnapshot = await getDocs(postsQuery);
                const postIds = postsSnapshot.docs.map(doc => doc.id);

                if (postIds.length === 0) {
                    setReplies([]);
                    setIsLoading(false);
                    return;
                }
                
                // Step 2: Query the 'comments' collection group for comments where postId is in the user's postIds
                // Firestore 'in' queries are limited to 30 items. We will handle it in batches.
                const allReplies: WithId<Comment>[] = [];
                for (let i = 0; i < postIds.length; i += 30) {
                    const batchIds = postIds.slice(i, i + 30);
                    // IMPORTANT: Removed orderBy from the query to avoid needing a composite index.
                    const repliesQuery = query(
                        collectionGroup(firestore, 'comments'),
                        where('postId', 'in', batchIds)
                    );
                    const repliesSnapshot = await getDocs(repliesQuery);
                    const batchReplies = repliesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WithId<Comment>));
                    allReplies.push(...batchReplies);
                }

                // Sort all collected replies by timestamp on the client-side
                allReplies.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());

                setReplies(allReplies);

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
                <p className="text-muted-foreground">This user hasn't received any replies.</p>
            </div>
        );
    }

    return (
        <div className="divide-y border-b">
            {replies.map(reply => (
                <ReplyItemWrapper key={reply.id} comment={reply} />
            ))}
        </div>
    );
}
