
"use client";

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BookOpen, MessageSquareQuote, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { motion } from "framer-motion";

export default function HelpPage() {
    const router = useRouter();

    return (
        <AppLayout showTopBar={false} showBottomNav={false}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">Help Center</h2>
            </div>
            <motion.div 
                className="pt-14 h-full"
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
            >
                <div className="h-full overflow-y-auto">
                    <div>
                        <Link href="/account/settings/community-guidelines" className="block px-4 py-3 hover:bg-accent">
                            <div className="flex items-center space-x-4">
                                <BookOpen className="h-8 w-8 text-primary"/>
                                <div>
                                    <h3 className="font-semibold">Community Guidelines</h3>
                                    <p className="text-sm text-muted-foreground">Learn about our rules and policies.</p>
                                </div>
                            </div>
                        </Link>
                        <Link href="/account/settings/help/report-problem" className="block px-4 py-3 hover:bg-accent cursor-pointer">
                            <div className="flex items-center space-x-4">
                                <MessageSquareQuote className="h-8 w-8 text-primary"/>
                                <div>
                                    <h3 className="font-semibold">Report a Problem</h3>
                                    <p className="text-sm text-muted-foreground">Let us know about a bug or issue.</p>
                                </div>
                            </div>
                        </Link>
                        <Link href="/account/settings/help/safety" className="block px-4 py-3 hover:bg-accent cursor-pointer">
                            <div className="flex items-center space-x-4">
                                <ShieldCheck className="h-8 w-8 text-primary"/>
                                <div>
                                    <h3 className="font-semibold">Safety & Security</h3>
                                    <p className="text-sm text-muted-foreground">Tips for staying safe on Blur.</p>
                                </div>
                            </div>
                        </Link>
                    </div>
                </div>
            </motion.div>
        </AppLayout>
    )
}
