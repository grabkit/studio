"use client";

import { useUser } from "@/firebase";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import TopBar from "./layout/TopBar";
import BottomNav from "./layout/BottomNav";
import { Loader2 } from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
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
      <TopBar />
      <main className="mx-auto max-w-2xl px-0 pt-24 pb-28 sm:px-4">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

    