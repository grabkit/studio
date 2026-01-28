"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> & {
    isOnline?: boolean
    showStatus?: boolean
    size?: "sm" | "default" | "lg"
  }
>(({ className, isOnline = false, showStatus = false, size = "default", ...props }, ref) => (
  <div className="relative inline-block">
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-full",
        size === "sm" && "h-8 w-8",
        size === "default" && "h-10 w-10",
        size === "lg" && "h-12 w-12",
        className
      )}
      {...props}
    />
     {showStatus && isOnline && (
      <span className={cn(
        "absolute block rounded-full bg-[hsl(var(--online-glow-color))] animate-online-indicator-glow border-2 border-background",
        size === "sm" && "h-2 w-2 bottom-0 right-0",
        size === "default" && "h-2.5 w-2.5 bottom-0 right-0",
        size === "lg" && "h-3 w-3 bottom-0.5 right-0.5"
      )} />
    )}
  </div>
))
Avatar.displayName = AvatarPrimitive.Root.displayName

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props}
  />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
