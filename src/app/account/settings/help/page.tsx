
"use client";

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, MessageSquareQuote, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from 'next/link';

export default function HelpPage() {
    const router = useRouter();

    return (
        <AppLayout showTopBar={false}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">Help Center</h2>
            </div>
            <div className="pt-14 p-4 space-y-4">
                <Link href="#" className="block p-4 border rounded-lg hover:bg-accent">
                    <div className="flex items-center space-x-4">
                        <MessageSquareQuote className="h-8 w-8 text-primary"/>
                        <div>
                            <h3 className="font-semibold">FAQs</h3>
                            <p className="text-sm text-muted-foreground">Find answers to common questions.</p>
                        </div>
                    </div>
                </Link>
                 <Link href="#" className="block p-4 border rounded-lg hover:bg-accent">
                    <div className="flex items-center space-x-4">
                        <BookOpen className="h-8 w-8 text-primary"/>
                        <div>
                            <h3 className="font-semibold">Community Guidelines</h3>
                            <p className="text-sm text-muted-foreground">Learn about our rules and policies.</p>
                        </div>
                    </div>
                </Link>
                 <Link href="#" className="block p-4 border rounded-lg hover:bg-accent">
                    <div className="flex items-center space-x-4">
                        <ShieldCheck className="h-8 w-8 text-primary"/>
                        <div>
                            <h3 className="font-semibold">Safety & Security</h3>
                            <p className="text-sm text-muted-foreground">Tips for staying safe on the platform.</p>
                        </div>
                    </div>
                </Link>
            </div>
        </AppLayout>
    )
}
