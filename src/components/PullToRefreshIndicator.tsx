
'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshIndicatorProps {
  isRefreshing: boolean;
  pullDistance: number;
}

const PULL_THRESHOLD = 80;

const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({
  isRefreshing,
  pullDistance,
}) => {
  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);

  return (
    <div
      className={cn(
        'absolute top-0 left-0 right-0 flex justify-center items-center h-16 transition-transform duration-200 ease-out',
        isRefreshing ? 'translate-y-0' : '-translate-y-full'
      )}
      style={{
        transform: `translateY(${isRefreshing ? 0 : pullDistance - 64}px)`,
      }}
    >
      <div className="relative h-10 w-10 flex items-center justify-center">
        <AnimatePresence>
          {isRefreshing ? (
            <motion.div
              key="spinner"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="absolute"
            >
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            </motion.div>
          ) : (
            <motion.div
              key="progress"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              className="absolute"
            >
              <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="stroke-muted"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  strokeWidth="3"
                />
                <motion.path
                  className="stroke-primary"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  strokeWidth="3"
                  strokeDasharray="100, 100"
                  initial={{ strokeDashoffset: 100 }}
                  animate={{ strokeDashoffset: 100 - progress * 100 }}
                  transition={{ duration: 0.1, ease: 'linear' }}
                />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default PullToRefreshIndicator;
