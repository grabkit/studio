
"use client";

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bell, BellOff, ChevronRight, Heart, MessageCircle, Repeat, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { useFirebase } from "@/firebase";
import type { NotificationSettings } from "@/lib/types";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { doc, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";

function NotificationToggle({
    id,
    label,
    icon: Icon,
    checked,
    onCheckedChange,
}: {
    id: keyof Omit<NotificationSettings, 'push'>;
    label: string;
    icon: React.ElementType;
    checked: boolean;
    onCheckedChange: (id: keyof Omit<NotificationSettings, 'push'>, checked: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-accent">
            <div className="flex items-center space-x-4">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <Label htmlFor={`notif-${id}`} className="text-base cursor-pointer">{label}</Label>
            </div>
            <Switch
                id={`notif-${id}`}
                checked={checked}
                onCheckedChange={(newChecked) => onCheckedChange(id, newChecked)}
            />
        </div>
    )
}

export default function NotificationsSettingsPage() {
    const router = useRouter();
    const { firestore, user, userProfile, setUserProfile } = useFirebase();
    const { toast } = useToast();

    const settings = useMemo(() => {
        return userProfile?.notificationSettings || {
            likes: true,
            comments: true,
            reposts: true,
            followers: true,
            messageRequests: true,
        };
    }, [userProfile]);

    const handleSettingChange = async (
        key: keyof NotificationSettings,
        value: boolean
    ) => {
        if (!firestore || !user || !userProfile) return;

        const userDocRef = doc(firestore, 'users', user.uid);
        const originalSettings = userProfile.notificationSettings;

        // Optimistic UI update
        setUserProfile(currentProfile => {
            if (!currentProfile) return null;
            const newSettings = { ...currentProfile.notificationSettings, [key]: value };
            return { ...currentProfile, notificationSettings: newSettings as NotificationSettings };
        });

        try {
            await updateDoc(userDocRef, {
                [`notificationSettings.${key}`]: value
            });
        } catch (error) {
            // Revert on error
            setUserProfile(currentProfile => {
                if (!currentProfile) return null;
                return { ...currentProfile, notificationSettings: originalSettings };
            });
             const permissionError = new FirestorePermissionError({
                path: userDocRef.path,
                operation: 'update',
                requestResourceData: { [`notificationSettings.${key}`]: value },
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update notification setting.' });
        }
    };


    return (
        <AppLayout showTopBar={false} showBottomNav={false}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">Notifications</h2>
            </div>
            <motion.div
                className="pt-14 h-full"
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
            >
                <div className="h-full overflow-y-auto">
                    <div className="mt-4">
                         <h3 className="px-4 pt-4 pb-2 text-sm font-semibold text-muted-foreground">From people you follow</h3>
                         <NotificationToggle
                            id="likes"
                            label="Likes"
                            icon={Heart}
                            checked={settings.likes}
                            onCheckedChange={handleSettingChange}
                        />
                        <NotificationToggle
                            id="comments"
                            label="Comments"
                            icon={MessageCircle}
                            checked={settings.comments}
                            onCheckedChange={handleSettingChange}
                        />
                        <NotificationToggle
                            id="reposts"
                            label="Reposts & Quotes"
                            icon={Repeat}
                            checked={settings.reposts}
                            onCheckedChange={handleSettingChange}
                        />
                         <NotificationToggle
                            id="followers"
                            label="New Followers"
                            icon={UserPlus}
                            checked={settings.followers}
                            onCheckedChange={handleSettingChange}
                        />
                    </div>
                </div>
            </motion.div>
        </AppLayout>
    )
}
