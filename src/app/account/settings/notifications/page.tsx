
"use client";

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import React, { useState } from "react";

interface NotificationSettings {
    push: boolean;
    likes: boolean;
    comments: boolean;
}

function NotificationSettingItem({ id, label, description, isChecked, onToggle }: { id: keyof NotificationSettings, label: string, description: string, isChecked: boolean, onToggle: (id: keyof NotificationSettings, checked: boolean) => void }) {
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
            />
        </div>
    )
}


export default function NotificationsSettingsPage() {
    const router = useRouter();
    const [settings, setSettings] = useState<NotificationSettings>({
        push: true,
        likes: true,
        comments: false,
    });

    const handleToggle = (id: keyof NotificationSettings, checked: boolean) => {
        setSettings(prevSettings => ({
            ...prevSettings,
            [id]: checked
        }));
        // Here you would typically save the setting to a user's profile in Firestore
        console.log(`Setting ${id} changed to ${checked}`);
    };

    return (
        <AppLayout showTopBar={false}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
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
                    />
                     <NotificationSettingItem 
                        id="likes"
                        label="Likes on your posts"
                        description="Notify me when someone likes my post."
                        isChecked={settings.likes}
                        onToggle={handleToggle}
                    />
                     <NotificationSettingItem 
                        id="comments"
                        label="Replies to your posts"
                        description="Notify me when someone replies to my post."
                        isChecked={settings.comments}
                        onToggle={handleToggle}
                    />
                </div>
            </div>
        </AppLayout>
    )
}
