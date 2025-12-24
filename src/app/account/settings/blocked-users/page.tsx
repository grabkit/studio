
"use client";

import { useFirebase, useMemoFirebase } from "@/firebase";
import { doc, getDoc, updateDoc, arrayRemove } from "firebase/firestore";
import type { User } from "@/lib/types";
import { WithId } from "@/firebase/firestore/use-collection";
import React, { useEffect, useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";

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
    
    const formatUserId = (uid: string | undefined) => {
        if (!uid) return "blur??????";
        return `blur${uid.substring(uid.length - 6)}`;
    };

    return (
        <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center space-x-4">
                <Avatar>
                    <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{formatUserId(user.id)}</p>
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
            // This is inefficient for a large number of blocked users. 
            // A real app might use a Cloud Function to denormalize user data.
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
        <AppLayout showTopBar={false}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">Blocked Users</h2>
            </div>

            <div className="pt-14">
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
        </AppLayout>
    );
}

