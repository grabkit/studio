
"use client";

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight, FileText, Shield, Library } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { useRef } from "react";

function SettingsItem({ href, label, icon: Icon }: { href: string, label: string, icon: React.ElementType }) {
    return (
        <Link href={href} className="flex items-center justify-between p-4 transition-colors hover:bg-accent cursor-pointer">
            <div className="flex items-center space-x-4">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <span className="text-base">{label}</span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>
    )
}

export default function AboutPage() {
    const router = useRouter();
    const pageRef = useRef<HTMLDivElement>(null);

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

    return (
        <AppLayout showTopBar={false} showBottomNav={false}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={handleBackNavigation}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">About</h2>
            </div>
            <div ref={pageRef} className="h-full bg-background animate-slide-in-right">
                <div className="pt-14 h-full overflow-y-auto flex flex-col">
                    <div>
                        <SettingsItem href="/account/settings/terms" label="Terms of Service" icon={FileText} />
                        <SettingsItem href="/account/settings/privacy" label="Privacy Policy" icon={Shield} />
                        <SettingsItem href="/account/settings/licenses" label="Open Source Licenses" icon={Library} />
                    </div>
                    <div className="text-center mt-auto pb-4">
                        <h1 className="text-2xl font-bold font-headline">Blur</h1>
                        <p className="text-muted-foreground">Version 1.0.0</p>
                    </div>
                </div>
            </div>
        </AppLayout>
    )
}
