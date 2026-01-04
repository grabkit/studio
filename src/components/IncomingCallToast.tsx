
'use client';

import { toast } from "@/hooks/use-toast";
import { Phone, PhoneOff } from "lucide-react";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { getAvatar } from "@/lib/utils";

interface IncomingCallToastProps {
    callerId: string;
    onAccept: () => void;
    onDecline: () => void;
}

const formatUserId = (uid: string | undefined) => {
    if (!uid) return "blur??????";
    return `blur${uid.substring(uid.length - 6)}`;
};


export const showIncomingCallToast = ({ callerId, onAccept, onDecline }: IncomingCallToastProps) => {
    return (
        <div className="w-full flex flex-col">
             <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Avatar>
                        <AvatarFallback>{getAvatar(callerId)}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-semibold">{formatUserId(callerId)}</p>
                        <p className="text-sm opacity-80">Incoming Call...</p>
                    </div>
                </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-4">
                <Button variant="destructive" size="sm" onClick={onDecline}>
                    <PhoneOff className="h-4 w-4 mr-2" />
                    Decline
                </Button>
                 <Button variant="default" size="sm" className="bg-green-500 hover:bg-green-600" onClick={onAccept}>
                    <Phone className="h-4 w-4 mr-2" />
                    Accept
                </Button>
            </div>
        </div>
    );
};
