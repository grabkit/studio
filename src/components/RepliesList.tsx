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
    const { firestore } = useFirebase();
    const [replies, setReplies] = useState<WithId<Comment>[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!firestore || !userId) return;

        const fetchUserReplies = async () => {
            setIsLoading(true);
            try {
                // Use a simpler query without ordering to avoid needing a composite index.
                // We will sort the results on the client-side.
                const commentsQuery = query(
                    collectionGroup(firestore, 'comments'),
                    where('authorId', '==', userId),
                    limit(50)
                );

                const querySnapshot = await getDocs(commentsQuery);
                let fetchedReplies = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WithId<Comment>));
                
                // Sort the replies by timestamp on the client side
                fetchedReplies.sort((a, b) => {
                    const timeA = a.timestamp?.toMillis() || 0;
                    const timeB = b.timestamp?.toMillis() || 0;
                    return timeB - timeA;
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
                <ReplyItemWrapper key={reply.id} comment={reply} />
            ))}
        </div>
    );
}
