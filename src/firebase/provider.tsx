

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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Phone, Video, PhoneOff } from 'lucide-react';
import { formatUserId, getAvatar } from '@/lib/utils.tsx';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


interface CallHandlerResult extends ReturnType<typeof useCallHandler> {}
interface VideoCallHandlerResult extends ReturnType<typeof useVideoCallHandler> {}

type MissedCallInfo = {
  calleeId: string;
  type: 'voice' | 'video';
};

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
  missedCallInfo: MissedCallInfo | null;
  setMissedCallInfo: React.Dispatch<React.SetStateAction<MissedCallInfo | null>>;
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
  missedCallInfo: MissedCallInfo | null;
  setMissedCallInfo: React.Dispatch<React.SetStateAction<MissedCallInfo | null>>;
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
  
  const [missedCallInfo, setMissedCallInfo] = useState<MissedCallInfo | null>(null);

  const callHandler = useCallHandler(firestore, userAuthState.user, setMissedCallInfo);
  const videoCallHandler = useVideoCallHandler(firestore, userAuthState.user, setMissedCallInfo);
  
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

    // Optimistic update of local state before async call
    setLoggedInUserProfile(currentProfile => {
        if (!currentProfile) return null;
        const { voiceStatusUrl, voiceStatusTimestamp, ...rest } = currentProfile;
        return rest as WithId<UserProfile>; // Cast after removing fields
    });

    try {
        await updateDoc(userDocRef, {
            voiceStatusUrl: deleteField(),
            voiceStatusTimestamp: deleteField()
        });
        toast({ title: "Voice Status Deleted" });
    } catch (error) {
        // Revert optimistic update on error by re-fetching or using a backup
        // For simplicity, we refetch here by invalidating the doc hook,
        // but a better UX might restore the previous state instantly.
        const originalProfile = loggedInUserProfile; // closure capture
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
      missedCallInfo,
      setMissedCallInfo,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firebaseApp, firestore, auth, database, userAuthState, userProfile, isUserProfileLoading, callHandler, videoCallHandler, isVoicePlayerPlaying, setLoggedInUserProfile, missedCallInfo]);

  // Determine if the call UI should be shown
  const showCallUI = !!callHandler.callStatus && callHandler.callStatus !== 'ended' && callHandler.callStatus !== 'declined' && callHandler.callStatus !== 'missed';
  const showVideoCallUI = !!videoCallHandler.videoCallStatus && videoCallHandler.videoCallStatus !== 'ended' && videoCallHandler.videoCallStatus !== 'declined' && videoCallHandler.videoCallStatus !== 'missed';
  
  const handleCallAgain = () => {
    if (!missedCallInfo) return;
    const { calleeId, type } = missedCallInfo;
    setMissedCallInfo(null);

    const startFunction = type === 'voice' ? callHandler.startCall : videoCallHandler.startVideoCall;

    navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' })
      .then(stream => {
          startFunction(calleeId, stream);
      })
      .catch(err => {
          console.error("Permission denied on call again:", err);
          toast({ variant: 'destructive', title: "Permission Denied", description: "Could not get permissions to call again."});
      })
  };


  const avatar = getAvatar({id: missedCallInfo?.calleeId});
  const isAvatarUrl = avatar.startsWith('http');

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
      {missedCallInfo && (
         <Sheet open={!!missedCallInfo} onOpenChange={(open) => !open && setMissedCallInfo(null)}>
            <SheetContent side="bottom" className="rounded-t-2xl h-auto flex flex-col items-center justify-center gap-6 pb-10">
                 <SheetHeader>
                     <SheetTitle className="text-center">Call Not Answered</SheetTitle>
                 </SheetHeader>
                 <Avatar className="h-24 w-24">
                     <AvatarImage src={isAvatarUrl ? avatar : undefined} alt={missedCallInfo.calleeId} />
                     <AvatarFallback className="text-4xl">{!isAvatarUrl ? avatar : ''}</AvatarFallback>
                 </Avatar>
                 <p className="text-muted-foreground">{formatUserId(missedCallInfo.calleeId)} did not answer.</p>
                 <div className="w-full max-w-xs grid grid-cols-2 gap-4">
                     <Button variant="outline" size="lg" onClick={() => setMissedCallInfo(null)}>
                        <PhoneOff className="h-5 w-5 mr-2" />
                        Cancel
                    </Button>
                     <Button size="lg" onClick={handleCallAgain}>
                        {missedCallInfo.type === 'voice' ? <Phone className="h-5 w-5 mr-2" /> : <Video className="h-5 w-5 mr-2" />}
                         Call Again
                    </Button>
                 </div>
             </SheetContent>
         </Sheet>
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
            onAccept={() => videoCallHandler.answerVideoCall()}
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
            onAccept={() => callHandler.answerCall()}
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
    missedCallInfo: context.missedCallInfo,
    setMissedCallInfo: context.setMissedCallInfo,
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

    

    




    




    