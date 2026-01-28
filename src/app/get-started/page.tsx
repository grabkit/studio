
"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Image from 'next/image';
import React, { useState, useEffect } from 'react';
import { Carousel, CarouselApi, CarouselContent, CarouselItem } from "@/components/ui/carousel"
import Autoplay from "embla-carousel-autoplay"
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";


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
    <motion.div
      initial={{ scale: 0.98, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="relative flex h-screen flex-col items-center justify-center bg-background p-8 text-center overflow-hidden"
    >
       <div className="background-grid"></div>
      <div className="relative w-[320px] h-[320px] flex items-center justify-center mb-16">
            <svg width="320" height="320" viewBox="0 0 320 320" className="absolute animate-spin-slow">
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
            
            {/* Outer Orbit */}
            <div className="absolute w-[300px] h-[300px] animate-spin-slow">
                {/* Avatar 1 (Top) */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="relative h-12 w-12 rounded-full overflow-hidden blur-[2px] animate-spin-slow-reverse">
                         <Image
                            src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjl__yIIdDpdUqwihL8vBMfr5ioet6tuh425rGFdshYyY6Fpa6_gy7tOHWaLzkfAi45dzjPXJu6uRteAIc-Z6TQav-LRFG8-SDCAfL2wQGBM1URWSM1gglLO8MwvYkyMW4JinOcQ3WOHZ2QB3GGhIxrXwKQOomSukzxewoONh2iQAiLlyhJNwUg_i714ihv/s320/demo%20profile%205.png"
                            alt="Profile 1"
                            fill
                            className="object-cover"
                        />
                    </div>
                </div>
                 {/* Avatar 2 (Bottom) */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
                   <div className="relative h-12 w-12 rounded-full overflow-hidden blur-[2px] animate-spin-slow-reverse">
                        <Image
                            src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEiRFKVT6Hq5aKq8lP0EfeFTQMvGBMBD7Qcn5a347eq19vSsX3OLXIZ80Ggh9Ucw2OkMAoCNjs7kGzd5QdLbtJ5kczINsGyHt11ZRJTc7lzlPi1-etHHdZuW0xFoYMdEPk7IIqgM15h7cY-sngmh6r-59c5Itnqfx3GNthAMeIwiFMYFKNtQOO293QOnixie/s320/demo%20profile%204.jpg"
                            alt="Profile 2"
                            fill
                            className="object-cover"
                        />
                    </div>
                </div>
            </div>

            {/* Inner Orbit */}
             <div className="absolute w-[200px] h-[200px] animate-spin-slow-reverse">
                 {/* Avatar 3 (Left) */}
                <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2">
                     <div className="relative h-10 w-10 rounded-full overflow-hidden blur-[2px] animate-spin-slow">
                        <Image
                            src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjBmZb3uykpKpaW3VGWkJdOMssZrbME9MvIYmfluO0aTDa9QAOdimTBQOm8fwQDawffB2sUJKPN2W5xaSzVWTtVBFCWEbbPkuHz9cFBZum8tx8aEyHakc0GLme-QvLwyJyJnokU1Ozb2dLwZuZPddj2w25s38yepCYzfGuaK14cFcA1JLPHz1tTJQxs5Tv8/s320/demo%20profile%203.jpg"
                            alt="Profile 3"
                            fill
                            className="object-cover"
                        />
                    </div>
                </div>
                {/* Avatar 4 (Right) */}
                <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2">
                   <div className="relative h-10 w-10 rounded-full overflow-hidden blur-[2px] animate-spin-slow">
                        <Image
                            src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEjuiyp3nmqkOPU38Mrqn6WhSS9ZVqUBOHCq439-DNdXxR8JdGWTDcq97V-6P1KHTO9W4F7Udoh9ja5rBw1gPsINICTlUqaadNfajnTmvxCPOfju-0cbw-dMAkvTtvMBWjC9TiI7pnFXaO2YyxP2fiRxlx9wYL20VrhBmH5tXhac7LxJsYmirLN3z7JyMW9I/s320/demo%20profile%202.webp"
                            alt="Profile 4"
                            fill
                            className="object-cover"
                        />
                    </div>
                </div>
            </div>

            <div className="z-10 animate-blur-unblur-slow">
                <Image
                    src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh5r85BhL7rCkS72xpX_5xkFZ9y_fVMFXYp_zLN9eEAnEA_C61c1jCJFaG86d1W6_mtsla64B191MOWYEFhJAa-lyMikD80WyfBVKiQxyc71spJx3Oy2FgvfotsVVnNIXGRXunpHYYvGFoQ7V-URilBXwJzIV9zQLSO_PN9raerNaTAb0VuCYo9EBqiyVts/s320/New%20Project%2020%20%5BEFC25EE%5D.png"
                    alt="Blur Logo"
                    width={120}
                    height={40}
                    className="dark:hidden"
                />
                <Image
                    src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEi6D6Qy-Z4uf0bgTdhcmekuXrwq7YSU5g8a9bmMVwbjotQ6VNa8NHuFnKjytbRlJb5_g_mqhMrrFmXPd_6W9aeFlItcwiIYjYhzorTAMCPvEBiipvksoQmvxEMmc4-CkvHEQxiO-DGiK4uGIS9nxKTFeu29sutuw3TD-T81opk0NRfGqIkdnrxd1nsU1Nbd/s0/blur%20text%20logo%20darktheme.png"
                    alt="Blur Logo"
                    width={120}
                    height={40}
                    className="hidden dark:block"
                />
            </div>
      </div>
      <div className="w-full max-w-sm z-10">
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
        <Button asChild size="lg" className="w-full text-lg rounded-full mt-32">
          <Link href="/auth">
            Get Started
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}
