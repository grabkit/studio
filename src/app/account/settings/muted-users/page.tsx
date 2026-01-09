

"use client";

import { useFirebase, useMemoFirebase } from "@/firebase";
import { doc, getDoc, updateDoc, arrayRemove } from "firebase/firestore";
import type { User } from "@/lib/types";
import { WithId } from "@/firebase/firestore/use-collection";
import React, { useEffect, useState, useMemo, useRef } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, VolumeX } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatar, formatUserId } from "@/lib/utils.tsx";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { FirestorePermissionError } from "@/firebase/errors";
import { errorEmitter } from "@/firebase/error-emitter";

function MutedUserSkeleton() {
    return (
        <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center space-x-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                </div>
            </div>
            <Skeleton className="h-9 w-24 rounded-md" />
        </div>
    )
}

function MutedUserItem({ user, onUnmute }: { user: WithId<User>, onUnmute: (userId: string) => void }) {
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
            <Button variant="outline" size="sm" onClick={() => onUnmute(user.id)}>Unmute</Button>
        </div>
    )
}


export default function MutedUsersPage() {
    const { user: currentUser, firestore, userProfile } = useFirebase();
    const router = useRouter();
    const pageRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    const [mutedUsers, setMutedUsers] = useState<WithId<User>[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const mutedUserIds = useMemo(() => userProfile?.mutedUsers || [], [userProfile]);

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

    useEffect(() => {
        if (!firestore || !currentUser) return;
        
        if (mutedUserIds.length === 0) {
            setMutedUsers([]);
            setIsLoading(false);
            return;
        }

        const fetchMutedUsers = async () => {
            setIsLoading(true);
            const users: WithId<User>[] = [];
            for (const userId of mutedUserIds) {
                const userDocRef = doc(firestore, 'users', userId);
                const userDocSnap = await getDoc(userDocRef);
                if (userDocSnap.exists()) {
                    users.push({ id: userDocSnap.id, ...userDocSnap.data() } as WithId<User>);
                }
            }
            setMutedUsers(users);
            setIsLoading(false);
        }

        fetchMutedUsers();
    }, [firestore, currentUser, mutedUserIds]);
    
    const handleUnmute = async (userIdToUnmute: string) => {
        if (!currentUser || !firestore) return;

        const currentUserDocRef = doc(firestore, "users", currentUser.uid);

        try {
            await updateDoc(currentUserDocRef, {
                mutedUsers: arrayRemove(userIdToUnmute)
            });
            setMutedUsers(prev => prev.filter(u => u.id !== userIdToUnmute));
            toast({ title: "User Unmuted", description: `You will now see content from this user in your feed.` });
        } catch (error) {
             console.error("Error unmuting user:", error);
            const permissionError = new FirestorePermissionError({
                path: currentUserDocRef.path,
                operation: 'update',
                requestResourceData: { mutedUsers: `arrayRemove ${userIdToUnmute}` },
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: "destructive", title: "Error", description: "Could not unmute user." });
        }
    }


    return (
        <AppLayout showTopBar={false} showBottomNav={false}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={handleBackNavigation}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">Muted Accounts</h2>
            </div>
            <div ref={pageRef} className="h-full bg-background animate-slide-in-right">
                <div className="pt-14 h-full overflow-y-auto">
                     {isLoading && (
                        <>
                            <MutedUserSkeleton />
                            <MutedUserSkeleton />
                        </>
                     )}
                     {!isLoading && mutedUsers.length === 0 && (
                         <div className="text-center py-16">
                             <div className="inline-block p-4 bg-secondary rounded-full">
                                <VolumeX className="h-10 w-10 text-muted-foreground" />
                            </div>
                            <h3 className="text-xl font-headline mt-4">No Muted Accounts</h3>
                            <p className="text-muted-foreground mt-2">You haven't muted anyone yet.</p>
                        </div>
                     )}
                    {!isLoading && (
                        <div className="divide-y">
                            {mutedUsers.map(user => (
                                <MutedUserItem key={user.id} user={user} onUnmute={handleUnmute} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
