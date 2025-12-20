
"use client";

import AppLayout from "@/components/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MessageSquare, Mail } from "lucide-react";

// Dummy data for UI development
const dummyChats = [
    { id: '1', name: 'John Doe', lastMessage: 'Hey, how are you?', time: '5m' },
    { id: '2', name: 'Jane Smith', lastMessage: 'You: See you then!', time: '1h' },
    { id: '3', name: 'Alex Ray', lastMessage: 'Okay, sounds good.', time: 'yesterday' },
];

const dummyRequests = [
    { id: '4', name: 'Emily White', isSender: false },
    { id: '5', name: 'Chris Green', isSender: true },
];


function ConversationItem({ chat }: { chat: typeof dummyChats[0] }) {
    return (
        <div className="p-4 border-b flex justify-between items-center hover:bg-accent cursor-pointer">
            <div className="flex items-center space-x-3">
                <Avatar className="h-12 w-12">
                    <AvatarFallback>{getInitials(chat.name)}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold">{chat.name}</p>
                    <p className="text-sm text-muted-foreground truncate max-w-xs">{chat.lastMessage}</p>
                </div>
            </div>
            <p className="text-xs text-muted-foreground self-start shrink-0">{chat.time}</p>
        </div>
    );
}

function RequestItem({ request }: { request: typeof dummyRequests[0] }) {
    return (
        <div className="p-4 border-b flex justify-between items-center">
            <div className="flex items-center space-x-3">
                <Avatar className="h-12 w-12">
                    <AvatarFallback>{getInitials(request.name)}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="font-semibold">{request.name}</p>
                    <p className="text-sm text-muted-foreground">Wants to message you</p>
                </div>
            </div>
            {!request.isSender && (
                <Button size="sm">Accept</Button>
            )}
        </div>
    );
}

function ConversationsList({ type }: { type: 'chats' | 'requests' }) {
    const items = type === 'chats' ? dummyChats : dummyRequests;
    const ItemComponent = type === 'chats' ? ConversationItem : RequestItem;
    
    const emptyStateTitle = type === 'chats' ? "No Chats Yet" : "No New Requests";
    const emptyStateDescription = type === 'chats' ? "Start a conversation from a user's post." : "When a user wants to chat, you'll see their request here.";
    const EmptyIcon = type === 'chats' ? MessageSquare : Mail;

    if (items.length === 0) {
        return (
             <div className="text-center py-20 px-4">
                <div className="inline-block p-4 bg-secondary rounded-full">
                    <EmptyIcon className="h-10 w-10 text-primary" />
                </div>
                <h2 className="mt-6 text-xl font-headline text-primary">{emptyStateTitle}</h2>
                <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                   {emptyStateDescription}
                </p>
            </div>
        )
    }

    return (
        <div className="divide-y">
            {/* @ts-ignore */}
            {items.map(item => <ItemComponent key={item.id} {...{[type === 'chats' ? 'chat' : 'request']: item}} />)}
        </div>
    )
}


export default function MessagesPage() {

    return (
        <AppLayout showTopBar={false}>
            <div className="p-4 border-b">
                <h1 className="text-2xl font-bold font-headline">Messages</h1>
            </div>
            
            <Tabs defaultValue="chats" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="chats">Chats</TabsTrigger>
                    <TabsTrigger value="requests">Requests</TabsTrigger>
                </TabsList>
                <TabsContent value="chats">
                    <ConversationsList type="chats" />
                </TabsContent>
                <TabsContent value="requests">
                    <ConversationsList type="requests" />
                </TabsContent>
            </Tabs>

        </AppLayout>
    )
}
