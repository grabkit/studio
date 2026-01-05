import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistanceToNowStrict, isToday, isYesterday, format, isThisWeek, fromUnixTime } from "date-fns";
import { defaultAvatars } from "./avatars";
import type { User } from "./types";
import { adjectives, nouns } from './names';


export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const hashCode = (s: string) => s.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
}, 0);

export function formatUserId(uid: string | undefined): string {
  if (!uid) return "Anonymous_User";

  const hash = Math.abs(hashCode(uid));
  
  const adjIndex = hash % adjectives.length;
  const nounIndex = (hash >> 8) % nouns.length;
  const number = (hash >> 16) % 1000;

  const adjective = adjectives[adjIndex];
  const noun = nouns[nounIndex];

  return `${adjective}${noun}_${number}`;
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
  if (isToday(date)) {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  }
  if (isYesterday(date)) {
    return "Yesterday";
  }
  if (isThisWeek(date, { weekStartsOn: 1 /* Monday */ })) {
    return format(date, 'EEEE'); // e.g., "Sunday"
  }
  return format(date, 'P'); // e.g., 09/15/2024
}

export function formatLastSeen(timestamp: number | null): string {
    if (timestamp === null) return "Last seen recently";
    const date = fromUnixTime(timestamp / 1000);
    return `Last seen ${formatDistanceToNowStrict(date, { addSuffix: true })}`;
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


export function formatCount(count: number): string {
    if (count >= 1_000_000) {
        return (count / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
    }
    if (count >= 1_000) {
        return (count / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
    }
    return count.toString();
}
