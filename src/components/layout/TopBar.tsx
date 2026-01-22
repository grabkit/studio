
'use client';

import Image from "next/image";
import { useEffect, useState } from "react";
import { eventBus } from "@/lib/event-bus";

export default function TopBar() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const handleRefreshStart = () => setIsRefreshing(true);
    const handleRefreshEnd = () => setIsRefreshing(false);

    eventBus.on('refresh-start', handleRefreshStart);
    eventBus.on('refresh-end', handleRefreshEnd);

    return () => {
      eventBus.off('refresh-start', handleRefreshStart);
      eventBus.off('refresh-end', handleRefreshEnd);
    };
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-12 bg-background-blur border-b">
      <div className="flex items-center justify-center h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Image 
          src="https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh5r85BhL7rCkS72xpX_5xkFZ9y_fVMFXYp_zLN9eEAnEA_C61c1jCJFaG86d1W6_mtsla64B191MOWYEFhJAa-lyMikD80WyfBVKiQxyc71spJx3Oy2FgvfotsVVnNIXGRXunpHYYvGFoQ7V-URilBXwJzIV9zQLSO_PN9raerNaTAb0VuCYo9EBqiyVts/s320/New%20Project%2020%20%5BEFC25EE%5D.png" 
          alt="Blur Logo"
          width={60}
          height={20}
        />
      </div>
      {isRefreshing && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 w-full overflow-hidden">
            <div className="h-full w-full animate-loading-bar" />
        </div>
      )}
    </header>
  );
}
