
'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect, useRef } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, serverTimestamp as firestoreServerTimestamp, updateDoc } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { Database, ref, onValue, off, onDisconnect, set, serverTimestamp as dbServerTimestamp } from 'firebase/database';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { useDoc, type WithId } from './firestore/use-doc';
import type { User as UserProfile } from '@/lib/types';
import { useCallHandler } from '@/hooks/useCallHandler';
import { CallView } from '@/components/CallView';

interface CallHandlerResult extends ReturnType<typeof useCallHandler> {}

interface FirebaseProviderProps {
  children: React.Node;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  database: Database;
  auth: Auth;
}

// Internal state for user authentication
interface UserAuthState {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Combined state for the Firebase context
export interface FirebaseContextState extends CallHandlerResult {
  areServicesAvailable: boolean; // True if core services (app, firestore, auth instance) are provided
  firebaseApp: FirebaseApp | null;
  firestore: Firestore | null;
  database: Database | null;
  auth: Auth | null; // The Auth service instance
  // User authentication state
  user: User | null;
  isUserLoading: boolean; // True during initial auth check
  userError: Error | null; // Error from auth listener
  // User profile state
  userProfile: WithId<UserProfile> | null;
  isUserProfileLoading: boolean;
}

// Return type for useFirebase()
export interface FirebaseServicesAndUser extends CallHandlerResult {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  database: Database;
  auth: Auth;
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
  userProfile: WithId<UserProfile> | null;
  isUserProfileLoading: boolean;
}

// Return type for useUser() - specific to user auth state
export interface UserHookResult { 
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// React Context
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

/**
 * FirebaseProvider manages and provides Firebase services and user authentication state.
 */
export const FirebaseProvider: React.FC<FirebaseProviderProps> = ({
  children,
  firebaseApp,
  firestore,
  database,
  auth,
}) => {
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    isUserLoading: true, // Start loading until first auth event
    userError: null,
  });
  
  const callHandler = useCallHandler(firestore, userAuthState.user);


  // Effect to subscribe to Firebase auth state changes and manage presence
  useEffect(() => {
    if (!auth || !database || !firestore) { 
      setUserAuthState({ user: null, isUserLoading: false, userError: new Error("Auth, Database or Firestore service not provided.") });
      return;
    }

    setUserAuthState({ user: null, isUserLoading: true, userError: null });

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUserAuthState({ user: firebaseUser, isUserLoading: false, userError: null });
        
        if (firebaseUser) {
            const userStatusDatabaseRef = ref(database, '/status/' + firebaseUser.uid);

            const isOfflineForDatabase = {
                isOnline: false,
                lastSeen: dbServerTimestamp(),
            };

            const isOnlineForDatabase = {
                isOnline: true,
                lastSeen: dbServerTimestamp(),
            };
            
            const conRef = ref(database, '.info/connected');

            onValue(conRef, (snapshot) => {
                if (snapshot.val() === false) {
                    return;
                }

                onDisconnect(userStatusDatabaseRef).set(isOfflineForDatabase).then(() => {
                    set(userStatusDatabaseRef, isOnlineForDatabase);
                });
            });

        }
      },
      (error) => { // Auth listener error
        console.error("FirebaseProvider: onAuthStateChanged error:", error);
        setUserAuthState({ user: null, isUserLoading: false, userError: error });
      }
    );
    return () => unsubscribe(); // Cleanup
  }, [auth, database, firestore]);
  
  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !userAuthState.user) return null;
    return doc(firestore, 'users', userAuthState.user.uid);
  }, [firestore, userAuthState.user]);
  
  const { data: userProfile, isLoading: isUserProfileLoading } = useDoc<UserProfile>(userProfileRef);

  // Memoize the context value
  const contextValue = useMemo((): FirebaseContextState => {
    const servicesAvailable = !!(firebaseApp && firestore && auth && database);
    return {
      areServicesAvailable: servicesAvailable,
      firebaseApp: servicesAvailable ? firebaseApp : null,
      firestore: servicesAvailable ? firestore : null,
      database: servicesAvailable ? database : null,
      auth: servicesAvailable ? auth : null,
      user: userAuthState.user,
      isUserLoading: userAuthState.isUserLoading,
      userError: userAuthState.userError,
      userProfile,
      isUserProfileLoading,
      ...callHandler,
    };
  }, [firebaseApp, firestore, auth, database, userAuthState, userProfile, isUserProfileLoading, callHandler]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
       <CallView
            status={callHandler.callStatus}
            calleeId={callHandler.activeCall?.calleeId}
            callerId={callHandler.activeCall?.callerId}
            isMuted={callHandler.isMuted}
            onToggleMute={callHandler.toggleMute}
            onAccept={callHandler.answerCall}
            onDecline={callHandler.declineCall}
            onHangUp={callHandler.hangUp}
            localStream={callHandler.localStream}
            remoteStream={callHandler.remoteStream}
        />
      {children}
    </FirebaseContext.Provider>
  );
};

/**
 * Hook to access core Firebase services and user authentication state.
 * Throws error if core services are not available or used outside provider.
 */
export const useFirebase = (): FirebaseServicesAndUser => {
  const context = useContext(FirebaseContext);

  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }

  if (!context.areServicesAvailable || !context.firebaseApp || !context.firestore || !context.auth || !context.database) {
    throw new Error('Firebase core services not available. Check FirebaseProvider props.');
  }

  return {
    firebaseApp: context.firebaseApp,
    firestore: context.firestore,
    database: context.database,
    auth: context.auth,
    user: context.user,
    isUserLoading: context.isUserLoading,
    userError: context.userError,
    userProfile: context.userProfile,
    isUserProfileLoading: context.isUserProfileLoading,
    startCall: context.startCall,
    answerCall: context.answerCall,
    declineCall: context.declineCall,
    hangUp: context.hangUp,
    toggleMute: context.toggleMute,
    activeCall: context.activeCall,
    callStatus: context.callStatus,
    localStream: context.localStream,
    remoteStream: context.remoteStream,
    isMuted: context.isMuted,
  };
};

/** Hook to access Firebase Auth instance. */
export const useAuth = (): Auth => {
  const { auth } = useFirebase();
  return auth;
};

/** Hook to access Firestore instance. */
export const useFirestore = (): Firestore => {
  const { firestore } = useFirebase();
  return firestore;
};

/** Hook to access Firebase App instance. */
export const useFirebaseApp = (): FirebaseApp => {
  const { firebaseApp } = useFirebase();
  return firebaseApp;
};

type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(factory, deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;
  
  return memoized;
}
