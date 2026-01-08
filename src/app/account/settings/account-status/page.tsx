
"use client";

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useFirebase } from "@/firebase";
import { ArrowLeft, Calendar, Globe, MapPin, User as UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useRef } from "react";
import { format } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getAvatar, formatUserId } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

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

    const isLoading = !userProfile || !authUser;
    
    return (
        <AppLayout showTopBar={false} showBottomNav={false}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={handleBackNavigation}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">Account Information</h2>
            </div>
            <div ref={pageRef} className="h-full bg-background animate-slide-in-right">
                <div className="pt-14 px-4 h-full overflow-y-auto">
                    {isLoading ? (
                         <div className="space-y-6 pt-6">
                            <div className="flex items-center space-x-4">
                                <Skeleton className="h-16 w-16 rounded-full" />
                                <div className="space-y-2">
                                    <Skeleton className="h-6 w-40" />
                                    <Skeleton className="h-4 w-32" />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6 pt-6">
                            <div className="flex items-center space-x-4">
                                <Avatar className="h-16 w-16">
                                    <AvatarFallback className="text-2xl">{getAvatar(userProfile)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="text-xl font-bold font-headline">{userProfile?.name}</p>
                                    <p className="text-muted-foreground">{formatUserId(authUser.uid)}</p>
                                </div>
                            </div>
                            <div className="border-t pt-6 space-y-4">
                                <div className="flex items-center">
                                    <Calendar className="h-5 w-5 mr-4 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Joined</p>
                                        <p className="font-semibold">{userProfile?.createdAt ? format(userProfile.createdAt.toDate(), "MMMM d, yyyy") : 'Not available'}</p>
                                    </div>
                                </div>
                                 <div className="flex items-center">
                                    <MapPin className="h-5 w-5 mr-4 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Based In</p>
                                        <p className="font-semibold">San Francisco, CA</p>
                                    </div>
                                </div>
                                <div className="flex items-center">
                                    <Globe className="h-5 w-5 mr-4 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Country</p>
                                        <p className="font-semibold">United States</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    )
}
