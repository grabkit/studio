'use client';

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/hooks/use-translation";
import { languages } from "@/providers/translation-provider";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export default function LanguagePage() {
    const router = useRouter();
    const { language, setLanguage } = useTranslation();

    return (
        <AppLayout showTopBar={false} showBottomNav={false}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">Language</h2>
            </div>
            <motion.div 
                className="pt-14 h-full"
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
            >
                <div className="h-full overflow-y-auto">
                    <div className="divide-y">
                        {Object.entries(languages).map(([code, name]) => (
                            <button
                                key={code}
                                onClick={() => setLanguage(code as keyof typeof languages)}
                                className="w-full flex items-center justify-between p-4 transition-colors hover:bg-accent cursor-pointer text-left"
                            >
                                <span className={cn("text-base", language === code && "font-bold text-primary")}>{name}</span>
                                {language === code && <Check className="h-5 w-5 text-primary" />}
                            </button>
                        ))}
                    </div>
                </div>
            </motion.div>
        </AppLayout>
    );
}
