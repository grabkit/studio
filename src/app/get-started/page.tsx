import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function GetStartedPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-between bg-background p-8 text-center">
      <div className="flex-shrink-0" />
      <div className="flex flex-col items-center">
        
      </div>
      <div className="w-full max-w-sm">
        <Button asChild size="lg" className="w-full font-headline text-lg">
          <Link href="/auth">
            Get Started
            <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
