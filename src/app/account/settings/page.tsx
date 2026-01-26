
"use client";

import React from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight, User, Bell, HelpCircle, Info, Lock, Globe2, Sun, LogOut, UserPlus, ShieldAlert, VolumeX, MinusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { useFirebase } from "@/firebase";
import { signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { ref, serverTimestamp, set } from "firebase/database";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatar, formatUserId } from "@/lib/utils";


function SettingsItem({ href, label, icon: Icon, value }: { href: string, label: string, icon: React.ElementType, value?: string }) {
    return (
        <Link href={href} className="flex items-center justify-between p-4 transition-colors hover:bg-accent/50 cursor-pointer">
            <div className="flex items-center space-x-4">
                <Icon className="h-5 w-5 text-foreground" />
                <span className="text-base">{label}</span>
            </div>
            <div className="flex items-center space-x-2">
                {value && <span className="text-muted-foreground">{value}</span>}
                <ChevronRight className="h-5 w-5 text-foreground" />
            </div>
        </Link>
    )
}

export default function SettingsPage() {
    const router = useRouter();
    const { auth, database, userProfile, user } = useFirebase();
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
    
    const avatar = getAvatar(userProfile);
    const isAvatarUrl = avatar.startsWith('http');

    return (
        <AppLayout showTopBar={false} showBottomNav={true}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center justify-between p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                 <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-5">Settings</h2>
                <div className="w-10"></div>
            </div>
            <motion.div 
                className="pt-14 h-full bg-muted/50"
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
            >
                <div className="p-4 space-y-6 overflow-y-auto h-full">

                    <div className="bg-card rounded-xl p-4">
                        <div className="flex items-center space-x-4">
                            <Avatar className="h-14 w-14">
                                <AvatarImage src={isAvatarUrl ? avatar : undefined} alt={userProfile?.name || ''} />
                                <AvatarFallback className="text-2xl">{!isAvatarUrl ? avatar : ''}</AvatarFallback>
                            </Avatar>
                            <div>
                                <div className="font-semibold text-lg">{userProfile?.name}</div>
                                <div className="text-sm text-muted-foreground">{user?.email}</div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Account Section */}
                    <div>
                        <h3 className="px-2 mb-1 text-sm font-semibold text-muted-foreground">Account</h3>
                        <div className="bg-card rounded-xl">
                            <SettingsItem icon={User} label="Manage Profile" href="/account/settings/edit-profile" />
                            <div className="h-px bg-border/50 mx-4" />
                            <SettingsItem icon={UserPlus} label="Follow and invite friends" href="/account/settings/follow-invite" />
                             <div className="h-px bg-border/50 mx-4" />
                            <SettingsItem icon={Lock} label="Password & Security" href="/account/settings/account-status" />
                            <div className="h-px bg-border/50 mx-4" />
                            <SettingsItem icon={Bell} label="Notifications" href="/account/settings/notifications" />
                            <div className="h-px bg-border/50 mx-4" />
                            <SettingsItem icon={Globe2} label="Language" value="English" href="#" />
                        </div>
                    </div>
                    
                    {/* Privacy & Safety Section */}
                    <div>
                        <h3 className="px-2 mb-1 text-sm font-semibold text-muted-foreground">Privacy & Safety</h3>
                        <div className="bg-card rounded-xl">
                            <SettingsItem icon={VolumeX} label="Muted Accounts" href="/account/settings/muted-users" />
                            <div className="h-px bg-border/50 mx-4" />
                            <SettingsItem icon={MinusCircle} label="Restricted Accounts" href="/account/settings/restricted-users" />
                            <div className="h-px bg-border/50 mx-4" />
                            <SettingsItem icon={ShieldAlert} label="Blocked Users" href="/account/settings/blocked-users" />
                        </div>
                    </div>

                    {/* Preferences Section */}
                    <div>
                        <h3 className="px-2 mb-1 text-sm font-semibold text-muted-foreground">Preferences</h3>
                        <div className="bg-card rounded-xl">
                             <SettingsItem icon={Sun} label="Theme" value="Light" href="#" />
                        </div>
                    </div>

                    {/* Support Section */}
                    <div>
                        <h3 className="px-2 mb-1 text-sm font-semibold text-muted-foreground">Support</h3>
                        <div className="bg-card rounded-xl">
                            <SettingsItem icon={Info} label="About Us" href="/account/settings/about" />
                             <div className="h-px bg-border/50 mx-4" />
                            <SettingsItem icon={HelpCircle} label="Help Center" href="/account/settings/help" />
                        </div>
                    </div>

                    {/* Logout Button */}
                    <div className="text-center pt-4">
                         <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 rounded-full" onClick={handleLogout}>
                            <LogOut className="mr-2 h-4 w-4" />
                            Log Out
                        </Button>
                    </div>
                </div>
            </motion.div>
        </AppLayout>
    );
}
