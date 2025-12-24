
"use client";

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from 'next/link';

export default function AboutPage() {
    const router = useRouter();

    return (
        <AppLayout showTopBar={false}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">About</h2>
            </div>
            <div className="pt-14 p-4 space-y-6">
                <div className="text-center">
                    <h1 className="text-2xl font-bold font-headline">Blur</h1>
                    <p className="text-muted-foreground">Version 1.0.0</p>
                </div>
                 <div className="divide-y border-y">
                     <Link href="#" className="flex justify-between items-center p-4 hover:bg-accent">
                        <span>Terms of Service</span>
                    </Link>
                     <Link href="#" className="flex justify-between items-center p-4 hover:bg-accent">
                        <span>Privacy Policy</span>
                    </Link>
                     <Link href="#" className="flex justify-between items-center p-4 hover:bg-accent">
                        <span>Open Source Licenses</span>
                    </Link>
                 </div>
            </div>
        </AppLayout>
    )
}
