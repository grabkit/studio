
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Image from 'next/image';


export default function GetStartedPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-between bg-background p-8 text-center">
      <div className="flex-shrink-0" />
      <div className="flex flex-col items-center justify-center flex-grow">
        <div className="relative w-[320px] h-[320px] flex items-center justify-center">
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
            <div className="absolute inset-0">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3">
                  <Image
                    src="https://picsum.photos/seed/1/50/50"
                    alt="Profile 1"
                    width={50}
                    height={50}
                    className="rounded-full shadow-md"
                    data-ai-hint="person face"
                  />
              </div>
            </div>
             <div className="absolute inset-0">
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
                   <Image
                    src="https://picsum.photos/seed/2/50/50"
                    alt="Profile 2"
                    width={50}
                    height={50}
                    className="rounded-full shadow-md"
                    data-ai-hint="man portrait"
                  />
                </div>
            </div>
             <h1 className="font-headline text-6xl font-bold text-primary z-10">
                Blur
             </h1>
        </div>
      </div>
      <div className="w-full max-w-sm">
        <Button asChild size="lg" className="w-full font-headline text-lg rounded-full">
          <Link href="/auth">
            Get Started
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
