"use client";

import React, { useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight, User, Bell, HelpCircle, Info, Lock, Sun, LogOut, UserPlus, ShieldAlert, VolumeX, MinusCircle, UserX, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from 'next/link';
import { useFirebase } from "@/firebase";
import { signOut } from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { ref, serverTimestamp, set } from "firebase/database";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatar, formatUserId } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { addDoc, collection } from "firebase/firestore";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

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

function DestructiveSettingsItem({ label, icon: Icon, onClick }: { label: string, icon: React.ElementType, onClick?: () => void }) {
    return (
        <div onClick={onClick} className="flex items-center space-x-4 p-4 transition-colors hover:bg-destructive/10 cursor-pointer text-destructive">
            <Icon className="h-5 w-5" />
            <span className="text-base font-medium">{label}</span>
        </div>
    )
}


export default function SettingsPage() {
    const router = useRouter();
    const { auth, database, userProfile, user, firestore } = useFirebase();
    const { toast } = useToast();
    
    const ADMIN_USER_ID = "e9ZGHMjgnmO3ueSbf1ao3Crvlr02";
    const isOwner = user?.uid === ADMIN_USER_ID;

    const [afterDarkMsg, setAfterDarkMsg] = useState("");
    const [askSpaceMsg, setAskSpaceMsg] = useState("");
    const [announcementMsg, setAnnouncementMsg] = useState("");
    const [isSending, setIsSending] = useState<string | null>(null);

    const handleSendNotification = async (roomId: string, content: string) => {
        if (!firestore || !content.trim()) {
            toast({ variant: "destructive", title: "Content is empty!" });
            return;
        }
        setIsSending(roomId);
        try {
            await addDoc(collection(firestore, "manualNotifications"), {
                roomId: roomId,
                notificationContent: content,
            });
            toast({ title: "Notification Sent!", description: `Sent: "${content}"` });
            
            if (roomId === 'after_dark') setAfterDarkMsg('');
            else if (roomId === 'ask_space') setAskSpaceMsg('');
            else if (roomId === '_general_announcement') setAnnouncementMsg('');

        } catch (e) {
            toast({ variant: "destructive", title: "Failed to send notification." });
        } finally {
            setIsSending(null);
        }
    };
    
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
            <div className="fixed top-0 left-0 right-0 z-10 grid grid-cols-3 items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <div className="flex justify-start">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft />
                    </Button>
                </div>
                <h2 className="text-lg font-bold text-center">Settings</h2>
                <div />
            </div>
            <motion.div 
                className="pt-14 h-full bg-muted/50"
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
            >
                <div className="p-4 space-y-6 overflow-y-auto h-full">

                    {isOwner && (
                        <div>
                            <h3 className="px-2 mb-1 text-sm font-semibold text-muted-foreground">Admin Panel</h3>
                            <div className="bg-card rounded-xl p-4 space-y-4">
                                <div className="space-y-2">
                                    <Label>After Dark Notification</Label>
                                    <Textarea value={afterDarkMsg} onChange={(e) => setAfterDarkMsg(e.target.value)} placeholder="Message for After Dark room..."/>
                                    <Button onClick={() => handleSendNotification('after_dark', afterDarkMsg)} disabled={!afterDarkMsg || !!isSending} className="w-full">
                                        {isSending === 'after_dark' ? <Loader2 className="animate-spin" /> : 'Send to After Dark'}
                                    </Button>
                                </div>
                                 <div className="space-y-2">
                                    <Label>Ask Space Notification</Label>
                                    <Textarea value={askSpaceMsg} onChange={(e) => setAskSpaceMsg(e.target.value)} placeholder="Message for Ask Space room..." />
                                    <Button onClick={() => handleSendNotification('ask_space', askSpaceMsg)} disabled={!askSpaceMsg || !!isSending} className="w-full">
                                        {isSending === 'ask_space' ? <Loader2 className="animate-spin" /> : 'Send to Ask Space'}
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    <Label>General Announcement</Label>
                                    <Textarea value={announcementMsg} onChange={(e) => setAnnouncementMsg(e.target.value)} placeholder="General announcement for all users..." />
                                    <Button onClick={() => handleSendNotification('_general_announcement', announcementMsg)} disabled={!announcementMsg || !!isSending} className="w-full">
                                        {isSending === '_general_announcement' ? <Loader2 className="animate-spin" /> : 'Send Announcement'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

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
                            <div className="h-px bg-border/50 mx-4 opacity-50" />
                            <SettingsItem icon={UserPlus} label="Follow and invite friends" href="/account/settings/follow-invite" />
                             <div className="h-px bg-border/50 mx-4 opacity-50" />
                            <SettingsItem icon={Lock} label="Password & Security" href="/account/settings/account-status" />
                            <div className="h-px bg-border/50 mx-4 opacity-50" />
                            <SettingsItem icon={Bell} label="Notifications" href="/account/settings/notifications" />
                        </div>
                    </div>
                    
                    {/* Privacy & Safety Section */}
                    <div>
                        <h3 className="px-2 mb-1 text-sm font-semibold text-muted-foreground">Privacy & Safety</h3>
                        <div className="bg-card rounded-xl">
                            <SettingsItem icon={VolumeX} label="Muted Accounts" href="/account/settings/muted-users" />
                            <div className="h-px bg-border/50 mx-4 opacity-50" />
                            <SettingsItem icon={MinusCircle} label="Restricted Accounts" href="/account/settings/restricted-users" />
                            <div className="h-px bg-border/50 mx-4 opacity-50" />
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
                             <div className="h-px bg-border/50 mx-4 opacity-50" />
                            <SettingsItem icon={HelpCircle} label="Help Center" href="/account/settings/help" />
                        </div>
                    </div>

                    {/* Login Section */}
                    <div className="pb-4">
                        <h3 className="px-2 mb-1 text-sm font-semibold text-muted-foreground">Login</h3>
                        <div className="bg-card rounded-xl">
                            <DestructiveSettingsItem icon={LogOut} label="Log Out" onClick={handleLogout} />
                            <div className="h-px bg-border/50 mx-4 opacity-50" />
                            <DestructiveSettingsItem icon={UserX} label="Delete Account" onClick={() => {
                                toast({
                                    variant: "destructive",
                                    title: "This action cannot be undone.",
                                    description: "The delete account feature is not yet available.",
                                });
                            }} />
                        </div>
                    </div>
                </div>
            </motion.div>
        </AppLayout>
    );
}
