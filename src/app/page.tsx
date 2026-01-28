
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useFirebase } from '@/firebase';
import { Loader2 } from 'lucide-react';

export default function SplashScreen() {
  const router = useRouter();
  const { user, isUserLoading } = useFirebase();

  useEffect(() => {
    // Wait until the initial user loading is complete
    if (isUserLoading) {
      return;
    }

    const timer = setTimeout(() => {
      if (user) {
        // If user is logged in, go to home
        router.replace('/home');
      } else {
        // If no user, go to the get started page
        router.replace('/get-started');
      }
    }, 1500); // Keep the splash for a bit for branding

    return () => clearTimeout(timer);
  }, [user, isUserLoading, router]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="relative flex h-screen w-full flex-col items-center justify-center bg-background overflow-hidden"
    >
      <div className="flex flex-col items-center justify-center">
        <Image
          src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh5r85BhL7rCkS72xpX_5xkFZ9y_fVMFXYp_zLN9eEAnEA_C61c1jCJFaG86d1W6_mtsla64B191MOWYEFhJAa-lyMikD80WyfBVKiQxyc71spJx3Oy2FgvfotsVVnNIXGRXunpHYYvGFoQ7V-URilBXwJzIV9zQLSO_PN9raerNaTAb0VuCYo9EBqiyVts/s320/New%20Project%2020%20%5BEFC25EE%5D.png"
          alt="Blur Logo"
          width={120}
          height={40}
          priority
          className="dark:hidden"
        />
        <Image
          src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEi6D6Qy-Z4uf0bgTdhcmekuXrwq7YSU5g8a9bmMVwbjotQ6VNa8NHuFnKjytbRlJb5_g_mqhMrrFmXPd_6W9aeFlItcwiIYjYhzorTAMCPvEBiipvksoQmvxEMmc4-CkvHEQxiO-DGiK4uGIS9nxKTFeu29sutuw3TD-T81opk0NRfGqIkdnrxd1nsU1Nbd/s0/blur%20text%20logo%20darktheme.png"
          alt="Blur Logo"
          width={120}
          height={40}
          priority
          className="hidden dark:block"
        />
        {isUserLoading && (
            <div className="absolute bottom-20 flex items-center space-x-2">
                 <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                 <p className="text-sm text-muted-foreground">Checking session...</p>
            </div>
        )}
      </div>
      <p className="absolute bottom-10 text-sm text-muted-foreground font-headline">Anonymous social network</p>
    </motion.div>
  );
}
