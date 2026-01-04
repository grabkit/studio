
"use client";

import { useFirebase } from "@/firebase";
import { doc, getDoc, updateDoc, arrayRemove } from "firebase/firestore";
import type { User } from "@/lib/types";
import { WithId } from "@/firebase/firestore/use-collection";
import React, { useEffect, useState, useMemo } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MinusCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getAvatar } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";

function RestrictedUserSkeleton() {
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

function RestrictedUserItem({ user, onUnrestrict }: { user: WithId<User>, onUnrestrict: (userId: string) => void }) {
    
    const formatUserId = (uid: string | undefined) => {
        if (!uid) return "blur??????";
        return `blur${uid.substring(uid.length - 6)}`;
    };

    return (
        <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center space-x-4">
                <Avatar>
                    <AvatarFallback>{getAvatar(user.id)}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-sm text-muted-foreground">{formatUserId(user.id)}</p>
                </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => onUnrestrict(user.id)}>Unrestrict</Button>
        </div>
    )
}


export default function RestrictedUsersPage() {
    const { user: currentUser, firestore, userProfile } = useFirebase();
    const router = useRouter();
    const { toast } = useToast();
    const [restrictedUsers, setRestrictedUsers] = useState<WithId<User>[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const restrictedUserIds = useMemo(() => userProfile?.restrictedUsers || [], [userProfile]);

    useEffect(() => {
        if (!firestore || !currentUser) return;
        
        if (restrictedUserIds.length === 0) {
            setRestrictedUsers([]);
            setIsLoading(false);
            return;
        }

        const fetchRestrictedUsers = async () => {
            setIsLoading(true);
            const users: WithId<User>[] = [];
            for (const userId of restrictedUserIds) {
                const userDocRef = doc(firestore, 'users', userId);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    users.push({ id: userDocSnap.id, ...userDocSnap.data() } as WithId<User>);
                }
            }
            setRestrictedUsers(users);
            setIsLoading(false);
        }

        fetchRestrictedUsers();
    }, [firestore, currentUser, restrictedUserIds]);
    
    const handleUnrestrict = async (userIdToUnrestrict: string) => {
        if (!currentUser || !firestore) return;

        const currentUserDocRef = doc(firestore, "users", currentUser.uid);

        try {
            await updateDoc(currentUserDocRef, {
                restrictedUsers: arrayRemove(userIdToUnrestrict)
            });
            setRestrictedUsers(prev => prev.filter(u => u.id !== userIdToUnrestrict));
            toast({ title: "User Unrestricted", description: `You will now see content from this user without restrictions.` });
        } catch (error) {
             console.error("Error unrestricting user:", error);
            const permissionError = new FirestorePermissionError({
                path: currentUserDocRef.path,
                operation: 'update',
                requestResourceData: { restrictedUsers: `arrayRemove ${userIdToUnrestrict}` },
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: "destructive", title: "Error", description: "Could not unrestrict user." });
        }
    }


    return (
        <AppLayout showTopBar={false}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">Restricted Accounts</h2>
            </div>

            <div className="pt-14">
                 {isLoading && (
                    <>
                        <RestrictedUserSkeleton />
                        <RestrictedUserSkeleton />
                    </>
                 )}
                 {!isLoading && restrictedUsers.length === 0 && (
                     <div className="text-center py-16">
                         <div className="inline-block p-4 bg-secondary rounded-full">
                            <MinusCircle className="h-10 w-10 text-muted-foreground" />
                        </div>
                        <h3 className="text-xl font-headline mt-4">No Restricted Accounts</h3>
                        <p className="text-muted-foreground mt-2">You haven't restricted anyone yet.</p>
                    </div>
                 )}
                {!isLoading && (
                    <div className="divide-y">
                        {restrictedUsers.map(user => (
                            <RestrictedUserItem key={user.id} user={user} onUnrestrict={handleUnrestrict} />
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
