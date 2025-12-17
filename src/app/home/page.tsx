"use client";

import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/lib/firebase/auth";

export default function HomePage() {
  const { user } = useAuth();
  return (
    <AppLayout>
      <div className="text-center">
        <h1 className="font-headline text-4xl font-bold text-primary">
          Welcome, {user?.displayName || 'User'}!
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">This is your home screen.</p>
      </div>
    </AppLayout>
  );
}
