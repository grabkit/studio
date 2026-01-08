"use client";

import Image from "next/image";
import type { LinkMetadata } from "@/lib/types";

export function LinkPreviewCard({ metadata }: { metadata: LinkMetadata }) {
    const getDomainName = (url: string) => {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch (e) {
            return '';
        }
    };

    return (
        <a href={metadata.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden bg-background/50 hover:bg-background/80 transition-colors">
            {metadata.imageUrl && (
                <div className="relative h-32 bg-secondary">
                    <Image
                        src={metadata.imageUrl}
                        alt={metadata.title || 'Link preview'}
                        fill
                        className="object-cover"
                    />
                </div>
            )}
            <div className="p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{getDomainName(metadata.url)}</p>
                <p className="font-semibold text-sm truncate mt-0.5">{metadata.title || metadata.url}</p>
                {metadata.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{metadata.description}</p>
                )}
            </div>
        </a>
    )
}
