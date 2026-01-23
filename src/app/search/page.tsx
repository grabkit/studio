'use client';

import AppLayout from '@/components/AppLayout';
import { Input } from '@/components/ui/input';
import { Search, UserX, Loader2 } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useFirebase } from '@/firebase';
import { collection, query, where, getDocs, limit, orderBy, runTransaction, doc, increment, arrayRemove, arrayUnion, setDoc, serverTimestamp } from 'firebase/firestore';
import type { User, Notification } from '@/lib/types';
import type { WithId } from '@/firebase/firestore/use-collection';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getAvatar, formatUserId } from '@/lib/utils';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

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


// Search result item
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

// Follow suggestion item
function FollowSuggestionItem({ user, isFollowing, onFollow }: { user: WithId<User>, isFollowing: boolean, onFollow: (userId: string, isFollowing: boolean) => void }) {
    const avatar = getAvatar(user);
    const isAvatarUrl = avatar.startsWith('http');

    return (
        <div className="flex items-center gap-4 p-4">
            <Link href={`/profile/${user.id}`} className="flex items-center gap-4 flex-1">
                 <Avatar className="h-11 w-11">
                    <AvatarImage src={isAvatarUrl ? avatar : undefined} alt={user.name} />
                    <AvatarFallback>{!isAvatarUrl ? avatar : ''}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                    <p className="font-semibold">{formatUserId(user.id)}</p>
                    <p className="text-sm text-muted-foreground">{user.name}</p>
                </div>
            </Link>
            <Button
                variant={isFollowing ? 'secondary' : 'default'}
                size="sm"
                onClick={() => onFollow(user.id, isFollowing)}
            >
                {isFollowing ? 'Following' : 'Follow'}
            </Button>
        </div>
    )
}


export default function SearchPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<WithId<User>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  const [suggestions, setSuggestions] = useState<WithId<User>[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);

  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const { firestore, user: currentUser, userProfile, setUserProfile } = useFirebase();
  const { toast } = useToast();
  
  // Fetch follow suggestions
  useEffect(() => {
    if (!firestore || !currentUser) return;
    
    const fetchSuggestions = async () => {
        setSuggestionsLoading(true);
        try {
            const q = query(
                collection(firestore, "users"),
                orderBy("createdAt", "desc"),
                limit(20)
            );
            const querySnapshot = await getDocs(q);
            const fetchedUsers = querySnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as WithId<User>))
                .filter(user => user.id !== currentUser.uid); // Filter out the current user
            
            setSuggestions(fetchedUsers);
        } catch (error) {
            console.error("Error fetching follow suggestions:", error);
        } finally {
            setSuggestionsLoading(false);
        }
    };
    
    fetchSuggestions();
  }, [firestore, currentUser]);
  

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
  
  const handleFollow = useCallback(async (targetUserId: string, isCurrentlyFollowing: boolean) => {
    if (!firestore || !currentUser || !userProfile || !setUserProfile) return;

    const currentUserRef = doc(firestore, 'users', currentUser.uid);
    const targetUserRef = doc(firestore, 'users', targetUserId);

    // Optimistic UI update
    const originalFollowing = userProfile.following || [];
    const newFollowing = isCurrentlyFollowing
        ? originalFollowing.filter(id => id !== targetUserId)
        : [...originalFollowing, targetUserId];

    setUserProfile({ ...userProfile, following: newFollowing });
    
    try {
        await runTransaction(firestore, async (transaction) => {
            const currentUserDoc = await transaction.get(currentUserRef);
            const targetUserDoc = await transaction.get(targetUserRef);

            if (!currentUserDoc.exists() || !targetUserDoc.exists()) {
                throw "User document not found";
            }
            
            if (isCurrentlyFollowing) {
                // Unfollow
                transaction.update(currentUserRef, { following: arrayRemove(targetUserId), followingCount: increment(-1) });
                transaction.update(targetUserRef, { followedBy: arrayRemove(currentUser.uid), followersCount: increment(-1) });
            } else {
                // Follow
                transaction.update(currentUserRef, { following: arrayUnion(targetUserId), followingCount: increment(1) });
                transaction.update(targetUserRef, { followedBy: arrayUnion(currentUser.uid), followersCount: increment(1) });
            }
        });
        
        if (!isCurrentlyFollowing) {
            // Send notification only on follow
            const notificationRef = doc(collection(firestore, 'users', targetUserId, 'notifications'));
            const notificationData: Omit<Notification, 'id'> = {
                type: 'follow',
                fromUserId: currentUser.uid,
                timestamp: serverTimestamp(),
                read: false,
            };
            await setDoc(notificationRef, { ...notificationData, id: notificationRef.id });
        }
    } catch(err) {
        // Revert optimistic update on failure
        setUserProfile({ ...userProfile, following: originalFollowing });
        console.error("Follow transaction failed:", err);
        const permissionError = new FirestorePermissionError({
            path: currentUserRef.path,
            operation: 'update',
            requestResourceData: { following: 'arrayUnion/arrayRemove' },
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: 'destructive', title: "Error", description: `Could not ${isCurrentlyFollowing ? 'unfollow' : 'follow'} user.` });
    }
}, [firestore, currentUser, userProfile, setUserProfile, toast]);

  return (
    <AppLayout showTopBar={false}>
      <motion.div
        className="h-full flex flex-col"
        initial={{ scale: 0.98, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
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
            <div>
                 <h2 className="p-4 text-lg font-bold font-headline">Follow suggestions</h2>
                 {suggestionsLoading && (
                     <div className='divide-y'>
                        <UserResultSkeleton />
                        <UserResultSkeleton />
                        <UserResultSkeleton />
                    </div>
                 )}
                 {!suggestionsLoading && suggestions.length > 0 && (
                     <div className="divide-y">
                         {suggestions.map(user => (
                             <FollowSuggestionItem
                                key={user.id}
                                user={user}
                                isFollowing={userProfile?.following?.includes(user.id) ?? false}
                                onFollow={handleFollow}
                             />
                         ))}
                     </div>
                 )}
                 {!suggestionsLoading && suggestions.length === 0 && (
                      <div className="text-center py-10 px-4">
                        <p className="text-muted-foreground">No suggestions right now. Check back later!</p>
                    </div>
                 )}
            </div>
          )}
        </div>
      </motion.div>
    </AppLayout>
  );
}
