
"use client";

import { useFirebase } from "@/firebase";
import { doc, getDoc } from "firebase/firestore";
import type { User } from "@/lib/types";
import { WithId } from "@/firebase/firestore/use-collection";
import React, { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, UserX } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { cn } from "@/lib/utils";


function UserListSkeleton() {
    return (
        <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center space-x-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                </div>
            </div>
        </div>
    )
}

function UserItem({ user }: { user: WithId<User> }) {
    const formatUserId = (uid: string | undefined) => {
        if (!uid) return "blur??????";
        return `blur${uid.substring(uid.length - 6)}`;
    };

    return (
        <Link href={`/profile/${user.id}`} className="flex items-center justify-between p-4 border-b hover:bg-accent">
            <div className="flex items-center space-x-4">
                <Avatar className="h-10 w-10">
                    <AvatarFallback>{formatUserId(user.id).charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold">{formatUserId(user.id)}</p>
                </div>
            </div>
        </Link>
    )
}

export default function UserList({ userIds, emptyTitle, emptyDescription }: { userIds: string[], emptyTitle: string, emptyDescription: string }) {
    const { firestore } = useFirebase();
    const [users, setUsers] = useState<WithId<User>[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!firestore) return;
        
        if (userIds.length === 0) {
            setUsers([]);
            setIsLoading(false);
            return;
        }

        const fetchUsers = async () => {
            setIsLoading(true);
            const userPromises = userIds.map(userId => getDoc(doc(firestore, 'users', userId)));
            const userDocs = await Promise.all(userPromises);
            
            const fetchedUsers = userDocs
                .filter(docSnap => docSnap.exists())
                .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as WithId<User>));
            
            setUsers(fetchedUsers);
            setIsLoading(false);
        }

        fetchUsers();
    }, [firestore, userIds]);

    if (isLoading) {
        return (
            <div className="divide-y">
                <UserListSkeleton />
                <UserListSkeleton />
                <UserListSkeleton />
            </div>
        )
    }

    if (users.length === 0) {
        return (
            <div className="text-center py-16">
                 <div className="inline-block p-4 bg-secondary rounded-full">
                    <UserX className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-headline mt-4">{emptyTitle}</h3>
                <p className="text-muted-foreground mt-2">{emptyDescription}</p>
            </div>
        )
    }

    return (
        <div className="divide-y">
            {users.map(user => (
                <UserItem key={user.id} user={user} />
            ))}
        </div>
    );
}
