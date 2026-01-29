
'use client';

import React, { DependencyList, createContext, useContext, ReactNode, useMemo, useState, useEffect, useRef } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, updateDoc, deleteField } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import { Database, ref, onValue, onDisconnect, set, serverTimestamp as dbServerTimestamp } from 'firebase/database';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { useDoc, type WithId } from './firestore/use-doc';
import type { User as UserProfile, Call, CallStatus, VideoCall, VideoCallStatus } from '@/lib/types';
import { VoiceStatusPlayer } from '@/components/VoiceStatusPlayer';
import { useToast } from '@/hooks/use-toast';
import { FirestorePermissionError } from './errors';
import { errorEmitter } from './error-emitter';
import { getFormattedUserIdString } from '@/lib/utils.tsx';
import { useCallHandler } from '@/hooks/useCallHandler';
import { IncomingCallView } from '@/components/IncomingCallView';
import { OnCallView } from '@/components/OnCallView';
import { useVideoCallHandler } from '@/hooks/useVideoCallHandler';
import { IncomingVideoCallView } from '@/components/IncomingVideoCallView';
import { VideoCallView } from '@/components/VideoCallView';


// Internal state for user authentication
interface UserAuthState {
  user: User | null;
  isUserLoading: boolean;
  userError: Error | null;
}

// Combined state for the Firebase context
export interface FirebaseContextState {
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
  // Voice Call State
  startCall: (calleeId: string) => void;
  activeCall: WithId<Call> | null;
  incomingCall: WithId<Call> | null;
  callStatus: CallStatus | null;
  acceptCall: () => void;
  declineCall: () => void;
  hangUp: () => void;
  // Video Call State
  startVideoCall: (calleeId: string) => void;
  activeVideoCall: WithId<VideoCall> | null;
  incomingVideoCall: WithId<VideoCall> | null;
  videoCallStatus: VideoCallStatus | null;
  acceptVideoCall: () => void;
  declineVideoCall: () => void;
  hangUpVideoCall: () => void;
}

// Return type for useFirebase()
export interface FirebaseServicesAndUser extends Omit<FirebaseContextState, 'areServicesAvailable'> {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  database: Database;
  auth: Auth;
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
  
  const [activeUserProfile, setActiveUserProfile] = useState<WithId<UserProfile> | null>(null);
  const [voiceStatusUser, setVoiceStatusUser] = useState<WithId<UserProfile> | null>(null);
  const [isVoicePlayerPlaying, setIsVoicePlayerPlaying] = useState(false);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  // Voice Call Hook
  const {
      startCall,
      acceptCall,
      declineCall,
      hangUp,
      activeCall,
      incomingCall,
      callStatus,
      remoteStream,
  } = useCallHandler(firestore, userAuthState.user);
  
  // Video Call Hook
  const videoCallHandler = useVideoCallHandler(firestore, userAuthState.user);

  
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
        onVoicePlayerClose();
      });
    }
  };

  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  useEffect(() => {
    if (isMounted && remoteStream && remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        remoteAudioRef.current.play().catch(e => console.error("Error playing remote audio:", e));
    }
  }, [isMounted, remoteStream]);
  
  const loggedInUserProfileRef = useMemoFirebase(() => {
    if (!firestore || !userAuthState.user) return null;
    return doc(firestore, 'users', userAuthState.user.uid);
  }, [firestore, userAuthState.user]);
  
  const { data: loggedInUserProfile, isLoading: isUserProfileLoading, setData: setLoggedInUserProfile } = useDoc<UserProfile>(loggedInUserProfileRef);

  const userProfile = activeUserProfile || loggedInUserProfile;
  
  const callerId = incomingCall?.callerId;
  const callerRef = useMemoFirebase(() => {
    if (!firestore || !callerId) return null;
    return doc(firestore, 'users', callerId);
  }, [firestore, callerId]);
  const { data: callerProfile } = useDoc<UserProfile>(callerRef);
  
  const videoCallerId = videoCallHandler.incomingCall?.callerId;
  const videoCallerRef = useMemoFirebase(() => {
    if (!firestore || !videoCallerId) return null;
    return doc(firestore, 'users', videoCallerId);
  }, [firestore, videoCallerId]);
  const { data: videoCallerProfile } = useDoc<UserProfile>(videoCallerRef);


  const remoteUserId = activeCall?.participantIds?.find(id => id !== userAuthState.user?.uid);
  const remoteUserRef = useMemoFirebase(() => {
      if (!firestore || !remoteUserId) return null;
      return doc(firestore, 'users', remoteUserId);
  }, [firestore, remoteUserId]);
  const { data: remoteUserProfile } = useDoc<UserProfile>(remoteUserRef);
  
  const remoteVideoUserId = videoCallHandler.activeCall?.participantIds?.find(id => id !== userAuthState.user?.uid);
  const remoteVideoUserRef = useMemoFirebase(() => {
    if (!firestore || !remoteVideoUserId) return null;
    return doc(firestore, 'users', remoteVideoUserId);
  }, [firestore, remoteVideoUserId]);
  const { data: remoteVideoUserProfile } = useDoc<UserProfile>(remoteVideoUserRef);


  // Backfill username for existing users
  useEffect(() => {
    if (firestore && userAuthState.user && loggedInUserProfile && !loggedInUserProfile.username) {
      const userDocRef = doc(firestore, 'users', userAuthState.user.uid);
      const username = getFormattedUserIdString(userAuthState.user.uid).toLowerCase();

      updateDoc(userDocRef, { username: username })
        .then(() => {
          setLoggedInUserProfile(currentProfile => {
            if (!currentProfile) return null;
            return { ...currentProfile, username: username };
          });
          console.log(`Successfully backfilled username for user ${'${userAuthState.user.uid}'}`);
        })
        .catch(error => {
          console.error("Error backfilling username:", error);
        });
    }
  }, [firestore, userAuthState.user, loggedInUserProfile, setLoggedInUserProfile]);

  const handleDeleteVoiceStatus = async () => {
    if (!firestore || !userAuthState.user) return;
    const currentUserId = userAuthState.user.uid;
    const userDocRef = doc(firestore, 'users', currentUserId);

    setLoggedInUserProfile(currentProfile => {
        if (!currentProfile) return null;
        const { voiceStatusUrl, voiceStatusTimestamp, ...rest } = currentProfile;
        return rest as WithId<UserProfile>;
    });

    try {
        await updateDoc(userDocRef, {
            voiceStatusUrl: deleteField(),
            voiceStatusTimestamp: deleteField()
        });
        toast({ title: "Voice Status Deleted" });
    } catch (error) {
        const originalProfile = loggedInUserProfile;
        setLoggedInUserProfile(originalProfile);
        
        console.error("Failed to delete voice status on server:", error);
        const permissionError = new FirestorePermissionError({
            path: userDocRef.path,
            operation: 'update',
            requestResourceData: { voiceStatusUrl: null, voiceStatusTimestamp: null },
        });
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: "destructive", title: "Error", description: "Could not delete voice status." });
    }
  };


  // Effect to manage the global audio element
  useEffect(() => {
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
  }, []);


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
      (error) => {
        console.error("FirebaseProvider: onAuthStateChanged error:", error);
        setUserAuthState({ user: null, isUserLoading: false, userError: error });
      }
    );
    return () => unsubscribe();
  }, [auth, database, firestore]);

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
      // Voice Call
      startCall,
      activeCall,
      incomingCall,
      callStatus,
      acceptCall,
      declineCall,
      hangUp,
      // Video Call
      startVideoCall: videoCallHandler.startCall,
      activeVideoCall: videoCallHandler.activeCall,
      incomingVideoCall: videoCallHandler.incomingCall,
      videoCallStatus: videoCallHandler.callStatus,
      acceptVideoCall: videoCallHandler.acceptCall,
      declineVideoCall: videoCallHandler.declineCall,
      hangUpVideoCall: videoCallHandler.hangUp,
    };
  }, [
      firebaseApp, firestore, auth, database, userAuthState, userProfile, isUserProfileLoading, isVoicePlayerPlaying, 
      setLoggedInUserProfile, startCall, activeCall, incomingCall, callStatus, acceptCall, declineCall, hangUp,
      videoCallHandler
  ]);

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
            onVoicePlayerClose();
          }}
          isVoicePlayerPlaying={isVoicePlayerPlaying}
        />
      )}
      {incomingCall && <IncomingCallView caller={callerProfile} onAccept={acceptCall} onDecline={declineCall} />}
      {activeCall && callStatus !== 'ended' && callStatus !== 'declined' && callStatus !== 'missed' && (
        <OnCallView remoteUser={remoteUserProfile} status={callStatus} onHangUp={hangUp} isMuted={false} toggleMute={() => {}} />
      )}
      
      {videoCallHandler.incomingCall && <IncomingVideoCallView caller={videoCallerProfile} onAccept={videoCallHandler.acceptCall} onDecline={videoCallHandler.declineCall} />}
      {videoCallHandler.activeCall && videoCallHandler.callStatus && !['ended', 'declined', 'missed'].includes(videoCallHandler.callStatus) && (
        <VideoCallView 
            remoteUser={remoteVideoUserProfile} 
            status={videoCallHandler.callStatus}
            onHangUp={videoCallHandler.hangUp}
            isMuted={videoCallHandler.isMuted}
            toggleMute={videoCallHandler.toggleMute}
            isVideoEnabled={videoCallHandler.isVideoEnabled}
            toggleVideo={videoCallHandler.toggleVideo}
            localStream={videoCallHandler.localStream}
            remoteStream={videoCallHandler.remoteStream}
        />
      )}

      {isMounted && <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />}
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = (): FirebaseServicesAndUser => {
  const context = useContext(FirebaseContext);

  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }

  if (!context.areServicesAvailable || !context.firebaseApp || !context.firestore || !context.auth || !context.database) {
    throw new Error('Firebase core services not available. Check FirebaseProvider props.');
  }

  return context as FirebaseServicesAndUser;
};

export const useAuth = (): Auth => {
  const { auth } = useFirebase();
  return auth;
};

export const useFirestore = (): Firestore => {
  const { firestore } = useFirebase();
  return firestore;
};

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
