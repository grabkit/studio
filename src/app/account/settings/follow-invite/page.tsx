
"use client";

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail, MessageSquare, Share } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import React, { useRef } from "react";

export default function FollowInvitePage() {
    const router = useRouter();
    const { toast } = useToast();
    const pageRef = useRef<HTMLDivElement>(null);

    const shareLink = "https://blur.app/join"; // Replace with your actual app link

    const handleBackNavigation = () => {
        if (pageRef.current) {
            pageRef.current.classList.remove('animate-slide-in-right');
            pageRef.current.classList.add('animate-slide-out-right');
            setTimeout(() => {
                router.back();
            }, 300);
        } else {
            router.back();
        }
    };

    const handleShare = async () => {
        const shareData = {
            title: 'Join me on Blur',
            text: `Join me on Blur, an anonymous social network. ${shareLink}`,
            url: shareLink,
        };
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(shareLink);
                toast({
                    title: "Link Copied",
                    description: "Invitation link copied to clipboard.",
                });
            }
        } catch (error: any) {
            // Silently ignore AbortError which occurs when the user cancels the share sheet
            if (error.name === 'AbortError') {
                return;
            }
            console.error("Error sharing:", error);
            toast({
                variant: "destructive",
                title: "Could not share",
                description: "There was an error trying to share the invitation link.",
            });
        }
    };

    return (
        <AppLayout showTopBar={false} showBottomNav={false}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={handleBackNavigation}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">Follow and invite friends</h2>
            </div>
            <div ref={pageRef} className="h-full bg-background animate-slide-in-right">
                <div className="pt-14 h-full overflow-y-auto">
                    <div className="divide-y border-y">
                        <button className="w-full flex items-center justify-between p-4 transition-colors hover:bg-accent cursor-pointer" onClick={handleShare}>
                            <div className="flex items-center space-x-4">
                                <Share className="h-5 w-5 text-muted-foreground" />
                                <span className="text-base">Invite friends via...</span>
                            </div>
                        </button>
                        <button className="w-full flex items-center justify-between p-4 transition-colors hover:bg-accent cursor-pointer" onClick={() => window.location.href = `mailto:?subject=Join me on Blur&body=Join me on Blur, an anonymous social network. ${shareLink}`}>
                            <div className="flex items-center space-x-4">
                                <Mail className="h-5 w-5 text-muted-foreground" />
                                <span className="text-base">Invite friends by email</span>
                            </div>
                        </button>
                        <button className="w-full flex items-center justify-between p-4 transition-colors hover:bg-accent cursor-pointer" onClick={() => window.location.href = `sms:?&body=Join me on Blur, an anonymous social network. ${shareLink}`}>
                            <div className="flex items-center space-x-4">
                                <MessageSquare className="h-5 w-5 text-muted-foreground" />
                                <span className="text-base">Invite friends by SMS</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </AppLayout>
    )
}
