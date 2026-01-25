
'use client';

import type { EventDetails } from '@/lib/types';
import { cn, formatEventDay, formatEventTimeRange, formatEventDuration } from '@/lib/utils';
import { useMemo, useState } from 'react';
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { MapPin, CalendarDays, AlignLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';


const colorSchemes = [
    {
        line: 'bg-red-800 dark:bg-red-300',
        bg: 'bg-red-500/10',
        text: 'text-red-800 dark:text-red-300',
        durationBg: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    },
    {
        line: 'bg-pink-800 dark:bg-pink-300',
        bg: 'bg-pink-500/10',
        text: 'text-pink-800 dark:text-pink-300',
        durationBg: 'bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300',
    },
    {
        line: 'bg-blue-800 dark:bg-blue-300',
        bg: 'bg-blue-500/10',
        text: 'text-blue-800 dark:text-blue-300',
        durationBg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
    },
    {
        line: 'bg-green-800 dark:bg-green-300',
        bg: 'bg-green-500/10',
        text: 'text-green-800 dark:text-green-300',
        durationBg: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
    },
    {
        line: 'bg-purple-800 dark:bg-purple-300',
        bg: 'bg-purple-500/10',
        text: 'text-purple-800 dark:text-purple-300',
        durationBg: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
    },
    {
        line: 'bg-indigo-800 dark:bg-indigo-300',
        bg: 'bg-indigo-500/10',
        text: 'text-indigo-800 dark:text-indigo-300',
        durationBg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300',
    },
    {
        line: 'bg-yellow-800 dark:bg-yellow-300',
        bg: 'bg-yellow-500/10',
        text: 'text-yellow-800 dark:text-yellow-300',
        durationBg: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300',
    },
];


export function EventCard({ eventDetails }: { eventDetails: EventDetails }) {
    const [isOpen, setIsOpen] = useState(false);
    const startDate = useMemo(() => eventDetails.eventTimestamp.toDate(), [eventDetails.eventTimestamp]);
    const endDate = useMemo(() => eventDetails.endTimestamp?.toDate(), [eventDetails.endTimestamp]);

    const colorIndex = useMemo(() => {
        if (!eventDetails.id) return 0;
        let hash = 0;
        for (let i = 0; i < eventDetails.id.length; i++) {
            hash = eventDetails.id.charCodeAt(i) + ((hash << 5) - hash);
        }
        return Math.abs(hash % colorSchemes.length);
    }, [eventDetails.id]);

    const scheme = colorSchemes[colorIndex];
    const duration = formatEventDuration(startDate, endDate);

    return (
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild>
                <div className="mt-2 border border-dashed rounded-xl bg-background text-card-foreground shadow-sm overflow-hidden cursor-pointer hover:bg-secondary/50 transition-colors">
                    <div className="px-4 py-2 flex justify-between items-center text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        <span>{formatEventDay(startDate)}</span>
                        {eventDetails.isPaid ? (
                            <Badge variant="default" className="uppercase">Paid</Badge>
                        ) : (
                            <Badge variant="secondary" className="uppercase">Free</Badge>
                        )}
                    </div>
                    <div className="px-4">
                        <div className="border-b border-dashed border-border"></div>
                    </div>
                    <div className={cn("relative p-4 overflow-hidden", scheme.bg)}>
                        <div className={cn(
                            "absolute left-2 top-1/2 -translate-y-1/2 h-3/4 w-1 rounded-full",
                            scheme.line
                        )}></div>
                        <div className="flex items-start gap-3 pl-4">
                            <div className="flex-1">
                                <p className={cn("font-semibold", scheme.text)}>{eventDetails.name}</p>
                                <p className={cn("text-sm opacity-90", scheme.text)}>{formatEventTimeRange(startDate, endDate, eventDetails.isAllDay)}</p>
                            </div>
                            {duration && (
                                <div className={cn("text-xs font-bold px-2 py-0.5 rounded-md", scheme.durationBg)}>
                                    {duration}
                                </div>
                            )}
                        </div>
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
