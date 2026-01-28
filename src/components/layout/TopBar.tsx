'use client';

import Image from "next/image";

export default function TopBar() {
  const lightLogo = "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEh5r85BhL7rCkS72xpX_5xkFZ9y_fVMFXYp_zLN9eEAnEA_C61c1jCJFaG86d1W6_mtsla64B191MOWYEFhJAa-lyMikD80WyfBVKiQxyc71spJx3Oy2FgvfotsVVnNIXGRXunpHYYvGFoQ7V-URilBXwJzIV9zQLSO_PN9raerNaTAb0VuCYo9EBqiyVts/s320/New%20Project%2020%20%5BEFC25EE%5D.png";
  const darkLogo = "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEi6D6Qy-Z4uf0bgTdhcmekuXrwq7YSU5g8a9bmMVwbjotQ6VNa8NHuFnKjytbRlJb5_g_mqhMrrFmXPd_6W9aeFlItcwiIYjYhzorTAMCPvEBiipvksoQmvxEMmc4-CkvHEQxiO-DGiK4uGIS9nxKTFeu29sutuw3TD-T81opk0NRfGqIkdnrxd1nsU1Nbd/s0/blur%20text%20logo%20darktheme.png";

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-12 bg-background-blur border-b">
      <div className="flex items-center justify-center h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="dark:hidden">
            <Image 
              src={lightLogo} 
              alt="Blur Logo"
              width={60}
              height={20}
              priority
            />
        </div>
        <div className="hidden dark:block">
            <Image 
              src={darkLogo} 
              alt="Blur Logo"
              width={60}
              height={20}
              priority
            />
        </div>
      </div>
    </header>
  );
}
