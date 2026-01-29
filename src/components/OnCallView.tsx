
'use client';

import { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { Mic, MicOff, PhoneOff, Volume2, VolumeX } from "lucide-react";
import { getAvatar, formatUserId } from "@/lib/utils";
import type { User } from "@/lib/types";
import type { WithId } from "@/firebase";
import { CallStatus } from "@/lib/types";

interface OnCallViewProps {
  remoteUser: WithId<User> | null;
  status: CallStatus;
  onHangUp: () => void;
  isMuted: boolean;
  toggleMute: () => void;
}

function formatCallDuration(seconds: number) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

export function OnCallView({ remoteUser, status, onHangUp, isMuted, toggleMute }: OnCallViewProps) {
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (status === 'answered') {
      timer = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } else {
      setDuration(0);
    }

    return () => clearInterval(timer);
  }, [status]);
  
  if (!remoteUser) return null;

  const avatar = getAvatar(remoteUser);
  const isAvatarUrl = avatar.startsWith('http');
  
  const getStatusText = () => {
    switch(status) {
        case 'offering': return 'Calling...';
        case 'ringing': return 'Ringing...';
        case 'answered': return formatCallDuration(duration);
        case 'ended':
        case 'declined':
        case 'missed':
             return 'Call Ended';
        default: return 'Connecting...';
    }
  }

  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-xl z-50 flex flex-col items-center justify-center p-8">
       <div className="flex flex-col items-center text-center space-y-4">
        <Avatar className="h-32 w-32 border-4 border-primary/50">
           <AvatarImage src={isAvatarUrl ? avatar : undefined} alt={remoteUser.name} />
          <AvatarFallback className="text-5xl">{!isAvatarUrl ? avatar : ''}</AvatarFallback>
        </Avatar>
        <div className="space-y-1">
            <h1 className="text-3xl font-bold font-headline">{formatUserId(remoteUser.id)}</h1>
            <p className="text-muted-foreground text-lg">{getStatusText()}</p>
        </div>
      </div>

       <div className="absolute bottom-20 flex items-center justify-center gap-8 w-full">
         <div className="flex flex-col items-center gap-2">
            <Button onClick={toggleMute} variant="secondary" size="icon" className="h-16 w-16 rounded-full">
                {isMuted ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
            </Button>
         </div>
        <div className="flex flex-col items-center gap-2">
            <Button onClick={onHangUp} variant="destructive" size="icon" className="h-16 w-16 rounded-full">
                <PhoneOff className="h-7 w-7" />
            </Button>
        </div>
      </div>
    </div>
  );
}
