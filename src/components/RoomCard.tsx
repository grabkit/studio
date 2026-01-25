
'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type RoomCardProps = {
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

export function RoomCard({ title, description, attendees, avatars, theme }: RoomCardProps) {
    const currentTheme = themeClasses[theme];

    return (
        <div className={cn("rounded-[15px] p-4 flex flex-col gap-4", currentTheme.container)}>
            <div className="flex justify-between items-start">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white">
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-fade-in-out" />
                    <span>Room active</span>
                </div>
            </div>

            <div className="space-y-1">
                <h3 className="text-xl font-bold font-headline text-white">{title}</h3>
                <p className="text-sm text-white">
                    {description}
                </p>
            </div>

            <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                    {avatars.map((src, i) => (
                        <Avatar key={i} className="h-5 w-5 border-2 border-white">
                            <AvatarImage src={src} />
                            <AvatarFallback>{title.charAt(0)}</AvatarFallback>
                        </Avatar>
                    ))}
                </div>
                <span className="text-xs text-white/80 font-semibold">{attendees} joined in already</span>
            </div>

            <Button className={cn("w-full font-bold bg-white hover:bg-white/90 rounded-[25px]", currentTheme.button)}>
                Join Room
            </Button>
        </div>
    )
}
