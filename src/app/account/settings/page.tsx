
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

const settingsItems = [
    { href: "/account/settings/account-status", label: "Account status", icon: User },
    { href: "#", label: "Follow and invite", icon: UserPlus },
    { href: "/account/settings/notifications", label: "Notifications", icon: Bell },
    { href: "/account/settings/restricted-users", label: "Restricted accounts", icon: MinusCircle },
    { href: "/account/settings/blocked-users", label: "Blocked users", icon: UserX },
    { href: "/account/settings/muted-users", label: "Muted accounts", icon: VolumeX },
    { href: "/account/settings/help", label: "Help", icon: HelpCircle },
    { href: "/account/settings/about", label: "About", icon: Info },
]

function SettingsItem({ href, label, icon: Icon }: { href: string, label: string, icon: React.ElementType }) {
    return (
        <Link href={href} className="flex items-center justify-between p-4 border-b transition-colors hover:bg-accent cursor-pointer">
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

        // Manually set user offline before signing out
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
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">Settings</h2>
            </div>

            <div className="pt-14">
                <div className="divide-y">
                    {settingsItems.map(item => (
                        <SettingsItem key={item.href} {...item} />
                    ))}
                </div>
                 <div className="p-4 mt-4">
                     <Button variant="outline" className="w-full text-destructive" onClick={handleLogout}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Log Out
                    </Button>
                </div>
            </div>
        </AppLayout>
    );
}
