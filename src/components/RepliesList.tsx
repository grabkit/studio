

"use client";

import React, { useState, useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { collectionGroup, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import type { WithId } from '@/firebase/firestore/use-collection';
import type { Comment, Post, ReplyItem } from '@/lib/types';
import { Skeleton } from './ui/skeleton';
import { Avatar, AvatarFallback } from './ui/avatar';
import { getInitials, formatTimestamp } from '@/lib/utils';
import Link from 'next/link';
import { useDoc } from '@/firebase/firestore/use-doc';
import { useCollection } from '@/firebase/firestore/use-collection';


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
                   You replied to <Link href={`/profile/${post.authorId}`} className="text-primary hover:underline">{formatUserId(post.authorId)}</Link>
                </div>
             )}

            <div className="flex space-x-3">
                <Avatar className="h-8 w-8">
                    <AvatarFallback>{getInitials(user?.displayName)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                            <span className="font-semibold text-sm hover:underline">
                                {formatUserId(comment.authorId)}
                            </span>
                            <span className="text-xs text-muted-foreground">
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
        return <ReplySkeleton />;
    }

    return <Reply comment={comment} post={post} />;
}


export function RepliesList({ userId }: { userId: string }) {
    const { firestore, useMemoFirebase } = useFirebase();
    
    const commentsQuery = useMemoFirebase(() => {
        if (!firestore || !userId) return null;
        return query(
            collectionGroup(firestore, 'comments'),
            where('postAuthorId', '==', userId),
            orderBy('timestamp', 'desc'),
            limit(50)
        );
    }, [firestore, userId]);
    
    const { data: replies, isLoading } = useCollection<Comment>(commentsQuery);


    if (isLoading) {
        return (
            <div className="divide-y">
                <ReplySkeleton />
                <ReplySkeleton />
                <ReplySkeleton />
            </div>
        )
    }

    if (!replies || replies.length === 0) {
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
