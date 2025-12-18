"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/get-started');
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="relative flex h-screen w-full items-center justify-center bg-primary">
      <div className="background-grid"></div>
      <h1 className="font-headline text-6xl font-bold text-primary-foreground animate-pulse z-10">
        Blur
      </h1>
    </div>
  );
}
