import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistanceToNowStrict } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


export function formatTimestamp(date: Date): string {
  const now = new Date();
  const distance = formatDistanceToNowStrict(date, { addSuffix: false });
  // formatDistanceToNowStrict returns string like '5 months', '1 day', '10 hours', '1 minute'
  
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
