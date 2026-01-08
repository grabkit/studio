
"use client";

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useFirebase } from "@/firebase";
import { doc, updateDoc } from "firebase/firestore";
import type { NotificationSettings } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";

type SettingsKeys = keyof NotificationSettings;

function NotificationSettingItem({ id, label, description, isChecked, onToggle, disabled }: { id: SettingsKeys, label: string, description: string, isChecked: boolean, onToggle: (id: SettingsKeys, checked: boolean) => void, disabled: boolean }) {
    return (
        <div className="flex items-center justify-between p-4 border-b">
            <div className="flex-1 pr-4">
                <Label htmlFor={id} className="text-base font-medium">{label}</Label>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <Switch 
                id={id} 
                checked={isChecked}
                onCheckedChange={(checked) => onToggle(id, checked)}
                disabled={disabled}
            />
        </div>
    )
}

function SettingsSkeleton() {
    return (
        <div className="divide-y">
            {[...Array(5)].map((_, i) => (
                 <div key={i} className="flex items-center justify-between p-4 border-b">
                    <div className="flex-1 pr-4 space-y-2">
                       <Skeleton className="h-5 w-32" />
                       <Skeleton className="h-4 w-48" />
                    </div>
                    <Skeleton className="h-6 w-11 rounded-full" />
                </div>
            ))}
        </div>
    )
}


export default function NotificationsSettingsPage() {
    const router = useRouter();
    const pageRef = useRef<HTMLDivElement>(null);
    const { user, userProfile, firestore, setUserProfile } = useFirebase();
    const { toast } = useToast();

    const [isUpdating, setIsUpdating] = useState<SettingsKeys | null>(null);

    const handleBackNavigation = () => {
        if (pageRef.current) {
            pageRef.current.classList.remove('animate-slide-in-right');
            pageRef.current.classList.add('animate-slide-out-right');
            setTimeout(() => {
                router.back();
            }, 300);
        } else {
            router.back();
        }
    };

    const settings = useMemo(() => {
        return userProfile?.notificationSettings || {
            push: true,
            likes: true,
            comments: true,
            reposts: true,
            upvotes: true,
            messageRequests: true,
        };
    }, [userProfile]);

    const handleToggle = async (id: SettingsKeys, checked: boolean) => {
        if (!user || !firestore) return;
        setIsUpdating(id);

        const userDocRef = doc(firestore, 'users', user.uid);
        const newSettings = { ...settings, [id]: checked };

        try {
            await updateDoc(userDocRef, {
                notificationSettings: newSettings
            });
            // Optimistically update local state
            setUserProfile(currentProfile => {
              if (!currentProfile) return null;
              return { ...currentProfile, notificationSettings: newSettings };
            });

        } catch (error) {
            console.error(`Failed to update setting ${id}:`, error);
            const permissionError = new FirestorePermissionError({
                path: userDocRef.path,
                operation: 'update',
                requestResourceData: { notificationSettings: newSettings },
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not save your setting.' });
        } finally {
            setIsUpdating(null);
        }
    };
    
    if (!userProfile) {
        return (
             <AppLayout showTopBar={false}>
                 <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                    <Button variant="ghost" size="icon" onClick={handleBackNavigation}>
                        <ArrowLeft />
                    </Button>
                    <h2 className="text-lg font-bold mx-auto -translate-x-4">Notifications</h2>
                </div>
                <div className="pt-14">
                    <SettingsSkeleton />
                </div>
            </AppLayout>
        )
    }


    return (
        <div ref={pageRef} className="h-full bg-background animate-slide-in-right">
            <AppLayout showTopBar={false}>
                <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                    <Button variant="ghost" size="icon" onClick={handleBackNavigation}>
                        <ArrowLeft />
                    </Button>
                    <h2 className="text-lg font-bold mx-auto -translate-x-4">Notifications</h2>
                </div>
                <div className="pt-14">
                    <div className="divide-y">
                        <NotificationSettingItem 
                            id="push"
                            label="Push Notifications"
                            description="Receive notifications on your device."
                            isChecked={settings.push}
                            onToggle={handleToggle}
                            disabled={!!isUpdating}
                        />
                         <NotificationSettingItem 
                            id="likes"
                            label="Likes on your posts"
                            description="Notify me when someone likes my post."
                            isChecked={settings.likes}
                            onToggle={handleToggle}
                            disabled={!!isUpdating || !settings.push}
                        />
                         <NotificationSettingItem 
                            id="comments"
                            label="Replies to your posts"
                            description="Notify me when someone replies to my post."
                            isChecked={settings.comments}
                            onToggle={handleToggle}
                            disabled={!!isUpdating || !settings.push}
                        />
                        <NotificationSettingItem 
                            id="reposts"
                            label="Reposts and Quotes"
                            description="Notify me on reposts or quotes of your posts."
                            isChecked={settings.reposts}
                            onToggle={handleToggle}
                            disabled={!!isUpdating || !settings.push}
                        />
                        <NotificationSettingItem 
                            id="upvotes"
                            label="Profile Upvotes"
                            description="Notify me when someone upvotes your profile."
                            isChecked={settings.upvotes}
                            onToggle={handleToggle}
                            disabled={!!isUpdating || !settings.push}
                        />
                         <NotificationSettingItem 
                            id="messageRequests"
                            label="Message Requests"
                            description="Notify me when you get a new message request."
                            isChecked={settings.messageRequests}
                            onToggle={handleToggle}
                            disabled={!!isUpdating || !settings.push}
                        />
                    </div>
                </div>
            </AppLayout>
        </div>
    )
}
