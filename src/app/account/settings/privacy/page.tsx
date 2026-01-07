
"use client";

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function PrivacyPolicyPage() {
    const router = useRouter();

    return (
        <AppLayout showTopBar={false}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">Privacy Policy</h2>
            </div>
            <div className="pt-14 p-4 space-y-4">
                <h3 className="text-xl font-bold">Privacy Policy</h3>
                <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
                <p>
                    This is a placeholder for your Privacy Policy. It's important to be transparent with your users about what data you collect, why you collect it, and how you use it.
                </p>
                <h4 className="font-semibold">Information We Collect</h4>
                <p>
                    Detail the types of information you collect, such as user-provided information (email, name), and automatically collected information (usage data, device information).
                </p>
                <h4 className="font-semibold">How We Use Your Information</h4>
                <p>
                    Explain the purposes for using the collected data, for example, to provide and maintain the service, to notify you about changes, to provide customer support, etc.
                </p>
                <h4 className="font-semibold">Data Security</h4>
                <p>
                    Describe the measures you take to protect your users' data.
                </p>
            </div>
        </AppLayout>
    )
}
