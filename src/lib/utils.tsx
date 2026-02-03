import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistanceToNowStrict, isToday, isYesterday, format, isThisWeek, fromUnixTime, formatDistanceStrict, differenceInMinutes } from "date-fns";
import { defaultAvatars } from "./avatars";
import type { User } from "./types";
import { adjectives, nouns } from './names';
import { Verified } from "lucide-react";
import React from "react";


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const hashCode = (s: string) => s.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
}, 0);

const VERIFIED_USER_IDS = ['j2OfaN33r2SMyg5N7lYdFkS3lA52'];
const ADMIN_USER_ID = 'e9ZGHMjgnmO3ueSbf1ao3Crvlr02';

function getUsername(uid: string): string {
  const hash = Math.abs(hashCode(uid));
  const formatSelector = hash % 2;

  let firstWord: string;
  let secondWord: string;

  if (formatSelector === 0) {
    // Format: Adjective + Noun
    const adjIndex = (hash >> 1) % adjectives.length;
    const nounIndex = (hash >> 8) % nouns.length;
    firstWord = adjectives[adjIndex];
    secondWord = nouns[nounIndex];
  } else {
    // Format: Noun + Noun
    let nounIndex1 = (hash >> 1) % nouns.length;
    let nounIndex2 = (hash >> 8) % nouns.length;

    // Avoid repeating the same noun, e.g., "WolfWolf"
    if (nounIndex1 === nounIndex2) {
      nounIndex2 = (nounIndex2 + 1) % nouns.length;
    }
    firstWord = nouns[nounIndex1];
    secondWord = nouns[nounIndex2];
  }
  
  // No numbers, no dashes. Just combine the words.
  let combined = `${firstWord}${secondWord}`;

  // Keep names short and sweet as requested
  if (combined.length > 15) {
      combined = combined.substring(0, 15);
  }

  return combined.toLowerCase();
}


export function getFormattedUserIdString(uid: string | undefined): string {
    if (!uid) return "Anonymous-User-0000";
    if (uid === ADMIN_USER_ID) return "Blur";
    return getUsername(uid);
}


export function formatUserId(uid: string | undefined): React.ReactNode {
  if (!uid) return "Anonymous-User-0000";

  if (uid === ADMIN_USER_ID) {
    return (
      <span className="inline-flex items-center gap-0.5">
        <span>Blur</span>
        <Verified className="h-4 w-4 text-amber-500" fill="currentColor" stroke="white" strokeWidth={2} />
      </span>
    );
  }

  const username = getUsername(uid);
  const isVerified = VERIFIED_USER_IDS.includes(uid);

  return (
    <span className="inline-flex items-center gap-0.5">
      <span>{username}</span>
      {isVerified && <Verified className="h-4 w-4 text-amber-500" fill="currentColor" stroke="white" strokeWidth={2} />}
    </span>
  );
}


export function formatTimestamp(date: Date): string {
  const now = new Date();
  const distance = formatDistanceToNowStrict(date, { addSuffix: false });
  
  const [value, unit] = distance.split(' ');

  if (unit.startsWith('second')) {
    return 'now';
  }
  if (unit.startsWith('minute')) {
    return `${value}m`;
  }
  if (unit.startsWith('hour')) {
    return `${value}h`;
  }
  if (unit.startsWith('day')) {
    return `${value}d`;
  }
  if (unit.startsWith('month')) {
    return `${value}mo`;
  }
  if (unit.startsWith('year')) {
    return `${value}y`;
  }

  return distance;
}

export function formatMessageTimestamp(date: Date): string {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
}

export function formatDateSeparator(date: Date): string {
    if (isToday(date)) {
        return "Today";
    }
    if (isYesterday(date)) {
        return "Yesterday";
    }
    return format(date, "MMMM d, yyyy");
}


export function formatLastSeen(timestamp: number | null): string {
    if (timestamp === null) return "Last seen recently";
    const date = fromUnixTime(timestamp / 1000);

    if (isToday(date)) {
        return `Last seen today at ${format(date, "p")}`;
    }
    if (isYesterday(date)) {
        return `Last seen yesterday at ${format(date, "p")}`;
    }
    return `Last seen on ${format(date, "P")}`;
}


export const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
};

export const getAvatar = (user: Partial<User> | string | null | undefined): string => {
    const uid = typeof user === 'string' ? user : user?.id;

    if (uid === ADMIN_USER_ID) {
        return 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhGPvFRvSSGSSTOcF45ESTNHx-z9iFQ_oZMCHDbsgRsPcztHHRUbMbD8GXNN109hzQpxLQRndngO1LoZEe2j3GkFEXrJGxfrk6UUR_dFUo5cBiz7I3tZ4n-lROEcWNLCsr3SuB_eeOh-BR8gTUUmX6B34PY_tcbf0wA35tOHa2lVDjzm2n8J6pawYy9Qm4i/s320/Blur%20Logo.PNG';
    }
    
    if (typeof user === 'object' && user?.avatar) {
        return user.avatar;
    }

    if (!uid) {
        return '👤';
    }

    const hash = hashCode(uid);
    const index = Math.abs(hash) % defaultAvatars.length;
    
    return defaultAvatars[index];
};


export function formatCount(count: number | undefined | null): string {
    if (count === undefined || count === null) {
        return "";
    }
    if (count >= 1_000_000) {
        return (count / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (count >= 1_000) {
        return (count / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return count.toString();
}

export function formatExpiry(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();

  if (diff <= 0) {
    return "Expired";
  }

  return formatDistanceStrict(date, now);
}

export function combineDateAndTime(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const newDate = new Date(date);
  newDate.setHours(hours);
  newDate.setMinutes(minutes);
  newDate.setSeconds(0);
  newDate.setMilliseconds(0);
  return newDate;
}

export function formatEventDate(date: Date): string {
  return format(date, 'd MMM').toUpperCase();
}

export function formatEventDay(date: Date): React.ReactNode {
  if (isToday(date)) {
    return (
      <>
        Today, <span className="font-bold">{format(date, 'E').toUpperCase()}</span>
      </>
    );
  }
  if (isYesterday(date)) {
    return (
      <>
        Yesterday, <span className="font-bold">{format(date, 'E').toUpperCase()}</span>
      </>
    );
  }
  const dayOfWeek = format(date, 'E').toUpperCase();
  const restOfDay = format(date, 'd MMM').toUpperCase();
  return (
    <>
      <span className="font-bold">{dayOfWeek}</span>, {restOfDay}
    </>
  );
}

export function formatEventTimeRange(start: Date, end: Date | undefined, isAllDay: boolean): string {
  if (isAllDay) {
    return 'All-day';
  }

  if (!end) {
    return format(start, 'p').toLowerCase();
  }

  const startTimeStr = format(start, 'h:mm');
  const endTimeStr = format(end, 'h:mm');
  const endMeridian = format(end, 'a').toLowerCase();

  const startMeridian = format(start, 'a');
  const endMeridianCheck = format(end, 'a');

  if (startMeridian === endMeridianCheck) {
    return `${startTimeStr} - ${endTimeStr} ${endMeridian}`;
  } else {
    const startTimeWithMeridian = format(start, 'h:mm a').toLowerCase();
    const endTimeWithMeridian = format(end, 'h:mm a').toLowerCase();
    return `${startTimeWithMeridian} - ${endTimeWithMeridian}`;
  }
}

export function formatEventDuration(start: Date, end?: Date): string | null {
  if (!end) return null;
  const diffMinutes = differenceInMinutes(end, start);

  if (diffMinutes <= 0) {
    return null;
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }

  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}
