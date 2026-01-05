

"use client";

import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Repeat, MessageSquareQuote } from "lucide-react";
import type { Post } from '@/lib/types';
import { WithId } from '@/firebase/firestore/use-collection';
import { useFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { doc, setDoc, serverTimestamp, collection, runTransaction, increment } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

interface RepostSheetProps {
    post: WithId<Post>;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function RepostSheet({ post, isOpen, onOpenChange }: RepostSheetProps) {
    const { user, firestore } = useFirebase();
    const router = useRouter();
    const { toast } = useToast();

    const handleSimpleRepost = async () => {
        if (!user || !firestore) {
            toast({ variant: "destructive", title: "You must be logged in to repost." });
            return;
        }
        onOpenChange(false);

        const newPostRef = doc(collection(firestore, 'posts'));
        const originalPostRef = doc(firestore, 'posts', post.id);

        const newPostData: Partial<Post> = {
            id: newPostRef.id,
            authorId: user.uid,
            type: 'repost',
            repostOf: post.id,
            timestamp: serverTimestamp(),
            // These are non-interactive fields for a repost wrapper
            likes: [],
            likeCount: 0,
            commentCount: 0,
            repostCount: 0,
            commentsAllowed: false,
        };

        try {
             await runTransaction(firestore, async (transaction) => {
                // Increment repostCount on original post
                transaction.update(originalPostRef, { repostCount: increment(1) });
                // Create the new repost document
                transaction.set(newPostRef, newPostData);
            });

            toast({ title: "Reposted!" });

        } catch (error) {
             console.error("Repost transaction failed:", error);
            const permissionError = new FirestorePermissionError({
                path: newPostRef.path,
                operation: 'create',
                requestResourceData: newPostData,
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not repost.'})
        }
    }
    
    const handleQuotePost = () => {
        router.push(`/post?quotePostId=${post.id}`);
        onOpenChange(false);
    }


    return (
        <Sheet open={isOpen} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="rounded-t-2xl">
                 <SheetHeader className="sr-only">
                    <SheetTitle>Repost Options</SheetTitle>
                    <SheetDescription>Choose to either repost directly or quote this post with your own comments.</SheetDescription>
                </SheetHeader>
                <div className="grid gap-3 py-4">
                    <Button variant="ghost" className="justify-start gap-3 text-base h-14" onClick={handleSimpleRepost}>
                        <Repeat />
                        <span className="font-bold">Repost</span>
                    </Button>
                    <Button variant="ghost" className="justify-start gap-3 text-base h-14" onClick={handleQuotePost}>
                        <MessageSquareQuote />
                        <span className="font-bold">Quote</span>
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    )
}
