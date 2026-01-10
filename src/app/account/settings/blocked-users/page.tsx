
"use client";

import { useFirebase } from "@/firebase";
import { doc, getDoc, updateDoc, arrayRemove } from "firebase/firestore";
import type { User } from "@/lib/types";
import { WithId } from "@/firebase/firestore/use-collection";
import React, { useEffect, useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatar, formatUserId } from "@/lib/utils.tsx";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";
import { motion } from "framer-motion";

function BlockedUserSkeleton() {
    return (
        <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center space-x-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-32" />
                </div>
            </div>
            <Skeleton className="h-9 w-24 rounded-md" />
        </div>
    )
}

function BlockedUserItem({ user, onUnblock }: { user: WithId<User>, onUnblock: (userId: string) => void }) {
    const avatar = getAvatar(user);
    const isAvatarUrl = avatar.startsWith('http');
    
    return (
        <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center space-x-4">
                <Avatar>
                    <AvatarImage src={isAvatarUrl ? avatar : undefined} alt={user.name} />
                    <AvatarFallback>{!isAvatarUrl ? avatar : ''}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold">{formatUserId(user.id)}</p>
                </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => onUnblock(user.id)}>Unblock</Button>
        </div>
    )
}


export default function BlockedUsersPage() {
    const { user: currentUser, firestore, userProfile } = useFirebase();
    const router = useRouter();
    const { toast } = useToast();
    const [blockedUsers, setBlockedUsers] = useState<WithId<User>[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const blockedUserIds = useMemo(() => userProfile?.blockedUsers || [], [userProfile]);

    useEffect(() => {
        if (!firestore || !currentUser) return;
        
        if (blockedUserIds.length === 0) {
            setBlockedUsers([]);
            setIsLoading(false);
            return;
        }

        const fetchBlockedUsers = async () => {
            setIsLoading(true);
            const users: WithId<User>[] = [];
            for (const userId of blockedUserIds) {
                const userDocRef = doc(firestore, 'users', userId);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    users.push({ id: userDocSnap.id, ...userDocSnap.data() } as WithId<User>);
                }
            }
            setBlockedUsers(users);
            setIsLoading(false);
        }

        fetchBlockedUsers();
    }, [firestore, currentUser, blockedUserIds]);
    
    const handleUnblock = async (userIdToUnblock: string) => {
        if (!currentUser || !firestore) return;

        const currentUserDocRef = doc(firestore, "users", currentUser.uid);

        try {
            await updateDoc(currentUserDocRef, {
                blockedUsers: arrayRemove(userIdToUnblock)
            });
            setBlockedUsers(prev => prev.filter(u => u.id !== userIdToUnblock));
            toast({ title: "User Unblocked", description: `You will now see content from this user.` });
        } catch (error) {
             console.error("Error unblocking user:", error);
            const permissionError = new FirestorePermissionError({
                path: currentUserDocRef.path,
                operation: 'update',
                requestResourceData: { blockedUsers: `arrayRemove ${userIdToUnblock}` },
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: "destructive", title: "Error", description: "Could not unblock user." });
        }
    }


    return (
        <AppLayout showTopBar={false} showBottomNav={false}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">Blocked Users</h2>
            </div>
            <motion.div 
                className="pt-14 h-full"
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
            >
                <div className="h-full overflow-y-auto">
                     {isLoading && (
                        <>
                            <BlockedUserSkeleton />
                            <BlockedUserSkeleton />
                        </>
                     )}
                     {!isLoading && blockedUsers.length === 0 && (
                         <div className="text-center py-16">
                             <div className="inline-block p-4 bg-secondary rounded-full">
                                <UserX className="h-10 w-10 text-muted-foreground" />
                            </div>
                            <h3 className="text-xl font-headline mt-4">No Blocked Users</h3>
                            <p className="text-muted-foreground mt-2">You haven't blocked anyone yet.</p>
                        </div>
                     )}
                    {!isLoading && (
                        <div className="divide-y">
                            {blockedUsers.map(user => (
                                <BlockedUserItem key={user.id} user={user} onUnblock={handleUnblock} />
                            ))}
                        </div>
                    )}
                </div>
            </motion.div>
        </AppLayout>
    );
}
