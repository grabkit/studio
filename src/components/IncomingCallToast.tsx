
'use client';

import { toast } from "@/hooks/use-toast";
import { Phone, PhoneOff } from "lucide-react";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { getInitials } from "@/lib/utils";

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
    toast({
        duration: Infinity, // Keep the toast open until user action
        title: "Incoming Call",
        description: (
            <div className="w-full flex items-center justify-between mt-2">
                <div className="flex items-center gap-3">
                    <Avatar>
                        <AvatarFallback>{getInitials(formatUserId(callerId))}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-semibold">{formatUserId(callerId)}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={onDecline}>
                        <PhoneOff className="h-5 w-5" />
                    </Button>
                     <Button variant="ghost" size="icon" className="text-green-500" onClick={onAccept}>
                        <Phone className="h-5 w-5" />
                    </Button>
                </div>
            </div>
        ),
    });
};
