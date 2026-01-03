
"use client";

import AppLayout from "@/components/AppLayout";
import { useFirebase, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, orderBy, limit, doc, updateDoc, writeBatch } from "firebase/firestore";
import { useCollection, type WithId } from "@/firebase/firestore/use-collection";
import type { Notification } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from "next/link";
import { Heart, MessageCircle, AlertTriangle, UserUp, Mail } from "lucide-react";
import { cn, formatTimestamp, getInitials } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";

const formatUserId = (uid: string | undefined) => {
  if (!uid) return "blur??????";
  return `blur${uid.substring(uid.length - 6)}`;
};

const notificationInfo = {
    like: {
        icon: Heart,
        text: "liked your post",
        color: "text-pink-500"
    },
    comment: {
        icon: MessageCircle,
        text: "commented on your post",
        color: "text-blue-500"
    },
    comment_approval: {
        icon: AlertTriangle,
        text: "reply needs your approval",
        color: "text-amber-500"
    },
    upvote: {
        icon: UserUp,
        text: "upvoted your profile",
        color: "text-green-500"
    },
    message_request: {
        icon: Mail,
        text: "wants to send you a message",
        color: "text-purple-500"
    }
}


function NotificationItem({ notification }: { notification: WithId<Notification> }) {
    const info = notificationInfo[notification.type] || notificationInfo.comment;
    const Icon = info.icon;
    
    const isProfileActivity = notification.type === 'upvote' || notification.type === 'message_request';
    const linkHref = isProfileActivity ? `/profile/${notification.fromUserId}` : `/post/${notification.postId}`;

    return (
        <Link href={linkHref} className={cn(
            "flex items-start space-x-4 p-4 border-b transition-colors hover:bg-accent",
            !notification.read && "bg-primary/5"
        )}>
             <div className="relative">
                <Avatar className="h-10 w-10">
                    <AvatarFallback>{getInitials(notification.fromUserId)}</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                     <Icon className={cn("h-4 w-4", info.color)} />
                </div>
            </div>
            <div className="flex-1">
                <p className="text-sm">
                    <span className="font-bold">{formatUserId(notification.fromUserId)}</span>
                    {' '}
                    {info.text}
                    {notification.postContent && (
                       <span className="text-muted-foreground italic"> "{notification.postContent}"</span>
                    )}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                    {formatTimestamp(notification.timestamp.toDate())}
                </p>
            </div>
        </Link>
    )
}

function ActivitySkeleton() {
    return (
        <div className="flex items-start space-x-4 p-4 border-b">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
            </div>
        </div>
    )
}


export default function ActivityPage() {
    const { firestore, user } = useFirebase();

    const notificationsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'users', user.uid, 'notifications'),
            orderBy('timestamp', 'desc'),
            limit(50)
        );
    }, [firestore, user]);

    const { data: notifications, isLoading } = useCollection<Notification>(notificationsQuery);
    
    // Mark notifications as read
    useEffect(() => {
        if (!firestore || !user || !notifications) return;

        const unreadNotifications = notifications.filter(n => !n.read);
        if (unreadNotifications.length === 0) return;

        const batch = writeBatch(firestore);
        unreadNotifications.forEach(notif => {
            const notifRef = doc(firestore, 'users', user.uid, 'notifications', notif.id);
            batch.update(notifRef, { read: true });
        });

        batch.commit().catch(err => {
            console.error("Failed to mark notifications as read:", err);
        });

    }, [notifications, firestore, user]);


    return (
        <AppLayout showTopBar={false}>
             <div className="p-4 border-b">
                <h1 className="text-2xl font-bold font-headline">Activity</h1>
            </div>
            <div className="divide-y">
                 {isLoading && (
                    <>
                        <ActivitySkeleton />
                        <ActivitySkeleton />
                        <ActivitySkeleton />
                        <ActivitySkeleton />
                    </>
                 )}
                 {!isLoading && notifications?.length === 0 && (
                    <div className="text-center py-20">
                         <h2 className="text-2xl font-headline text-primary">No Activity Yet</h2>
                        <p className="text-muted-foreground mt-2">Likes and comments on your posts will appear here.</p>
                    </div>
                 )}
                 {notifications?.map(notification => (
                    <NotificationItem key={notification.id} notification={notification} />
                 ))}
            </div>
        </AppLayout>
    )
}
