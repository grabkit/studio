
"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Image from 'next/image';
import React, { useState, useEffect } from 'react';
import { Carousel, CarouselApi, CarouselContent, CarouselItem } from "@/components/ui/carousel"
import Autoplay from "embla-carousel-autoplay"


const carouselItems = [
    "Welcome to Blur. Share your thoughts and connect with others without your identity.",
    "Engage in discussions and share your perspective in a supportive environment.",
    "Discover communities and topics that matter to you. Your voice is welcome here."
]

export default function GetStartedPage() {
  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)
  const [count, setCount] = useState(0)

  const plugin = React.useRef(
    Autoplay({ delay: 5000, stopOnInteraction: true })
  )

  useEffect(() => {
    if (!api) {
      return
    }
 
    setCount(api.scrollSnapList().length)
    setCurrent(api.selectedScrollSnap() + 1)
 
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1)
    })
  }, [api])

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background p-8 text-center overflow-x-hidden">
      <div className="flex flex-col items-center justify-center">
        <div className="relative w-[320px] h-[320px] flex items-center justify-center mb-16">
            <svg width="320" height="320" viewBox="0 0 320 320" className="absolute">
              <circle
                cx="160"
                cy="160"
                r="100"
                stroke="hsl(var(--border))"
                strokeWidth="2"
                fill="none"
                strokeDasharray="2"
              />
              <circle
                cx="160"
                cy="160"
                r="150"
                stroke="hsl(var(--border))"
                strokeWidth="1"
                fill="none"
                strokeDasharray="4"
              />
            </svg>
            {/* Outer Circle Images */}
            <div className="absolute inset-0">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3">
                  <Image
                    src="https://picsum.photos/seed/1/50/50"
                    alt="Profile 1"
                    width={50}
                    height={50}
                    className="rounded-full shadow-md blur-[2px]"
                    data-ai-hint="person face"
                  />
              </div>
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/4">
                   <Image
                    src="https://picsum.photos/seed/2/50/50"
                    alt="Profile 2"
                    width={50}
                    height={50}
                    className="rounded-full shadow-md blur-[2px]"
                    data-ai-hint="man portrait"
                  />
                </div>
            </div>

            {/* Inner Circle Images */}
            <div className="absolute inset-0">
                <div className="absolute top-1/2 left-[20%] -translate-y-1/2 -translate-x-1/2">
                   <Image
                    src="https://picsum.photos/seed/3/40/40"
                    alt="Profile 3"
                    width={40}
                    height={40}
                    className="rounded-full shadow-md blur-[2px]"
                    data-ai-hint="woman portrait"
                  />
                </div>
                <div className="absolute top-1/2 right-[20%] -translate-y-1/2">
                   <Image
                    src="https://picsum.photos/seed/4/40/40"
                    alt="Profile 4"
                    width={40}
                    height={40}
                    className="rounded-full shadow-md blur-[2px]"
                    data-ai-hint="person portrait"
                  />
                </div>
            </div>

             <h1 className="font-headline text-6xl font-bold text-primary z-10">
                Blur
             </h1>
        </div>
      </div>
      <div className="w-full max-w-sm">
        <div className="h-28">
          <h2 className="font-headline text-2xl font-bold mb-4">Express Yourself, Anonymously.</h2>
            <Carousel
              setApi={setApi}
              plugins={[plugin.current]}
              className="w-full"
              onMouseEnter={plugin.current.stop}
              onMouseLeave={plugin.current.reset}
            >
              <CarouselContent>
                {carouselItems.map((description, index) => (
                  <CarouselItem key={index}>
                    <p className="text-muted-foreground">{description}</p>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
             <div className="flex justify-center gap-2 mt-4">
              {Array.from({ length: count }).map((_, index) => (
                  <button
                      key={index}
                      onClick={() => api?.scrollTo(index)}
                      className={`h-2 w-2 rounded-full transition-colors ${
                          current === index + 1 ? 'bg-primary' : 'bg-muted'
                      }`}
                  />
              ))}
          </div>
        </div>
        <Button asChild size="lg" className="w-full font-headline text-lg rounded-full mt-16">
          <Link href="/auth">
            Get Started
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
