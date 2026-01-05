

"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Image from 'next/image';
import { getAvatar, formatUserId } from "@/lib/utils";
import type { User } from "@/lib/types";

export function QrCodeDialog({ isOpen, onOpenChange, user }: { isOpen: boolean, onOpenChange: (isOpen: boolean) => void, user: User }) {
    if (!user) return null;

    const profileUrl = typeof window !== 'undefined' ? `${window.location.origin}/profile/${user.id}` : '';
    const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(profileUrl)}&ecc=H`;
    const appLogoUrl = "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh5r85BhL7rCkS72xpX_5xkFZ9y_fVMFXYp_zLN9eEAnEA_C61c1jCJFaG86d1W6_mtsla64B191MOWYEFhJAa-lyMikD80WyfBVKiQxyc71spJx3Oy2FgvfotsVVnNIXGRXunpHYYvGFoQ7V-URilBXwJzIV9zQLSO_PN9raerNaTAb0VuCYo9EBqiyVts/s320/New%20Project%2020%20%5BEFC25EE%5D.png";


    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xs">
                <DialogHeader>
                    <DialogTitle className="text-center">Share Profile</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col items-center justify-center p-4 space-y-4">
                    <Avatar className="h-16 w-16">
                        <AvatarFallback className="text-2xl">{getAvatar(user)}</AvatarFallback>
                    </Avatar>
                    <div className="text-center">
                        <p className="font-bold">{user.name}</p>
                        <p className="text-sm text-muted-foreground">{formatUserId(user.id)}</p>
                    </div>

                    <div className="relative flex items-center justify-center bg-white p-2 rounded-lg">
                        <Image
                            src={qrCodeApiUrl}
                            alt={`QR Code for ${user.name}`}
                            width={220}
                            height={220}
                            className="rounded-md"
                        />
                        <div className="absolute flex items-center justify-center w-12 h-12 bg-background p-1.5 rounded-md">
                           <Image 
                             src={appLogoUrl}
                             alt="Blur Logo"
                             width={40}
                             height={13}
                           />
                        </div>
                    </div>
                     <p className="text-xs text-muted-foreground text-center break-all p-2 bg-secondary rounded-md">
                        {profileUrl}
                    </p>

                </div>
                <DialogFooter>
                    <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} className="w-full">
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

    