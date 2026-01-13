
"use client";

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

export default function ContactPage() {
    const router = useRouter();

    return (
        <AppLayout showTopBar={false} showBottomNav={false}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">Contact Us</h2>
            </div>
            <motion.div 
                className="pt-14 h-full"
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
            >
                <div className="p-4 space-y-4 prose prose-sm dark:prose-invert max-w-none h-full overflow-y-auto">
                    <h3 className="font-semibold text-lg">Get in Touch</h3>
                    <p>
                        Have a question, feedback, or need support? We're here to help. The best way to reach us is by email.
                    </p>
                    
                    <div className="flex items-center gap-4">
                         <Mail className="h-6 w-6 text-primary"/>
                        <div>
                             <p className="font-semibold">Email Us</p>
                             <a href="mailto:blur.workspace@gmail.com" className="text-primary hover:underline not-prose">blur.workspace@gmail.com</a>
                        </div>
                    </div>

                    <p>
                        We do our best to respond to all inquiries within 24-48 hours. Thank you for being a part of the Blur community!
                    </p>
                </div>
            </motion.div>
        </AppLayout>
    )
}
