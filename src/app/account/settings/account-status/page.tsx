
"use client";

import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useFirebase } from "@/firebase";
import { ArrowLeft, Calendar, Globe, MapPin, User as UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useMemo } from "react";
import { format } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatar, formatUserId } from "@/lib/utils.tsx";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

export default function AccountStatusPage() {
    const router = useRouter();
    const { userProfile, user: authUser } = useFirebase();

    const isLoading = !userProfile || !authUser;
    const avatar = useMemo(() => getAvatar(userProfile), [userProfile]);
    const isAvatarUrl = avatar.startsWith('http');
    
    return (
        <AppLayout showTopBar={false} showBottomNav={false}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">Account Information</h2>
            </div>
            <motion.div 
                className="pt-14 h-full"
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
            >
                <div className="px-4 h-full overflow-y-auto">
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
                                    <AvatarImage src={isAvatarUrl ? avatar : undefined} alt={userProfile?.name} />
                                    <AvatarFallback className="text-2xl">{!isAvatarUrl ? avatar : ''}</AvatarFallback>
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
                                    <Globe className="h-5 w-5 mr-4 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Country</p>
                                        <p className="font-semibold">India</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </AppLayout>
    )
}
