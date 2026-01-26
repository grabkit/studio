'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from 'next/link';
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Timer } from "lucide-react";

type RoomCardProps = {
    roomId: string;
    title: string;
    description: string;
    attendees: number;
    avatars: string[];
    theme: 'violet' | 'teal';
};

const themeClasses = {
    violet: {
        container: 'bg-violet-500 border-violet-500/20',
        button: 'text-violet-600'
    },
    teal: {
        container: 'bg-teal-500 border-teal-500/20',
        button: 'text-teal-600'
    }
}

export function RoomCard({ roomId, title, description, attendees, avatars, theme }: RoomCardProps) {
    const router = useRouter();
    const currentTheme = themeClasses[theme];
    
    // State for After Dark room
    const [isAfterDarkActive, setIsAfterDarkActive] = useState(false);
    const [timeUntilActive, setTimeUntilActive] = useState('');

    useEffect(() => {
        if (roomId !== 'after_dark') {
            setIsAfterDarkActive(true); // Other rooms are always active
            return;
        }

        const checkTime = () => {
            const now = new Date();
            const currentHour = now.getHours();

            // Active between 12 AM (0) and 4 AM (3:59)
            const isActive = currentHour >= 0 && currentHour < 4;
            setIsAfterDarkActive(isActive);
            
            if (!isActive) {
                const nextActivation = new Date();
                if (currentHour >= 4) {
                    // It's past 4 AM today, so the next activation is tomorrow at midnight
                    nextActivation.setDate(now.getDate() + 1);
                }
                nextActivation.setHours(0, 0, 0, 0); // Midnight

                const diff = nextActivation.getTime() - now.getTime();
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                
                setTimeUntilActive(`${hours}h ${minutes}m`);
            }
        };

        checkTime();
        // Update every minute to keep the countdown fresh
        const interval = setInterval(checkTime, 60000); 

        return () => clearInterval(interval);
    }, [roomId]);


    const handleJoinClick = () => {
        if (roomId === 'after_dark' && !isAfterDarkActive) return;
        router.push(`/room/${roomId}`);
    };
    
    const isJoinDisabled = roomId === 'after_dark' && !isAfterDarkActive;

    return (
        <div className={cn("rounded-[15px] p-4 flex flex-col gap-4", currentTheme.container)}>
            <div className="flex justify-between items-start">
                 {isAfterDarkActive || roomId !== 'after_dark' ? (
                     <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white">
                        <span className="h-2 w-2 rounded-full bg-red-500 animate-fade-in-out border border-white" />
                        <span>Room active</span>
                    </div>
                ) : (
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/20 px-2.5 py-0.5 text-xs font-semibold text-white/70">
                        <Timer className="h-3 w-3" />
                        <span>Activates in {timeUntilActive}</span>
                    </div>
                )}
            </div>

            <div className="space-y-1">
                <h3 className="text-xl font-bold font-headline text-white">{title}</h3>
                <p className="text-sm text-white/90">
                    {description}
                </p>
            </div>

            <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                    {avatars.map((src, i) => (
                        <Avatar key={i} className="h-5 w-5 border-2 border-white/80">
                            <AvatarImage src={src} />
                            <AvatarFallback>{title.charAt(0)}</AvatarFallback>
                        </Avatar>
                    ))}
                </div>
                <span className="text-xs text-white/80 font-semibold">{attendees} joined in already</span>
            </div>

            <Button onClick={handleJoinClick} disabled={isJoinDisabled} className={cn("w-full font-bold bg-white hover:bg-white/90 rounded-[25px]", currentTheme.button)}>
                Join Room
            </Button>
        </div>
    )
}
