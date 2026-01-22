
'use client';

import AppLayout from '@/components/AppLayout';
import { Input } from '@/components/ui/input';
import { Search, UserX, Loader2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import type { User } from '@/lib/types';
import type { WithId } from '@/firebase/firestore/use-collection';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getAvatar, formatUserId } from '@/lib/utils';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';

// Debounce hook
function useDebounce(value: string, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}


function UserResultItem({ user }: { user: WithId<User> }) {
  const avatar = getAvatar(user);
  const isAvatarUrl = avatar.startsWith('http');

  return (
    <Link href={`/profile/${user.id}`} className="flex items-center gap-4 p-4 hover:bg-accent transition-colors">
      <Avatar className="h-11 w-11">
        <AvatarImage src={isAvatarUrl ? avatar : undefined} alt={user.name} />
        <AvatarFallback>{!isAvatarUrl ? avatar : ''}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <p className="font-semibold">{formatUserId(user.id)}</p>
        <p className="text-sm text-muted-foreground">{user.name}</p>
      </div>
    </Link>
  )
}

function UserResultSkeleton() {
    return (
        <div className="flex items-center gap-4 p-4">
            <Skeleton className="h-11 w-11 rounded-full" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
            </div>
        </div>
    )
}

export default function SearchPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<WithId<User>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const { firestore, user: currentUser } = useFirebase();

  const searchUsers = useCallback(async (term: string) => {
    if (!firestore || !currentUser) return;
    setIsLoading(true);
    setHasSearched(true);
    try {
      const q = query(
        collection(firestore, "users"),
        where('username', '>=', term),
        where('username', '<=', term + '\uf8ff'),
        limit(15)
      );
      const querySnapshot = await getDocs(q);
      const users = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as WithId<User>))
        .filter(user => user.id !== currentUser.uid); // Filter out the current user

      setResults(users);
    } catch (error) {
      console.error("Error searching users:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [firestore, currentUser]);

  useEffect(() => {
    if (debouncedSearchTerm.trim()) {
      searchUsers(debouncedSearchTerm.trim().toLowerCase());
    } else {
      setResults([]);
      setIsLoading(false);
      setHasSearched(false);
    }
  }, [debouncedSearchTerm, searchUsers]);

  return (
    <AppLayout showTopBar={false}>
      <motion.div
        className="h-full flex flex-col"
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
              placeholder="Search users..."
              className="w-full pl-11 rounded-full bg-secondary"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className='divide-y'>
                <UserResultSkeleton />
                <UserResultSkeleton />
                <UserResultSkeleton />
            </div>
          )}
          {!isLoading && hasSearched && results.length === 0 && (
            <div className="text-center py-20 px-4">
              <div className="inline-block p-4 bg-secondary rounded-full">
                <UserX className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-headline mt-4">No results found</h2>
              <p className="text-muted-foreground mt-2">Try a different search term.</p>
            </div>
          )}
          {!isLoading && results.length > 0 && (
            <div className="divide-y">
              {results.map(user => (
                <UserResultItem key={user.id} user={user} />
              ))}
            </div>
          )}
          {!hasSearched && !isLoading && (
            <div className="text-center py-20 px-4">
              <h2 className="text-2xl font-headline text-primary">Search for people</h2>
              <p className="text-muted-foreground mt-2">Find and connect with others on Blur.</p>
            </div>
          )}
        </div>
      </motion.div>
    </AppLayout>
  );
}
