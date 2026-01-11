
"use client";

import { Loader2 } from "lucide-react";

interface PullToRefreshIndicatorProps {
    pullPosition: number;
    isRefreshing: boolean;
}

const MAX_PULL_DISTANCE = 80;
const CIRCLE_RADIUS = 12;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

export function PullToRefreshIndicator({ pullPosition, isRefreshing }: PullToRefreshIndicatorProps) {
    const pullProgress = Math.min(pullPosition / MAX_PULL_DISTANCE, 1);
    const strokeDashoffset = CIRCLE_CIRCUMFERENCE * (1 - pullProgress);

    if (isRefreshing) {
        return (
            <div className="absolute top-0 left-0 right-0 flex justify-center items-center h-16 text-muted-foreground pointer-events-none">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div 
            className="absolute top-0 left-0 right-0 flex justify-center items-center h-16 text-muted-foreground pointer-events-none"
            style={{ opacity: pullProgress }}
        >
            <svg
                className="h-8 w-8 transform -rotate-90"
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <circle
                    cx="16"
                    cy="16"
                    r={CIRCLE_RADIUS}
                    stroke="hsl(var(--border))"
                    strokeWidth="2"
                />
                <circle
                    cx="16"
                    cy="16"
                    r={CIRCLE_RADIUS}
                    stroke="hsl(var(--primary))"
                    strokeWidth="2.5"
                    strokeDasharray={CIRCLE_CIRCUMFERENCE}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                />
            </svg>
        </div>
    );
}
