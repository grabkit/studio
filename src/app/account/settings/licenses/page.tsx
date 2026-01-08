
"use client";

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef } from "react";

const licenses = [
    { name: "React", license: "MIT License" },
    { name: "Next.js", license: "MIT License" },
    { name: "Tailwind CSS", license: "MIT License" },
    { name: "ShadCN UI", license: "MIT License" },
    { name: "Lucide React", license: "ISC License" },
    { name: "Firebase", license: "Apache License 2.0" },
];

export default function LicensesPage() {
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
        <div ref={pageRef} className="h-full bg-background animate-slide-in-right">
            <AppLayout showTopBar={false} showBottomNav={false}>
                <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                    <Button variant="ghost" size="icon" onClick={handleBackNavigation}>
                        <ArrowLeft />
                    </Button>
                    <h2 className="text-lg font-bold mx-auto -translate-x-4">Open Source Licenses</h2>
                </div>
                <div className="pt-14">
                    <p className="p-4 text-sm text-muted-foreground">
                        This application is built using the following open source software. We are grateful to the community for these amazing tools.
                    </p>
                    <div className="divide-y border-y">
                        {licenses.map(lib => (
                            <div key={lib.name} className="p-4">
                                <p className="font-semibold">{lib.name}</p>
                                <p className="text-sm text-muted-foreground">{lib.license}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </AppLayout>
        </div>
    )
}
