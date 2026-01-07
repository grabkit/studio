
"use client";

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SafetyAndSecurityPage() {
    const router = useRouter();

    return (
        <AppLayout showTopBar={false}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">Safety & Security</h2>
            </div>
            <div className="pt-14 p-4 space-y-4 prose prose-sm dark:prose-invert max-w-none">
                <h3 className="font-semibold text-lg">Keeping Your Account Secure</h3>
                
                <h4 className="font-semibold">1. Choose a Strong, Unique Password</h4>
                <p>
                    Use a password that is difficult to guess and not used for any other service. Combining letters, numbers, and symbols is a good practice.
                </p>

                <h4 className="font-semibold">2. Be Cautious of Phishing</h4>
                <p>
                   Blur will never ask for your password via email or direct message. Be wary of suspicious links or messages asking for your login information.
                </p>

                <h4 className="font-semibold">3. Protect Your Anonymity</h4>
                <p>
                    Avoid sharing any personally identifiable information (PII) such as your real name, address, phone number, or financial details in your posts, comments, or bio. The purpose of Blur is to be anonymous.
                </p>

                <h3 className="font-semibold text-lg mt-6">Interacting Safely with Others</h3>

                <h4 className="font-semibold">4. Use the Block and Report Features</h4>
                <p>
                    If a user is making you feel uncomfortable, you can block them to prevent them from interacting with you. If their behavior violates our Community Guidelines, please report them so our moderation team can take action.
                </p>

                <h4 className="font-semibold">5. Think Before You Click</h4>
                <p>
                    Be cautious of links shared by other users. While we try to scan for malicious links, it's always best to be careful.
                </p>
                
                 <h4 className="font-semibold">6. Manage Your Interactions</h4>
                <p>
                    Use the "Restrict" and "Mute" features to control your experience. Muting an account hides their posts from your feed, and restricting them means their comments on your posts will only be visible to you and them unless you approve them.
                </p>
            </div>
        </AppLayout>
    )
}
