

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistanceToNowStrict, isToday, isYesterday, format, isThisWeek, fromUnixTime } from "date-fns";
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

// మీ యాప్‌లో ఏ యూజర్లకైతే వెరిఫైడ్ బ్యాడ్జ్ చూపించాలనుకుంటున్నారో,
// వారి యూజర్ IDలను ఈ కింది జాబితాలో జోడించండి.
// ఉదాహరణ: const VERIFIED_USER_IDS = ['user_id_1', 'user_id_2'];
const VERIFIED_USER_IDS = ['j2OfaN33r2SMyg5N7lYdFkS3lA52'];
const ADMIN_USER_ID = 'e9ZGHMjgnmO3ueSbf1ao3Crvlr02';


export function formatUserId(uid: string | undefined): React.ReactNode {
  if (!uid) return "Anonymous-User-0000";

  // Special case for the admin user
  if (uid === ADMIN_USER_ID) {
    return (
      <span className="inline-flex items-center gap-1">
        <span>Blur</span>
        <Verified className="h-4 w-4 text-amber-500" fill="currentColor" stroke="white" strokeWidth={1} />
      </span>
    );
  }

  const hash = Math.abs(hashCode(uid));
  
  const adjIndex = hash % adjectives.length;
  const nounIndex = (hash >> 8) % nouns.length;
  const number = (hash >> 16) % 10000; // 4-digit number

  const adjective = adjectives[adjIndex];
  const noun = nouns[nounIndex];

  // Combine and trim to a max length to keep UI consistent
  let combined = `${adjective}${noun}`;
  if (combined.length > 12) {
    combined = combined.substring(0, 12);
  }

  const isVerified = VERIFIED_USER_IDS.includes(uid);

  return (
    <span className="inline-flex items-center gap-1">
      <span>{`${combined}-${String(number).padStart(4, '0')}`}</span>
      {isVerified && <Verified className="h-4 w-4 text-amber-500" fill="currentColor" stroke="white" strokeWidth={1} />}
    </span>
  );
}


export function formatTimestamp(date: Date): string {
  const now = new Date();
  const distance = formatDistanceToNowStrict(date, { addSuffix: false });
  // formatDistanceToNowStrict returns string like '5 months', '1 day', '10 hours', '1minute'
  
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

  // Fallback for units not explicitly handled, though the above covers date-fns output
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
    return `Last seen on ${format(date, "P")} at ${format(date, "p")}`;
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

/**
 * Gets a user's avatar. If they have chosen a custom one, it's returned.
 * Otherwise, a deterministic emoji is generated from their user ID.
 * @param user The user object, which can be null or undefined.
 * @returns A single emoji string.
 */
export const getAvatar = (user: Partial<User> | string | null | undefined): string => {
    // Handle case where user object is passed
    if (typeof user === 'object' && user?.avatar) {
        return user.avatar;
    }

    const uid = typeof user === 'string' ? user : user?.id;

    if (!uid) {
        // Return a generic default if no UID is available
        return '👤';
    }

    // A simple hashing function to convert string to a number
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
