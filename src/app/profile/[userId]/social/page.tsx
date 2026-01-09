
"use client";

import { useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, UserX } from "lucide-react";
import { useFirebase, useDoc, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import type { User } from "@/lib/types";
import UserList from "@/components/UserList";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUserId } from "@/lib/utils";

export default function SocialPage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const { firestore } = useFirebase();

    const userId = params.userId as string;
    const activeTab = searchParams.get("tab") || "followers";

    const userRef = useMemoFirebase(() => {
        if (!firestore || !userId) return null;
        return doc(firestore, 'users', userId);
    }, [firestore, userId]);
    
    const { data: user, isLoading: isUserLoading } = useDoc<User>(userRef);

    const pageTitle = useMemo(() => {
        if (isUserLoading) return "Loading...";
        if (!user) return "User Not Found";
        return formatUserId(user.id);
    }, [user, isUserLoading]);

    if (!userId) {
        return (
            <AppLayout showTopBar={false}>
                <div className="p-4">
                    <p>User not found.</p>
                </div>
            </AppLayout>
        );
    }
    
    if (isUserLoading) {
        return (
             <AppLayout showTopBar={false}>
                <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background h-14 max-w-2xl mx-auto sm:px-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft />
                    </Button>
                    <h2 className="text-lg font-bold mx-auto -translate-x-4"><Skeleton className="h-6 w-32" /></h2>
                </div>
                <div className="pt-28">
                    <div className="flex flex-col items-center justify-center">
                        <Skeleton className="h-4 w-48" />
                    </div>
                </div>
            </AppLayout>
        )
    }

    if (!user) {
        return (
             <AppLayout showTopBar={false}>
                <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background h-14 max-w-2xl mx-auto sm:px-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft />
                    </Button>
                    <h2 className="text-lg font-bold mx-auto -translate-x-4">User Not Found</h2>
                </div>
                 <div className="text-center py-16 pt-32">
                     <div className="inline-block p-4 bg-secondary rounded-full">
                        <UserX className="h-10 w-10 text-muted-foreground" />
                    </div>
                    <h3 className="text-xl font-headline mt-4">User does not exist</h3>
                    <p className="text-muted-foreground mt-2">This profile may have been deleted or the link is incorrect.</p>
                </div>
            </AppLayout>
        )
    }

    return (
        <AppLayout showTopBar={false}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">{pageTitle}</h2>
            </div>

            <div className="pt-14">
                <Tabs defaultValue={activeTab} className="w-full">
                    <div className="sticky top-14 bg-background z-10 border-b">
                        <TabsList variant="underline" className="grid w-full grid-cols-2">
                            <TabsTrigger value="followers" variant="underline" className="font-semibold">
                                <Link href={`?tab=followers`} scroll={false} replace>Followers</Link>
                            </TabsTrigger>
                            <TabsTrigger value="following" variant="underline" className="font-semibold">
                                <Link href={`?tab=following`} scroll={false} replace>Following</Link>
                            </TabsTrigger>
                        </TabsList>
                    </div>
                    <TabsContent value="followers">
                        <UserList
                            userIds={user.followedBy || []}
                            emptyTitle="No Followers Yet"
                            emptyDescription="When other users follow this profile, they will appear here."
                        />
                    </TabsContent>
                    <TabsContent value="following">
                        <UserList
                            userIds={user.following || []}
                            emptyTitle="Not Following Anyone Yet"
                            emptyDescription="When this user follows others, those profiles will appear here."
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}
