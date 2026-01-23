
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, HomeIcon, Search, Heart as HeartIcon, Send, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, where, limit } from "firebase/firestore";
import type { Notification, Conversation, NotificationSettings } from "@/lib/types";
import { useCollection } from "@/firebase/firestore/use-collection";
import { useMemo, useState, useCallback } from "react";
import { eventBus } from "@/lib/event-bus";

const navItems = [
  { href: "/home", label: "Home", icon: Home, activeIcon: HomeIcon, event: "refresh-home" },
  { href: "/activity", label: "Activity", icon: HeartIcon, activeIcon: HeartIcon, event: "refresh-activity" },
  { href: "/search", label: "Search", icon: Search, activeIcon: Search },
  { href: "/messages", label: "Messages", icon: Send, activeIcon: Send, event: "refresh-messages" },
  { href: "/account", label: "Account", icon: User, activeIcon: User },
];

// This needs to be consistent with the definition in activity/page.tsx
const notificationInfo: Record<string, { settingKey?: keyof Omit<NotificationSettings, 'push'> }> = {
    like: { settingKey: 'likes' },
    comment: { settingKey: 'comments' },
    comment_approval: { settingKey: 'comments' },
    follow: { settingKey: 'followers' },
    message_request: { settingKey: 'messageRequests' },
    repost: { settingKey: 'reposts' },
    quote: { settingKey: 'reposts' },
    new_post: { settingKey: 'reposts' },
};


export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter(); // For navigation
  const { firestore, user, userProfile } = useFirebase();
  const [lastTap, setLastTap] = useState(0);

  const unreadNotifsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
        collection(firestore, 'users', user.uid, 'notifications'),
        where('read', '==', false)
    );
  }, [firestore, user]);

  const conversationsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(
        collection(firestore, 'conversations'),
        where('participantIds', 'array-contains', user.uid)
    );
  }, [user, firestore]);

  const { data: unreadNotifications } = useCollection<Notification>(unreadNotifsQuery);
  const { data: conversations } = useCollection<Conversation>(conversationsQuery);

  const notificationSettings = useMemo(() => {
    return userProfile?.notificationSettings || {
        likes: true,
        comments: true,
        reposts: true,
        followers: true,
        messageRequests: true,
    };
  }, [userProfile]);

  const hasUnreadActivity = useMemo(() => {
    if (!unreadNotifications || unreadNotifications.length === 0) return false;

    const visibleUnread = unreadNotifications.filter(notification => {
        const type = notification.type as keyof typeof notificationInfo;
        const info = notificationInfo[type];
        
        if (info && info.settingKey) {
            return notificationSettings[info.settingKey as keyof NotificationSettings] !== false;
        }

        return true; 
    });

    return visibleUnread.length > 0;
  }, [unreadNotifications, notificationSettings]);
  
  const hasUnreadMessagesOrRequests = useMemo(() => {
    if (!conversations || !user) return false;

    return conversations.some(convo => {
      const hasUnreadMsg = convo.status === 'accepted' && (convo.unreadCounts?.[user.uid] ?? 0) > 0;
      const isNewRequest = convo.status === 'pending' && convo.requesterId !== user.uid;
      
      return hasUnreadMsg || isNewRequest;
    });
  }, [conversations, user]);


  const handleNavClick = useCallback((itemHref: string, itemEvent?: string) => {
    const now = Date.now();
    const isMessagesPath = itemHref === '/messages';
    const isActive = isMessagesPath ? pathname.startsWith(itemHref) : pathname === itemHref;

    if (isActive) {
        // It's the active tab, check for double tap
        if (now - lastTap < 300) {
            // Double tap
            if (itemEvent) {
                eventBus.emit(itemEvent);
            }
            setLastTap(0); // Reset tap timer
        } else {
            // First tap on active tab
            setLastTap(now);
        }
    } else {
        // Not the active tab, just navigate
        router.push(itemHref);
        setLastTap(0); // Reset on navigation
    }
  }, [lastTap, pathname, router]);


  const isMessagesActive = pathname.startsWith('/messages');

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background-blur">
      <nav className="flex h-14 items-center justify-around max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {navItems.map((item) => {
          const isActive = item.href === '/messages' ? isMessagesActive : pathname === item.href;
          const Icon = isActive ? item.activeIcon : item.icon;
          const isActivityTab = item.href === '/activity';
          const isMessagesTab = item.href === '/messages';
          const isSearchTab = item.href === '/search';

          return (
            <button
              key={item.href}
              onClick={() => handleNavClick(item.href, item.event)}
              aria-label={item.label}
              className={cn(
                "flex flex-col items-center justify-center w-16 transition-colors duration-200",
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "p-3 rounded-full relative"
              )}>
                <Icon className={cn("h-7 w-7")} fill={isActive && !isSearchTab ? "currentColor" : "none"} />
                {(isActivityTab && hasUnreadActivity) && (
                    <div className="absolute top-3 right-2.5 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-background"></div>
                )}
                {(isMessagesTab && hasUnreadMessagesOrRequests) && (
                    <div className="absolute top-3 right-2.5 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-background"></div>
                )}
              </div>
            </button>
          );
        })}
      </nav>
    </footer>
  );
}
