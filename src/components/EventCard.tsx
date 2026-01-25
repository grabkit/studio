'use client';

import type { EventDetails } from '@/lib/types';
import { cn, formatEventDate, formatEventDay, formatEventTimeRange, formatEventDuration } from '@/lib/utils';
import { useMemo, useState } from 'react';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { MapPin, CalendarDays, AlignLeft } from 'lucide-react';


const eventColors = [
    'border-l-red-400',
    'border-l-pink-400',
    'border-l-blue-400',
    'border-l-green-400',
    'border-l-purple-400',
    'border-l-indigo-400',
    'border-l-yellow-400',
];

const durationBgColors = [
    'bg-red-100 text-red-800',
    'bg-pink-100 text-pink-800',
    'bg-blue-100 text-blue-800',
    'bg-green-100 text-green-800',
    'bg-purple-100 text-purple-800',
    'bg-indigo-100 text-indigo-800',
    'bg-yellow-100 text-yellow-800',
]

export function EventCard({ eventDetails }: { eventDetails: EventDetails }) {
    const [isOpen, setIsOpen] = useState(false);
    const startDate = useMemo(() => eventDetails.eventTimestamp.toDate(), [eventDetails.eventTimestamp]);
    const endDate = useMemo(() => eventDetails.endTimestamp?.toDate(), [eventDetails.endTimestamp]);

    const colorIndex = useMemo(() => {
        if (!eventDetails.name) return 0;
        let hash = 0;
        for (let i = 0; i < eventDetails.name.length; i++) {
            hash = eventDetails.name.charCodeAt(i) + ((hash << 5) - hash);
        }
        return Math.abs(hash % eventColors.length);
    }, [eventDetails.name]);

    const borderColorClass = eventColors[colorIndex];
    const durationBgClass = durationBgColors[colorIndex];
    const duration = formatEventDuration(startDate, endDate);

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <div className="mt-2 border rounded-xl bg-secondary/30 text-card-foreground shadow-sm overflow-hidden cursor-pointer hover:bg-secondary/50 transition-colors">
                    <div className="px-4 py-2 flex justify-between items-center text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        <span>{formatEventDay(startDate)}</span>
                        <span>{formatEventDate(startDate)}</span>
                    </div>
                    <div className="px-4">
                        <div className="border-b border-dashed border-border/50"></div>
                    </div>
                    <div className={cn("p-4 flex items-start gap-3 bg-card pl-3", borderColorClass, 'border-l-2')}>
                        <div className="flex-1 pl-1">
                            <p className="font-semibold text-card-foreground">{eventDetails.name}</p>
                            <p className="text-sm text-muted-foreground">{formatEventTimeRange(startDate, endDate, eventDetails.isAllDay)}</p>
                        </div>
                        {duration && (
                            <div className={cn("text-xs font-bold px-2 py-0.5 rounded-md", durationBgClass)}>
                                {duration}
                            </div>
                        )}
                    </div>
                </div>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl p-6">
                <SheetHeader>
                    <SheetTitle className="text-2xl font-bold font-headline">{eventDetails.name}</SheetTitle>
                </SheetHeader>
                <div className="py-6 space-y-6">
                    <div className="flex items-start gap-4">
                        <CalendarDays className="h-5 w-5 text-muted-foreground mt-1" />
                        <div>
                            <p className="font-semibold">{formatEventDay(startDate)}</p>
                            <p className="text-sm text-muted-foreground">{formatEventTimeRange(startDate, endDate, eventDetails.isAllDay)}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4">
                        <MapPin className="h-5 w-5 text-muted-foreground mt-1" />
                        <div>
                            <p className="font-semibold">Location</p>
                            <p className="text-sm text-muted-foreground">{eventDetails.location}</p>
                        </div>
                    </div>
                    {eventDetails.description && (
                        <div className="flex items-start gap-4">
                            <AlignLeft className="h-5 w-5 text-muted-foreground mt-1" />
                            <div>
                                <p className="font-semibold">About this event</p>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{eventDetails.description}</p>
                            </div>
                        </div>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
