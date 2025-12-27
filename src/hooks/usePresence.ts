
"use client";

import { useState, useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { ref, onValue, off } from 'firebase/database';

export function usePresence(userId?: string) {
    const { database } = useFirebase();
    const [isOnline, setIsOnline] = useState(false);
    const [lastSeen, setLastSeen] = useState<number | null>(null);

    useEffect(() => {
        if (!database || !userId) {
            setIsOnline(false);
            setLastSeen(null);
            return;
        }

        const userStatusRef = ref(database, 'status/' + userId);

        const listener = onValue(userStatusRef, (snapshot) => {
            const status = snapshot.val();
            console.log('[usePresence] Status for', userId, ':', status); // Debug log
            if (status) {
                setIsOnline(status.isOnline);
                setLastSeen(status.lastSeen);
            } else {
                setIsOnline(false);
                setLastSeen(null);
            }
        });

        return () => {
            off(userStatusRef, 'value', listener);
        };

    }, [database, userId]);

    return { isOnline, lastSeen };
}
