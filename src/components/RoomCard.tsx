'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function RoomCard() {

    return (
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-[10px] p-4 flex flex-col gap-4">
            <div className="flex justify-between items-start">
                <Badge variant="secondary" className="bg-violet-200 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300">
                    Room active
                </Badge>
            </div>

            <div className="space-y-1">
                <h3 className="text-xl font-bold font-headline text-violet-900 dark:text-violet-200">After Dark</h3>
                <p className="text-sm text-violet-700 dark:text-violet-400">
                    Join late-night conversations from 12 AM to 4 AM — meet new people and enjoy real-time chats.
                </p>
            </div>

            <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                    <Avatar className="h-6 w-6 border-2 border-background">
                        <AvatarImage src="https://i.pravatar.cc/150?u=a042581f4e29026704d" />
                        <AvatarFallback>A</AvatarFallback>
                    </Avatar>
                    <Avatar className="h-6 w-6 border-2 border-background">
                        <AvatarImage src="https://i.pravatar.cc/150?u=a042581f4e29026705d" />
                        <AvatarFallback>B</AvatarFallback>
                    </Avatar>
                    <Avatar className="h-6 w-6 border-2 border-background">
                        <AvatarImage src="https://i.pravatar.cc/150?u=a042581f4e29026706d" />
                        <AvatarFallback>C</AvatarFallback>
                    </Avatar>
                </div>
                <span className="text-xs text-muted-foreground font-semibold">345 joined in already</span>
            </div>

            <Button className="w-full font-bold bg-violet-600 hover:bg-violet-700 text-white rounded-[25px]">
                Join Room
            </Button>
        </div>
    )
}
