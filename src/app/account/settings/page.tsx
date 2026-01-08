
"use client";

import React from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight, User, Bell, UserX, HelpCircle, Info, LogOut, UserPlus, VolumeX, MinusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { useFirebase } from "@/firebase";
import { signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { ref, serverTimestamp, set } from "firebase/database";
import { cn } from "@/lib/utils";

const settingsItems = {
    "Your Account": [
        { href: "/account/settings/account-status", label: "Account status", icon: User },
        { href: "/account/settings/follow-invite", label: "Follow and invite friends", icon: UserPlus },
    ],
    "How you interact": [
        { href: "/account/settings/notifications", label: "Notifications", icon: Bell },
        { href: "/account/settings/restricted-users", label: "Restricted accounts", icon: MinusCircle },
        { href: "/account/settings/blocked-users", label: "Blocked users", icon: UserX },
        { href: "/account/settings/muted-users", label: "Muted accounts", icon: VolumeX },
    ],
    "Support & About": [
        { href: "/account/settings/help", label: "Help", icon: HelpCircle },
        { href: "/account/settings/about", label: "About", icon: Info },
    ],
};

function SettingsItem({ href, label, icon: Icon }: { href: string, label: string, icon: React.ElementType }) {
    return (
        <Link href={href} className="flex items-center justify-between p-4 transition-colors hover:bg-accent cursor-pointer">
            <div className="flex items-center space-x-4">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <span className="text-base">{label}</span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>
    )
}


export default function SettingsPage() {
    const router = useRouter();
    const { auth, database } = useFirebase();
    const { toast } = useToast();
    
    const handleLogout = async () => {
        if (!auth || !auth.currentUser || !database) return;

        const userStatusDatabaseRef = ref(database, '/status/' + auth.currentUser.uid);
        const isOfflineForDatabase = {
            isOnline: false,
            lastSeen: serverTimestamp(),
        };

        try {
            await set(userStatusDatabaseRef, isOfflineForDatabase);
            await signOut(auth);
            router.push("/auth");
            toast({
                title: "Logged Out",
                description: "You have been successfully logged out.",
            });
        } catch (error: any) {
            console.error("Logout failed:", error);
            toast({
                variant: "destructive",
                title: "Logout Failed",
                description: error.message,
            });
        }
      };

    return (
        <AppLayout showTopBar={false}>
            <div className="h-full bg-background">
                <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft />
                    </Button>
                    <h2 className="text-lg font-bold mx-auto -translate-x-4">Settings</h2>
                </div>

                <div className="pt-14 h-full overflow-y-auto">
                    {Object.entries(settingsItems).map(([category, items]) => (
                        <div key={category} className="my-4">
                            <h3 className="px-4 py-2 text-sm font-semibold text-muted-foreground">{category}</h3>
                            <div className="border-y divide-y">
                            {items.map(item => (
                                    <SettingsItem key={item.href} {...item} />
                                ))}
                            </div>
                        </div>
                    ))}
                    <div className="p-4 mt-4">
                        <Button variant="outline" className="w-full text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleLogout}>
                            <LogOut className="mr-2 h-4 w-4" />
                            Log Out
                        </Button>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
