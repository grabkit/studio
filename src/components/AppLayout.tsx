"use client";

import { useUser } from "@/firebase";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import TopBar from "./layout/TopBar";
import BottomNav from "./layout/BottomNav";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AppLayout({
  children,
  showTopBar = true,
  showBottomNav = true,
}: {
  children: React.ReactNode;
  showTopBar?: boolean;
  showBottomNav?: boolean;
}) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace("/auth");
    }
  }, [user, isUserLoading, router]);

  if (isUserLoading || !user) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="font-headline text-muted-foreground">Loading Your Space</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background">
      {showTopBar && <TopBar />}
      <main
        className={cn(
          "mx-auto max-w-2xl px-0 sm:px-4",
          showTopBar ? "pt-20" : "pt-8",
          showBottomNav ? "pb-28" : "pb-8"
        )}
      >
        {children}
      </main>
      {showBottomNav && <BottomNav />}
    </div>
  );
}
