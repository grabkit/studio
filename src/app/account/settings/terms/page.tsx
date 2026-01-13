
"use client";

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function TermsOfServicePage() {
    const router = useRouter();

    return (
        <AppLayout showTopBar={false} showBottomNav={false}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">Terms of Service</h2>
            </div>
            <motion.div 
                className="pt-14 h-full"
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
            >
                <div className="h-full overflow-y-auto">
                    <div className="p-4 space-y-4 prose prose-sm dark:prose-invert max-w-none">
                        <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        
                        <h4 className="font-semibold">1. Acceptance of Terms</h4>
                        <p>
                            By creating an account and using the Blur application (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of the terms, you may not access the Service.
                        </p>

                        <h4 className="font-semibold">2. Description of Service</h4>
                        <p>
                            Blur is an anonymous social media platform that allows users to share content, interact with others, and communicate through features like posts, comments, direct messages, and voice/video calls, all under a pseudonym (your "Blur ID").
                        </p>
                        
                        <h4 className="font-semibold">3. User Accounts</h4>
                        <p>
                            You are responsible for safeguarding the password that you use to access the Service and for any activities or actions under your password. You agree not to disclose your password to any third party. You must notify us immediately upon becoming aware of any breach of security or unauthorized use of your account.
                        </p>
                        
                        <h4 className="font-semibold">4. User Content</h4>
                        <p>
                            Our Service allows you to post, link, store, share, and otherwise make available certain information, text, graphics, audio, videos, or other material ("Content"). You are solely responsible for the Content that you post on or through the Service, including its legality, reliability, and appropriateness.
                        </p>
                        <p>
                            By posting Content, you grant us the right and license to use, modify, publicly perform, publicly display, reproduce, and distribute such Content on and through the Service. You retain any and all of your rights to any Content you submit.
                        </p>

                        <h4 className="font-semibold">5. Prohibited Activities</h4>
                        <p>You agree not to engage in any of the following prohibited activities:</p>
                        <ul>
                            <li>Impersonating another person or entity, or falsely claiming an affiliation with any person or entity.</li>
                            <li>Posting or transmitting any Content that is illegal, threatening, defamatory, obscene, or hateful.</li>
                            <li>Engaging in any form of harassment, bullying, or stalking.</li>
                            <li>Spamming or sending unsolicited messages to other users.</li>
                            <li>Using the Service for any illegal purpose or in violation of any local, state, national, or international law.</li>
                            <li>Attempting to interfere with the proper functioning of the Service.</li>
                        </ul>

                        <h4 className="font-semibold">6. Moderation and Enforcement</h4>
                        <p>
                            We reserve the right, but not the obligation, to monitor and review Content and user activity. We may remove any Content or suspend/ban accounts that we determine, in our sole discretion, violate these Terms or our Community Guidelines. You can report Content or users you believe violate our policies through the reporting tools in the app.
                        </p>
                        
                        <h4 className="font-semibold">7. Termination</h4>
                        <p>
                            We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms. Upon termination, your right to use the Service will immediately cease.
                        </p>
                        
                        <h4 className="font-semibold">8. Disclaimers and Limitation of Liability</h4>
                        <p>
                            The Service is provided on an "AS IS" and "AS AVAILABLE" basis. We do not warrant that the service will be uninterrupted, secure, or error-free. In no event shall Blur, nor its directors or employees, be liable for any indirect, incidental, special, consequential or punitive damages.
                        </p>
                        
                        <h4 className="font-semibold">9. Changes to Terms</h4>
                        <p>
                            We reserve the right to modify these Terms at any time. We will provide notice of changes by posting the new Terms on this page. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.
                        </p>

                        <h4 className="font-semibold">Contact Us</h4>
                        <p>If you have any questions about these Terms of Service, you can contact us at <a href="mailto:support@blurapp.in" className="text-primary hover:underline">support@blurapp.in</a>.</p>
                    </div>
                </div>
            </motion.div>
        </AppLayout>
    )
}
