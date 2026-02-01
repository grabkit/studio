'use client';

import { useFirebase } from "@/firebase";
import AppLayout from "@/components/AppLayout";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function SyncPage() {
    const { findOrStartSyncCall, activeSyncCall, leaveSyncQueue } = useFirebase();
    const router = useRouter();
    const isRedirecting = useRef(false);

    useEffect(() => {
        isRedirecting.current = false;
        findOrStartSyncCall();

        return () => {
            if (!isRedirecting.current) {
                leaveSyncQueue();
            }
        };
    }, [findOrStartSyncCall, leaveSyncQueue]);

    useEffect(() => {
        if (activeSyncCall) {
            isRedirecting.current = true;
            router.replace(`/sync/${activeSyncCall.id}`);
        }
    }, [activeSyncCall, router]);

    return (
        <AppLayout showTopBar={false} showBottomNav={false}>
            <div className="flex flex-col items-center justify-center h-screen bg-background text-center p-4">
                <motion.div
                    animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.8, 1, 0.8],
                    }}
                    transition={{
                        duration: 2,
                        ease: "easeInOut",
                        repeat: Infinity,
                    }}
                    className="w-48 h-48 rounded-full bg-primary/10 flex items-center justify-center"
                >
                    <motion.div
                        animate={{
                            scale: [1, 1.05, 1],
                            opacity: [0.7, 1, 0.7],
                        }}
                        transition={{
                            duration: 1.5,
                            ease: "easeInOut",
                            repeat: Infinity,
                            delay: 0.5
                        }}
                        className="w-32 h-32 rounded-full bg-primary/20 flex items-center justify-center"
                    >
                         <Loader2 className="h-12 w-12 text-primary animate-spin" />
                    </motion.div>
                </motion.div>
                <h1 className="text-2xl font-bold font-headline mt-8">Searching for a partner...</h1>
                <p className="text-muted-foreground mt-2">Please wait while we connect you.</p>
            </div>
        </AppLayout>
    );
}
