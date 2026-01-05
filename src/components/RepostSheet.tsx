

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

interface RepostSheetProps {
    post: WithId<Post>;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function RepostSheet({ post, isOpen, onOpenChange }: RepostSheetProps) {
    const { user, firestore } = useFirebase();
    const router = useRouter();
    const { toast } = useToast();

    const handleSimpleRepost = () => {
        // TODO: Implement simple repost logic
        console.log("Simple Repost Clicked for post:", post.id);
        toast({ title: "Coming Soon!", description: "Repost functionality will be implemented soon." });
        onOpenChange(false);
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
