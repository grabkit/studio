
'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect, useRef } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, updateDoc, deleteField } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { Database, ref, onValue, onDisconnect, set, serverTimestamp as dbServerTimestamp } from 'firebase/database';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { useDoc, type WithId } from './firestore/use-doc';
import type { User as UserProfile } from '@/lib/types';
import { useCallHandler } from '@/hooks/useCallHandler';
import { CallView } from '@/components/CallView';
import { useVideoCallHandler } from '@/hooks/useVideoCallHandler';
import { VideoCallView } from '@/components/VideoCallView';
import { VoiceStatusPlayer } from '@/components/VoiceStatusPlayer';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from './errors';
import { errorEmitter } from './error-emitter';

interface CallHandlerResult extends ReturnType<typeof useCallHandler> {}
interface VideoCallHandlerResult extends ReturnType<typeof useVideoCallHandler> {}


interface FirebaseProviderProps {
  children: React.ReactNode;
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
export interface FirebaseContextState extends CallHandlerResult, VideoCallHandlerResult {
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
  setUserProfile: React.Dispatch<React.SetStateAction<WithId<UserProfile> | null>>;
  setActiveUserProfile: (user: WithId<UserProfile> | null) => void;
  showVoiceStatusPlayer: (user: WithId<UserProfile>) => void;
  isVoicePlayerPlaying: boolean;
  handleDeleteVoiceStatus: () => Promise<void>;
}

// Return type for useFirebase()
export interface FirebaseServicesAndUser extends CallHandlerResult, VideoCallHandlerResult {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  database: Database;
  auth: Auth;
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
  userProfile: WithId<UserProfile> | null;
  isUserProfileLoading: boolean;
  setUserProfile: React.Dispatch<React.SetStateAction<WithId<UserProfile> | null>>;
  setActiveUserProfile: (user: WithId<UserProfile> | null) => void;
  showVoiceStatusPlayer: (user: WithId<UserProfile>) => void;
  isVoicePlayerPlaying: boolean;
  handleDeleteVoiceStatus: () => Promise<void>;
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
  const { toast } = useToast();
  const [userAuthState, setUserAuthState] = useState<UserAuthState>({
    user: null,
    isUserLoading: true, // Start loading until first auth event
    userError: null,
  });
  
  const callHandler = useCallHandler(firestore, userAuthState.user);
  const videoCallHandler = useVideoCallHandler(firestore, userAuthState.user);
  
  const [activeUserProfile, setActiveUserProfile] = useState<WithId<UserProfile> | null>(null);
  const [voiceStatusUser, setVoiceStatusUser] = useState<WithId<UserProfile> | null>(null);
  const [isVoicePlayerPlaying, setIsVoicePlayerPlaying] = useState(false);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  
  const onVoicePlayerClose = () => {
    if (voiceAudioRef.current) {
        voiceAudioRef.current.pause();
        voiceAudioRef.current.currentTime = 0;
    }
    setVoiceStatusUser(null);
    setIsVoicePlayerPlaying(false);
  };

  const showVoiceStatusPlayer = (user: WithId<UserProfile>) => {
    setVoiceStatusUser(user);
    if (voiceAudioRef.current && user.voiceStatusUrl) {
      voiceAudioRef.current.src = user.voiceStatusUrl;
      voiceAudioRef.current.play().catch(e => {
        console.error("Audio play failed:", e);
        // Clean up on failure
        onVoicePlayerClose();
      });
    }
  };
  
  const loggedInUserProfileRef = useMemoFirebase(() => {
    if (!firestore || !userAuthState.user) return null;
    return doc(firestore, 'users', userAuthState.user.uid);
  }, [firestore, userAuthState.user]);
  
  const { data: loggedInUserProfile, isLoading: isUserProfileLoading, setData: setLoggedInUserProfile } = useDoc<UserProfile>(loggedInUserProfileRef);

  const userProfile = activeUserProfile || loggedInUserProfile;

  const handleDeleteVoiceStatus = async () => {
    if (!firestore || !userAuthState.user) return;
    const currentUserId = userAuthState.user.uid;
    const userDocRef = doc(firestore, 'users', currentUserId);
    
    // We don't need optimistic updates. The onSnapshot listener in useDoc will
    // automatically update the UI once the data is deleted from Firestore.
    try {
        await updateDoc(userDocRef, {
            voiceStatusUrl: deleteField(),
            voiceStatusTimestamp: deleteField()
        });
        toast({ title: "Voice Status Deleted" });
    } catch (error) {
        console.error("Failed to delete voice status on server:", error);
        const permissionError = new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'update',
            requestResourceData: { voiceStatusUrl: null, voiceStatusTimestamp: null },
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: "destructive", title: "Error", description: "Could not delete voice status from server." });
    }
  };


  // Effect to manage the global audio element
  useEffect(() => {
    // This effect runs only on the client, creating the audio element safely.
    const audio = new Audio();
    audio.className = 'hidden';
    document.body.appendChild(audio);
    voiceAudioRef.current = audio;

    const handlePlay = () => setIsVoicePlayerPlaying(true);
    const handlePause = () => setIsVoicePlayerPlaying(false);
    const handleEnded = () => onVoicePlayerClose();

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    // Cleanup function to remove the element and listeners
    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      if (document.body.contains(audio)) {
        document.body.removeChild(audio);
      }
      voiceAudioRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs only once on the client


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
      setUserProfile: setLoggedInUserProfile,
      setActiveUserProfile,
      showVoiceStatusPlayer,
      isVoicePlayerPlaying,
      handleDeleteVoiceStatus,
      ...callHandler,
      ...videoCallHandler,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseApp, firestore, auth, database, userAuthState, userProfile, isUserProfileLoading, callHandler, videoCallHandler, isVoicePlayerPlaying]);

  // Determine if the call UI should be shown
  const showCallUI = !!callHandler.callStatus && callHandler.callStatus !== 'ended' && callHandler.callStatus !== 'declined' && callHandler.callStatus !== 'missed';
  const showVideoCallUI = !!videoCallHandler.videoCallStatus && videoCallHandler.videoCallStatus !== 'ended' && videoCallHandler.videoCallStatus !== 'declined' && videoCallHandler.videoCallStatus !== 'missed';

  return (
    <FirebaseContext.Provider value={contextValue}>
      <FirebaseErrorListener />
       {voiceStatusUser && (
        <VoiceStatusPlayer 
          user={voiceStatusUser}
          isOpen={!!voiceStatusUser}
          onOpenChange={(open) => { 
            if (!open) {
                onVoicePlayerClose();
            }
          }}
          onDelete={async () => {
            await handleDeleteVoiceStatus();
            onVoicePlayerClose(); // Close the player after deletion is initiated
          }}
          isVoicePlayerPlaying={isVoicePlayerPlaying}
        />
      )}
      {showVideoCallUI ? (
        <VideoCallView
            status={videoCallHandler.videoCallStatus}
            calleeId={videoCallHandler.activeVideoCall?.calleeId}
            callerId={videoCallHandler.activeVideoCall?.callerId}
            isMuted={videoCallHandler.isVideoMuted}
            isVideoEnabled={videoCallHandler.isVideoEnabled}
            localStream={videoCallHandler.localVideoStream}
            remoteStream={videoCallHandler.remoteVideoStream}
            onToggleMute={videoCallHandler.toggleVideoMute}
            onToggleVideo={videoCallHandler.toggleVideo}
            onAccept={videoCallHandler.answerVideoCall}
            onDecline={videoCallHandler.declineVideoCall}
            onHangUp={videoCallHandler.hangUpVideoCall}
            callDuration={videoCallHandler.videoCallDuration}
        />
      ) : showCallUI ? (
         <CallView
            status={callHandler.callStatus}
            calleeId={callHandler.activeCall?.calleeId}
            callerId={callHandler.activeCall?.callerId}
            isMuted={callHandler.isMuted}
            localStream={callHandler.localStream}
            remoteStream={callHandler.remoteStream}
            onToggleMute={callHandler.toggleMute}
            onAccept={callHandler.answerCall}
            onDecline={callHandler.declineCall}
            onHangUp={callHandler.hangUp}
            callDuration={callHandler.callDuration}
        />
      ) : (
        children
      )}
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
    setUserProfile: context.setUserProfile,
    setActiveUserProfile: context.setActiveUserProfile,
    showVoiceStatusPlayer: context.showVoiceStatusPlayer,
    isVoicePlayerPlaying: context.isVoicePlayerPlaying,
    handleDeleteVoiceStatus: context.handleDeleteVoiceStatus,
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
    callDuration: context.callDuration,
    startVideoCall: context.startVideoCall,
    answerVideoCall: context.answerVideoCall,
    declineVideoCall: context.declineVideoCall,
    hangUpVideoCall: context.hangUpVideoCall,
    toggleVideoMute: context.toggleVideoMute,
    toggleVideo: context.toggleVideo,
    activeVideoCall: context.activeVideoCall,
    videoCallStatus: context.videoCallStatus,
    localVideoStream: context.localVideoStream,
    remoteVideoStream: context.remoteVideoStream,
    isVideoMuted: context.isVideoMuted,
    isVideoEnabled: context.isVideoEnabled,
    videoCallDuration: context.videoCallDuration,
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
