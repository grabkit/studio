import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function GetStartedPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-between bg-background p-8 text-center">
      <div className="flex-shrink-0" />
      <div className="flex flex-col items-center justify-center flex-grow relative">
        <div className="absolute inset-0 flex items-center justify-center">
            <svg width="220" height="220" viewBox="0 0 220 220" className="absolute">
              <circle
                cx="110"
                cy="110"
                r="100"
                stroke="hsl(var(--border))"
                strokeWidth="2"
                fill="none"
                strokeDasharray="10 10"
              />
            </svg>
        </div>
        <h1 className="font-headline text-6xl font-bold text-primary z-10">
          Blur
        </h1>
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
