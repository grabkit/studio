
"use client";

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function AboutBlurPage() {
    const router = useRouter();

    return (
        <AppLayout showTopBar={false} showBottomNav={false}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">About Blur</h2>
            </div>
            <motion.div 
                className="pt-14 h-full"
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
            >
                <div className="p-4 space-y-4 prose prose-sm dark:prose-invert max-w-none h-full overflow-y-auto">
                    <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    
                    <h3 className="font-semibold text-lg">Welcome to Blur</h3>
                    <p>
                        Blur is an anonymous social network designed for free and open expression. Our platform empowers you to share your thoughts, ideas, and creativity without the need to reveal your real-world identity. We believe that great ideas can come from anywhere, and everyone deserves a space to be heard.
                    </p>

                    <h4 className="font-semibold">Our Mission</h4>
                    <p>
                        Our mission is to foster a genuine community where content is king. By removing the focus from personal identity, we encourage conversations to revolve around the substance of what is shared, not who shared it. Whether you're posting a simple thought, running a poll, or engaging in a deep discussion, Blur is your canvas.
                    </p>
                    
                    <h4 className="font-semibold">Key Features</h4>
                    <ul>
                        <li><strong>Complete Anonymity:</strong> Your identity is protected by a randomly generated user ID.</li>
                        <li><strong>Rich Content:</strong> Share text posts, create polls, quote other users, and more.</li>
                        <li><strong>Voice Status:</strong> Share a 30-second audio clip as your status for 24 hours.</li>
                        <li><strong>Private & Secure:</strong> Engage in end-to-end encrypted voice and video calls, and private messaging.</li>
                        <li><strong>User Control:</strong> A full suite of privacy tools, including blocking, muting, and restricting accounts, puts you in control of your experience.</li>
                    </ul>

                    <h4 className="font-semibold">Our Commitment to Safety</h4>
                    <p>
                        Anonymity is a powerful tool, and we are committed to ensuring it is used responsibly. We have strict Community Guidelines and robust reporting features to maintain a safe and respectful environment for everyone.
                    </p>
                    
                    <p>
                        Thank you for being a part of the Blur community. Let your voice be heard.
                    </p>
                </div>
            </motion.div>
        </AppLayout>
    )
}
