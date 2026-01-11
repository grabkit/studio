
"use client";

import AppLayout from "@/components/AppLayout";
import { useFirebase, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, orderBy, limit, doc, updateDoc, writeBatch, getDocs } from "firebase/firestore";
import { useCollection, type WithId } from "@/firebase/firestore/use-collection";
import type { Notification, NotificationSettings } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { Heart, MessageCircle, AlertTriangle, UserPlus, Mail, Repeat, MessageSquareQuote, Newspaper, Loader2 } from "lucide-react";
import { cn, formatTimestamp, getAvatar, formatUserId } from "@/lib/utils.tsx";
import { Button } from "@/components/ui/button";
import React, { useEffect, useState, useRef, useCallback, type TouchEvent, useMemo } from "react";
import { motion } from "framer-motion";
import { PullToRefreshIndicator } from "@/components/PullToRefreshIndicator";

const notificationInfo = {
    like: {
        icon: Heart,
        text: "liked your post",
        color: "text-pink-500",
        settingKey: 'likes',
    },
    comment: {
        icon: MessageCircle,
        text: "replied to your post", 
        color: "text-blue-500",
        settingKey: 'comments',
    },
    comment_approval: {
        icon: AlertTriangle,
        text: "reply needs your approval",
        color: "text-amber-500",
        settingKey: 'comments', // assuming this falls under comments
    },
    follow: {
        icon: UserPlus,
        text: "started following you",
        color: "text-green-500",
        settingKey: 'followers',
    },
    message_request: {
        icon: Mail,
        text: "wants to send you a message",
        color: "text-purple-500",
        settingKey: 'messageRequests',
    },
    repost: {
        icon: Repeat,
        text: "reposted your post",
        color: "text-green-500",
        settingKey: 'reposts',
    },
    quote: {
        icon: MessageSquareQuote,
        text: "quoted your post",
        color: "text-blue-500",
        settingKey: 'reposts', // assuming this falls under reposts
    },
    new_post: {
        icon: Newspaper,
        text: "shared a new thought",
        color: "text-gray-500",
        settingKey: 'reposts', // Assuming this might fall under a general "updates" or similar category. For now, let's tie it to reposts setting.
    }
} as const;


function NotificationItem({ notification }: { notification: WithId<Notification> }) {
    const info = notificationInfo[notification.type as keyof typeof notificationInfo] || notificationInfo.comment;
    const Icon = info.icon;
    
    const isProfileActivity = notification.type === 'follow' || notification.type === 'message_request';
    const linkHref = isProfileActivity ? `/profile/${notification.fromUserId}` : `/post/${notification.postId}`;

    const isFilledIcon = ['like', 'comment', 'message_request', 'repost', 'quote', 'follow'].includes(notification.type);
    
    const avatar = getAvatar({id: notification.fromUserId});
    const isAvatarUrl = avatar.startsWith('http');


    return (
        <Link href={linkHref || '#'} className={cn(
            "flex items-start space-x-4 p-4 transition-colors hover:bg-accent",
            !notification.read && "bg-primary/5"
        )}>
             <div className="relative">
                <Avatar className="h-10 w-10">
                    <AvatarImage src={isAvatarUrl ? avatar : undefined} alt={formatUserId(notification.fromUserId)} />
                    <AvatarFallback>{!isAvatarUrl ? avatar : ''}</AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                     <Icon 
                        className={cn("h-4 w-4", info.color)} 
                        fill={isFilledIcon ? "currentColor" : "none"}
                    />
                </div>
            </div>
            <div className="flex-1">
                <p className="text-sm">
                    <span className="font-bold">{formatUserId(notification.fromUserId)}</span>
                    {' '}
                     {notification.type === 'comment' ? (
                        <>
                        {info.text}
                        {notification.activityContent && (
                           <span className="text-muted-foreground italic"> "{notification.activityContent}"</span>
                        )}
                       </>
                    ) : (
                       <>
                        {info.text}
                        {notification.activityContent && (
                           <span className="text-muted-foreground italic"> "{notification.activityContent}"</span>
                        )}
                       </>
                    )}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                    {notification.timestamp?.toDate ? formatTimestamp(notification.timestamp.toDate()) : '...'}
                </p>
            </div>
        </Link>
    )
}

function ActivitySkeleton() {
    return (
        <div className="flex items-start space-x-4 p-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
            </div>
        </div>
    )
}


export default function ActivityPage() {
    const { firestore, user, userProfile } = useFirebase();

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullPosition, setPullPosition] = useState(0);
    const touchStartRef = useRef(0);
    const containerRef = useRef<HTMLDivElement>(null);

    const notificationsQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'users', user.uid, 'notifications'),
            orderBy('timestamp', 'desc'),
            limit(50)
        );
    }, [firestore, user]);

    const { data: notifications, isLoading, setData: setNotifications } = useCollection<Notification>(notificationsQuery);
    
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

    const fetchNotifications = async () => {
        if (!notificationsQuery) return;
        try {
            const querySnapshot = await getDocs(notificationsQuery);
            const fetchedNotifications = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as WithId<Notification>));
            setNotifications(fetchedNotifications);
        } catch (error) {
            console.error("Error fetching notifications:", error);
        }
    };
    
    const settings = useMemo(() => {
        return userProfile?.notificationSettings || {
            push: true,
            likes: true,
            comments: true,
            reposts: true,
            followers: true,
            messageRequests: true,
        };
    }, [userProfile]);

    const filteredNotifications = useMemo(() => {
        if (!notifications) return [];
        if (!settings.push) return []; // If push notifications are off, show nothing.
        
        return notifications.filter(notification => {
             const type = notification.type as keyof typeof notificationInfo;
             const info = notificationInfo[type];
             if (info && info.settingKey) {
                 return settings[info.settingKey as keyof NotificationSettings] !== false; // Show if setting is true or undefined
             }
             return true; // Show notifications that don't have a specific setting (e.g. comment_approval)
        });

    }, [notifications, settings]);


    const handleRefresh = async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        window.navigator.vibrate?.(50);
        await fetchNotifications();
        setTimeout(() => {
            setIsRefreshing(false);
            setPullPosition(0);
            window.navigator.vibrate?.(50);
        }, 500);
    };

    const handleTouchStart = (e: TouchEvent) => {
        touchStartRef.current = e.targetTouches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
        const touchY = e.targetTouches[0].clientY;
        const pullDistance = touchY - touchStartRef.current;
        
        if (containerRef.current && containerRef.current.scrollTop === 0 && pullDistance > 0 && !isRefreshing) {
            e.preventDefault();
            const newPullPosition = Math.min(pullDistance, 120);
            
            if (pullPosition <= 70 && newPullPosition > 70) {
                window.navigator.vibrate?.(50);
            }
            setPullPosition(newPullPosition);
        }
    };

    const handleTouchEnd = () => {
        if (pullPosition > 70) {
            handleRefresh();
        } else {
            setPullPosition(0);
        }
    };


    return (
        <AppLayout showTopBar={false}>
             <motion.div
                className="h-full"
                initial={{ scale: 0.98, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
            >
                <div
                    ref={containerRef}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    className="relative h-full overflow-y-auto"
                >
                    <PullToRefreshIndicator pullPosition={pullPosition} isRefreshing={isRefreshing} />

                    <div style={{ transform: `translateY(${pullPosition}px)` }}>
                        <div className="p-4 border-b">
                            <h1 className="text-2xl font-bold font-headline">Activity</h1>
                        </div>
                        <div>
                            {isLoading && (
                                <>
                                    <ActivitySkeleton />
                                    <ActivitySkeleton />
                                    <ActivitySkeleton />
                                    <ActivitySkeleton />
                                </>
                            )}
                            {!isLoading && filteredNotifications?.length === 0 && (
                                <div className="text-center py-20">
                                    <h2 className="text-2xl font-headline text-primary">No Activity Yet</h2>
                                    <p className="text-muted-foreground mt-2">Likes and comments on your posts will appear here.</p>
                                </div>
                            )}
                            {filteredNotifications?.map(notification => (
                                <NotificationItem key={notification.id} notification={notification} />
                            ))}
                        </div>
                    </div>
                </div>
            </motion.div>
        </AppLayout>
    )
}
