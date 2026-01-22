
'use client';

import AppLayout from '@/components/AppLayout';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { motion } from 'framer-motion';

export default function SearchPage() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <AppLayout showTopBar={false}>
      <motion.div
        className="h-full"
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {/* Sticky search header */}
        <div className="p-4 border-b sticky top-0 bg-background/80 backdrop-blur-sm z-10">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search Blur..."
              className="w-full pl-11 rounded-full bg-secondary"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Placeholder Content */}
        <div className="text-center py-20 px-4">
          <h2 className="text-2xl font-headline text-primary">Search the Network</h2>
          <p className="text-muted-foreground mt-2">Find posts, people, and conversations.</p>
        </div>
      </motion.div>
    </AppLayout>
  );
}
