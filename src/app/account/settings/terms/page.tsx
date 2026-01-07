
"use client";

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function TermsOfServicePage() {
    const router = useRouter();

    return (
        <AppLayout showTopBar={false}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">Terms of Service</h2>
            </div>
            <div className="pt-14 p-4 space-y-4">
                <h3 className="text-xl font-bold">Terms of Service</h3>
                <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
                <p>
                    This is a placeholder for your Terms of Service. This agreement sets the rules for using your app.
                </p>
                <h4 className="font-semibold">1. Acceptance of Terms</h4>
                <p>
                    By accessing or using the Service you agree to be bound by these Terms. If you disagree with any part of the terms then you may not access the Service.
                </p>
                <h4 className="font-semibold">2. User Accounts</h4>
                <p>
                    When you create an account with us, you must provide us with information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms.
                </p>
                <h4 className="font-semibold">3. Content</h4>
                <p>
                    Our Service allows you to post, link, store, share and otherwise make available certain information, text, graphics, videos, or other material. You are responsible for the Content that you post on or through the Service.
                </p>
            </div>
        </AppLayout>
    )
}
