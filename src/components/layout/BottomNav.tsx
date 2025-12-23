"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, User, HomeIcon, UserIcon, Plus, Heart as HeartIcon, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFirebase, useMemoFirebase } from "@/firebase";
import { collection, query, where, limit } from "firebase/firestore";
import type { Notification, Conversation } from "@/lib/types";
import { useCollection } from "@/firebase/firestore/use-collection";
import { useMemo } from "react";

const navItems = [
  { href: "/home", label: "Home", icon: Home, activeIcon: HomeIcon },
  { href: "/activity", label: "Activity", icon: HeartIcon, activeIcon: HeartIcon },
  { href: "/post", label: "Post", icon: Plus, activeIcon: Plus },
  { href: "/messages", label: "Messages", icon: Send, activeIcon: Send },
  { href: "/account", label: "Account", icon: User, activeIcon: UserIcon },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { firestore, user } = useFirebase();

  const unreadNotifsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(
        collection(firestore, 'users', user.uid, 'notifications'),
        where('read', '==', false),
        limit(1)
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


  const hasUnreadActivity = useMemo(() => (unreadNotifications?.length ?? 0) > 0, [unreadNotifications]);
  
  const hasUnreadMessagesOrRequests = useMemo(() => {
    if (!conversations || !user) return false;

    return conversations.some(convo => {
      // Check for unread messages in accepted chats
      const hasUnreadMsg = convo.status === 'accepted' && (convo.unreadCounts?.[user.uid] ?? 0) > 0;
      // Check for new pending requests from other users
      const isNewRequest = convo.status === 'pending' && convo.requesterId !== user.uid;
      
      return hasUnreadMsg || isNewRequest;
    });
  }, [conversations, user]);


  const isMessagesActive = pathname.startsWith('/messages');

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background-blur">
      <nav className="flex h-14 items-center justify-around max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {navItems.map((item) => {
          const isActive = item.href === '/messages' ? isMessagesActive : pathname === item.href;
          const Icon = isActive ? item.activeIcon : item.icon;
          const isActivityTab = item.href === '/activity';
          const isMessagesTab = item.href === '/messages';

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={cn(
                "flex flex-col items-center justify-center w-16 transition-colors duration-200",
                isActive && item.href !== '/post' ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "p-3 rounded-full relative"
              )}>
                <Icon className={cn("h-7 w-7")} fill={(isActive && item.href !== '/post') ? "currentColor" : "none"} />
                {(isActivityTab && hasUnreadActivity) && (
                    <div className="absolute top-3 right-2.5 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-background"></div>
                )}
                {(isMessagesTab && hasUnreadMessagesOrRequests) && (
                    <div className="absolute top-3 right-2.5 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-background"></div>
                )}
              </div>
            </Link>
          );
        })}
      </nav>
    </footer>
  );
}
