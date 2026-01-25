

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistanceToNowStrict, isToday, isYesterday, format, isThisWeek, fromUnixTime, formatDistanceStrict } from "date-fns";
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
  const adjIndex = hash % adjectives.length;
  const nounIndex = (hash >> 8) % nouns.length;
  const number = (hash >> 16) % 10000;
  const adjective = adjectives[adjIndex];
  const noun = nouns[nounIndex];
  let combined = `${adjective}${noun}`;
  if (combined.length > 12) {
    combined = combined.substring(0, 12);
  }
  return (`${combined}-${String(number).padStart(4, '0')}`).toLowerCase();
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
