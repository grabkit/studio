
'use client';

import React, { useEffect, useState } from 'react';
import { useFcm } from '@/hooks/useFcm';
import { Button } from '@/components/ui/button';
import { Bell, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const BANNER_DISMISSED_KEY = 'notification_banner_dismissed';

export function NotificationPermissionGate() {
  const { permission, requestPermission } = useFcm();
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Only run on the client
    if (typeof window === 'undefined') return;

    const bannerDismissed = localStorage.getItem(BANNER_DISMISSED_KEY);

    // Show banner only if permission is 'default' and it hasn't been dismissed before.
    const timer = setTimeout(() => {
      if (permission === 'default' && !bannerDismissed) {
        setShowBanner(true);
      }
    }, 3000); // 3-second delay

    return () => clearTimeout(timer);
  }, [permission]);

  const handleRequestPermission = () => {
    localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
    setShowBanner(false);
    requestPermission();
  };

  const handleDismiss = () => {
    localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
    setShowBanner(false);
  };

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="bg-secondary p-3 rounded-lg m-4 flex items-center justify-between gap-4"
        >
          <Bell className="h-5 w-5 text-secondary-foreground flex-shrink-0" />
          <p className="text-sm text-secondary-foreground flex-grow">
            Enable notifications to stay updated on likes, comments, and messages.
          </p>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleRequestPermission}>
              Enable
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDismiss}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
