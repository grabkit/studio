
"use client";

import AppLayout from "@/components/AppLayout";
import { MessageSquare } from "lucide-react";

export default function MessagesPage() {

    return (
        <AppLayout showTopBar={false}>
            <div className="p-4 border-b">
                <h1 className="text-2xl font-bold font-headline">Messages</h1>
            </div>
            <div className="text-center py-20 px-4">
                <div className="inline-block p-4 bg-secondary rounded-full">
                    <MessageSquare className="h-10 w-10 text-primary" />
                </div>
                <h2 className="mt-6 text-xl font-headline text-primary">Direct Messaging is Coming Soon</h2>
                <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                    This feature is currently under construction. Soon you'll be able to connect and chat directly with other users. Stay tuned!
                </p>
            </div>
        </AppLayout>
    )
}
