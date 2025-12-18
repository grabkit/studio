"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, User, HomeIcon, UserIcon, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/home", label: "Home", icon: Home, activeIcon: HomeIcon },
  { href: "/post", label: "Post", icon: Plus, activeIcon: Plus },
  { href: "/account", label: "Account", icon: User, activeIcon: UserIcon },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background-blur">
      <nav className="flex h-14 items-center justify-around max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = isActive ? item.activeIcon : item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={cn(
                "flex flex-col items-center justify-center w-20 transition-colors duration-200",
                isActive && item.href !== '/post' ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className={cn(
                "p-3 rounded-full"
              )}>
                <Icon className={cn("h-7 w-7")} fill={(isActive && item.href !== '/post') ? "currentColor" : "none"} />
              </div>
            </Link>
          );
        })}
      </nav>
    </footer>
  );
}
