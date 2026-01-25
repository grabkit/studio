'use client';

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function RoomCard() {

    return (
        <div className="bg-violet-500 border border-violet-500/20 rounded-[15px] p-4 flex flex-col gap-4">
            <div className="flex justify-between items-start">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white">
                    <span className="h-2 w-2 rounded-full bg-green-400 animate-online-indicator-glow" />
                    <span>Room active</span>
                </div>
            </div>

            <div className="space-y-1">
                <h3 className="text-xl font-bold font-headline text-white">After Dark</h3>
                <p className="text-sm text-violet-200">
                    Join late-night conversations from 12 AM to 4 AM — meet new people and enjoy real-time chats.
                </p>
            </div>

            <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                    <Avatar className="h-6 w-6 border-2 border-white">
                        <AvatarImage src="https://i.pravatar.cc/150?u=a042581f4e29026704d" />
                        <AvatarFallback>A</AvatarFallback>
                    </Avatar>
                    <Avatar className="h-6 w-6 border-2 border-white">
                        <AvatarImage src="https://i.pravatar.cc/150?u=a042581f4e29026705d" />
                        <AvatarFallback>B</AvatarFallback>
                    </Avatar>
                    <Avatar className="h-6 w-6 border-2 border-white">
                        <AvatarImage src="https://i.pravatar.cc/150?u=a042581f4e29026706d" />
                        <AvatarFallback>C</AvatarFallback>
                    </Avatar>
                </div>
                <span className="text-xs text-violet-300 font-semibold">345 joined in already</span>
            </div>

            <Button className="w-full font-bold bg-violet-600 hover:bg-violet-700 text-white rounded-[25px]">
                Join Room
            </Button>
        </div>
    )
}
