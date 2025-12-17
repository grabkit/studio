"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PlusSquare, User, HomeIcon, PlusSquareIcon, UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/home", label: "Home", icon: Home, activeIcon: HomeIcon },
  { href: "/post", label: "Post", icon: PlusSquare, activeIcon: PlusSquareIcon },
  { href: "/account", label: "Account", icon: User, activeIcon: UserIcon },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background-blur">
      <nav className="flex h-20 items-center justify-around max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = isActive ? item.activeIcon : item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-20 transition-colors duration-200",
                isActive ? "text-primary" : "text-muted-foreground hover:text-primary"
              )}
            >
              <Icon className="h-6 w-6" fill={isActive ? "currentColor" : "none"} />
              <span className={cn(
                "text-xs font-medium font-headline",
                isActive ? "font-bold" : "font-normal"
                )}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </footer>
  );
}
