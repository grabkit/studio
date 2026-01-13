
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { formatCount } from '@/lib/utils';

interface AnimatedCountProps {
  count: number;
  direction: 'up' | 'down';
}

const variants = {
  enter: (direction: 'up' | 'down') => ({
    y: direction === 'up' ? 10 : -10,
    opacity: 0,
  }),
  center: {
    zIndex: 1,
    y: 0,
    opacity: 1,
  },
  exit: (direction: 'up' | 'down') => ({
    zIndex: 0,
    y: direction === 'up' ? -10 : 10,
    opacity: 0,
  }),
};

export function AnimatedCount({ count, direction }: AnimatedCountProps) {
  if (count <= 0) {
    return <span className="text-xs w-4">&nbsp;</span>;
  }
  
  return (
    <div className="relative h-4 w-4 overflow-hidden text-left flex items-center">
      <AnimatePresence initial={false} custom={direction}>
        <motion.span
          key={count}
          className="absolute w-full h-full text-xs leading-none flex items-center"
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            y: { type: 'spring', stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
          }}
        >
          {formatCount(count)}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
