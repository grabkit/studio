

"use client";

import React, { useState, useEffect } from 'react';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, orderBy, limit, doc, getDoc, collectionGroup } from 'firebase/firestore';
import type { WithId } from '@/firebase/firestore/use-collection';
import { useCollection } from '@/firebase/firestore/use-collection';
import type { Comment, Post } from '@/lib/types';
import { Skeleton } from './ui/skeleton';
import { Avatar, AvatarFallback } from './ui/avatar';
import { getAvatar, formatTimestamp, formatUserId } from '@/lib/utils';
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

function Reply({ comment, post }: { comment: WithId<Comment>, post: WithId<Post> | null }) {
    const { user } = useFirebase();

    return (
         <div className="p-4 space-y-3 border-b">
             {post && (
                <div className="text-sm text-muted-foreground pl-10">
                   Replied to <Link href={`/profile/${post.authorId}`} className="text-primary hover:underline">{formatUserId(post.authorId)}</Link>
                </div>
             )}

            <div className="flex space-x-3">
                <Avatar className="h-8 w-8">
                    <AvatarFallback>{getAvatar({id: comment.authorId})}</AvatarFallback>
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
    const [isLoading, setIsLoading] = useState(true);
    
    useEffect(() => {
        if (!firestore) return;
        setIsLoading(true);
        const postRef = doc(firestore, 'posts', comment.postId);
        getDoc(postRef).then(docSnap => {
            if (docSnap.exists()) {
                setPost({ id: docSnap.id, ...docSnap.data() } as WithId<Post>);
            }
            setIsLoading(false);
        });
    }, [firestore, comment.postId]);
    
    if (isLoading) {
        return <ReplySkeleton />;
    }

    // Don't render if the original post was deleted
    if (!post) {
        return null;
    }

    return <Reply comment={comment} post={post} />;
}


export function RepliesList({ userId }: { userId: string }) {
    const { firestore } = useFirebase();
    
    const repliesQuery = useMemoFirebase(() => {
        if (!firestore || !userId) return null;
        // Fetch replies directly from the user's 'replies' subcollection
        return query(
            collection(firestore, 'users', userId, 'replies'),
            orderBy('timestamp', 'desc'),
            limit(50)
        );
    }, [firestore, userId]);
    
    const { data: replies, isLoading } = useCollection<Comment>(repliesQuery);

    if (isLoading) {
        return (
            <div className="divide-y">
                <ReplySkeleton />
                <ReplySkeleton />
                <ReplySkeleton />
            </div>
        )
    }

    if (replies === null || replies.length === 0) {
        return (
            <div className="text-center py-16">
                <h3 className="text-xl font-headline text-primary">No Replies Yet</h3>
                <p className="text-muted-foreground">Replies to this user's posts will appear here.</p>
            </div>
        );
    }

    return (
        <div className="divide-y">
            {replies.map(reply => (
                <ReplyItemWrapper key={reply.id} comment={reply} />
            ))}
        </div>
    );
}

    