
"use client";

import { useFirebase, useUser } from "@/firebase";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import TopBar from "./layout/TopBar";
import BottomNav from "./layout/BottomNav";
import { Loader2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { signOut } from "firebase/auth";
import { eventBus } from "@/lib/event-bus";

function AccountStatusScreen({ status, onLogout }: { status: 'suspended' | 'banned', onLogout: () => void }) {
    const title = status === 'suspended' ? 'Account Suspended' : 'Account Banned';
    const description = status === 'suspended'
        ? "Your account has been temporarily suspended due to a violation of our community guidelines. You cannot post, comment, or interact with other users during this time."
        : "Your account has been permanently banned due to repeated or severe violations of our community guidelines.";

    return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-center p-4">
            <div className="flex flex-col items-center space-y-4 max-w-sm">
                <ShieldAlert className="h-16 w-16 text-destructive" />
                <h1 className="text-2xl font-bold font-headline">{title}</h1>
                <p className="text-muted-foreground">
                    {description}
                </p>
                <Button onClick={onLogout} variant="outline">Logout</Button>
            </div>
        </div>
    );
}


export default function AppLayout({
  children,
  showTopBar = true,
  showBottomNav = true,
}: {
  children: React.ReactNode;
  showTopBar?: boolean;
  showBottomNav?: boolean;
}) {
  const { user, isUserLoading, userProfile, isUserProfileLoading, auth } = useFirebase();
  const router = useRouter();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace("/auth");
    }
  }, [user, isUserLoading, router]);

  useEffect(() => {
    const handleScrollToTop = () => {
      mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    };
    eventBus.on('scroll-main-to-top', handleScrollToTop);
    return () => {
      eventBus.off('scroll-main-to-top', handleScrollToTop);
    };
  }, []);

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
    router.push("/auth");
  }

  if (isUserLoading || isUserProfileLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="font-headline text-muted-foreground">Initializing</p>
      </div>
    );
  }
  
  if (userProfile && (userProfile.status === 'suspended' || userProfile.status === 'banned')) {
    return <AccountStatusScreen status={userProfile.status} onLogout={handleLogout} />;
  }


  if (!user) {
    // This case will be hit briefly during the redirect, show a loader
     return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }


  return (
    <div className="relative h-screen flex flex-col bg-background">
      {showTopBar && <TopBar />}
      <main
        ref={mainRef}
        className={cn(
          "mx-auto max-w-2xl w-full flex-1 overflow-y-auto",
          showTopBar ? "pt-12" : "",
          showBottomNav ? "pb-14" : ""
        )}
      >
        {children}
      </main>
      {showBottomNav && <BottomNav />}
    </div>
  );
}
