
"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { QuotedPost } from "@/lib/types";
import { formatTimestamp, getAvatar, formatUserId } from "@/lib/utils";
import Link from "next/link";

export function QuotedPostCard({ post }: { post: QuotedPost }) {
    if (!post) return null;

    return (
        <Link href={`/post/${post.id}`} className="block border rounded-xl p-3 hover:bg-secondary/50 transition-colors">
            <div className="flex items-center space-x-2 mb-2">
                <Avatar className="h-5 w-5">
                    <AvatarFallback className="text-xs">{post.authorAvatar}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-semibold">{post.authorName}</span>
                {post.timestamp && (
                    <span className="text-xs text-muted-foreground">· {formatTimestamp(post.timestamp.toDate())}</span>
                )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-4">{post.content}</p>
        </Link>
    )
}
