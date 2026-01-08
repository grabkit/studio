
"use client";

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useFirebase } from "@/firebase";
import { ArrowLeft, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import React, { useRef } from "react";

const StatusInfo = {
    active: {
        icon: CheckCircle2,
        title: "Active",
        description: "Your account is in good standing.",
        badgeVariant: "default",
        iconColor: "text-green-500"
    },
    suspended: {
        icon: AlertTriangle,
        title: "Suspended",
        description: "Your account has been temporarily suspended due to a violation of our community guidelines. Some actions may be restricted.",
        badgeVariant: "destructive",
        iconColor: "text-yellow-500"
    },
    banned: {
        icon: ShieldAlert,
        title: "Banned",
        description: "Your account has been permanently banned due to repeated or severe violations of our community guidelines.",
        badgeVariant: "destructive",
        iconColor: "text-destructive"
    }
}


export default function AccountStatusPage() {
    const router = useRouter();
    const { userProfile, user: authUser } = useFirebase();
    const pageRef = useRef<HTMLDivElement>(null);

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

    const status = userProfile?.status || 'active';
    const { icon: Icon, title, description, badgeVariant, iconColor } = StatusInfo[status];

    return (
        <div ref={pageRef} className="h-full bg-background animate-slide-in-right">
            <AppLayout showTopBar={false} showBottomNav={false}>
                <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                    <Button variant="ghost" size="icon" onClick={handleBackNavigation}>
                        <ArrowLeft />
                    </Button>
                    <h2 className="text-lg font-bold mx-auto -translate-x-4">Account Status</h2>
                </div>
                <div className="pt-14 px-4">
                    <Card className="mt-6">
                        <CardHeader className="text-center items-center">
                            <Icon className={cn("h-16 w-16 mb-4", iconColor)} />
                            <CardTitle className="flex items-center gap-2">
                               <span>{title}</span>
                                <Badge variant={badgeVariant as any}>{status}</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-center space-y-4">
                            <div className="text-left bg-secondary p-3 rounded-md">
                                <p className="font-semibold text-secondary-foreground">{userProfile?.name}</p>
                                <p className="text-sm text-muted-foreground">{authUser?.email}</p>
                            </div>
                            <p className="text-muted-foreground pt-2">{description}</p>
                        </CardContent>
                    </Card>
                     <div className="text-center mt-6">
                        <Button variant="link">View Community Guidelines</Button>
                    </div>
                </div>
            </AppLayout>
        </div>
    )
}
