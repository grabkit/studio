
"use client";

import { useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";

// Placeholder for the UserList component we will create in the next step
function UserListPlaceholder({ title }: { title: string }) {
    return (
        <div className="text-center py-10">
            <p className="text-muted-foreground">Loading {title}...</p>
        </div>
    );
}

export default function SocialPage() {
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();

    const userId = params.userId as string;
    const activeTab = searchParams.get("tab") || "upvotes";

    const pageTitle = useMemo(() => {
        if (!userId) return "Social";
        // This is a simple example. We can fetch the user's name later.
        return `blur...${userId.substring(userId.length - 4)}`;
    }, [userId]);

    if (!userId) {
        // Handle case where userId is not available
        return (
            <AppLayout showTopBar={false}>
                <div className="p-4">
                    <p>User not found.</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout showTopBar={false}>
            <div className="fixed top-0 left-0 right-0 z-10 flex items-center p-2 bg-background border-b h-14 max-w-2xl mx-auto sm:px-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft />
                </Button>
                <h2 className="text-lg font-bold mx-auto -translate-x-4">{pageTitle}</h2>
            </div>

            <div className="pt-14">
                <Tabs defaultValue={activeTab} className="w-full">
                    <div className="sticky top-14 bg-background z-10 border-b">
                        <TabsList variant="underline" className="grid w-full grid-cols-2">
                            <TabsTrigger value="upvotes" variant="underline" className="font-semibold">
                                <Link href={`?tab=upvotes`} scroll={false} replace>Upvotes</Link>
                            </TabsTrigger>
                            <TabsTrigger value="upvoted" variant="underline" className="font-semibold">
                                <Link href={`?tab=upvoted`} scroll={false} replace>Upvoted</Link>
                            </TabsTrigger>
                        </TabsList>
                    </div>
                    <TabsContent value="upvotes">
                        <UserListPlaceholder title="Upvotes" />
                    </TabsContent>
                    <TabsContent value="upvoted">
                        <UserListPlaceholder title="Upvoted Users" />
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}
