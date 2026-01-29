
'use client';

import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { Button } from "./ui/button";
import { Phone, PhoneOff, Video } from "lucide-react";
import { getAvatar, formatUserId } from "@/lib/utils";
import type { User } from "@/lib/types";
import type { WithId } from "@/firebase";

interface IncomingVideoCallViewProps {
  caller: WithId<User> | null;
  onAccept: () => void;
  onDecline: () => void;
}

export function IncomingVideoCallView({ caller, onAccept, onDecline }: IncomingVideoCallViewProps) {
  if (!caller) return null;

  const avatar = getAvatar(caller);
  const isAvatarUrl = avatar.startsWith('http');

  return (
    <div className="fixed inset-0 bg-background/90 backdrop-blur-xl z-50 flex flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center text-center space-y-4">
        <Avatar className="h-32 w-32 border-4 border-primary/50">
          <AvatarImage src={isAvatarUrl ? avatar : undefined} alt={caller.name} />
          <AvatarFallback className="text-5xl">{!isAvatarUrl ? avatar : ''}</AvatarFallback>
        </Avatar>
        <div className="space-y-1">
            <h1 className="text-3xl font-bold font-headline">{formatUserId(caller.id)}</h1>
            <p className="text-muted-foreground text-lg flex items-center gap-2">
              <Video className="h-5 w-5"/>
              <span>Incoming Video Call...</span>
            </p>
        </div>
      </div>
      
      <div className="absolute bottom-20 flex items-center justify-center gap-8 w-full">
        <div className="flex flex-col items-center gap-2">
            <Button onClick={onDecline} variant="destructive" size="icon" className="h-16 w-16 rounded-full">
                <PhoneOff className="h-7 w-7" />
            </Button>
            <span className="text-sm">Decline</span>
        </div>
        <div className="flex flex-col items-center gap-2">
            <Button onClick={onAccept} variant="default" size="icon" className="h-16 w-16 rounded-full bg-green-500 hover:bg-green-600">
                <Phone className="h-7 w-7" />
            </Button>
            <span className="text-sm">Accept</span>
        </div>
      </div>
    </div>
  );
}
