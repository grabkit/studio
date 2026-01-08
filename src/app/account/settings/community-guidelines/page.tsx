
"use client";

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef } from "react";

export default function CommunityGuidelinesPage() {
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
                    <h2 className="text-lg font-bold mx-auto -translate-x-4">Community Guidelines</h2>
                </div>
                <div className="pt-14 p-4 space-y-4 prose prose-sm dark:prose-invert max-w-none">
                    <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    
                    <p>
                        Welcome to Blur! Our goal is to create a safe, anonymous space where people can express themselves freely. To achieve this, we rely on everyone to follow these guidelines.
                    </p>

                    <h4 className="font-semibold">1. Be Respectful, Even When Anonymous</h4>
                    <p>
                        Anonymity is not a license to be cruel. Treat others as you would like to be treated. Harassment, bullying, hate speech, or threats of violence will not be tolerated and will result in immediate account action.
                    </p>
                    
                    <h4 className="font-semibold">2. No Illegal Content or Activity</h4>
                    <p>
                        Do not use Blur to promote, organize, or engage in any illegal activity. This includes sharing illegal content, buying or selling illicit goods and services, or glorifying self-harm. We will cooperate with law enforcement when legally required.
                    </p>

                    <h4 className="font-semibold">3. Protect Your Anonymity and Respect Others'</h4>
                    <p>
                        Do not attempt to uncover the real-world identity of other users. Do not post personally identifiable information (PII) about yourself or others, such as full names, addresses, phone numbers, or financial information.
                    </p>

                    <h4 className="font-semibold">4. No Spam or Platform Manipulation</h4>
                    <p>
                        Do not spam other users with unsolicited messages, posts, or comments. Do not use bots or other automated means to artificially inflate engagement or disrupt the platform.
                    </p>

                    <h4 className="font-semibold">5. No Impersonation</h4>
                    <p>
                        Do not impersonate an individual or entity in a misleading or deceptive manner. While parody accounts are allowed, they must be clearly marked as such in the profile bio.
                    </p>

                    <h4 className="font-semibold">6. Content Moderation</h4>
                    <p>
                        We use a combination of automated systems and user reports to identify and review content that violates our guidelines. You can report any user or content that you believe violates these rules using the in-app reporting tools.
                    </p>
                    
                    <h4 className="font-semibold">Enforcement</h4>
                    <p>
                        Violating these guidelines may result in a range of actions, including content removal, a warning, temporary account suspension, or a permanent ban, depending on the severity and frequency of the violation.
                    </p>
                    
                    <p>
                        These guidelines are a living document and may be updated as our community evolves. Thank you for being a part of Blur and helping us keep it a welcoming space for everyone.
                    </p>
                </div>
            </AppLayout>
        </div>
    )
}
