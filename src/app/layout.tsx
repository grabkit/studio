import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase/client-provider';

const ogImageUrl = "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgSIOQYwoQ_D8LcS9OlsMjXOlBws0OSrPnxh7nqq_wHdmqQ9PlIRvrtOni6EwDf68sAofpaFhvfA4wK58PpYu6HV4JeLsFbj61-ryJZUGPsGed4dswZSblL09Huc3Fd4-nmSln8MybhJVeWIMSoudR_U6Pe0IiCuiJ4ucEqFn6i0zNdTqNwM6goO8pbOaOR/s320/blur%20OG%20logo.png";

export const metadata: Metadata = {
  title: 'Blur Networks',
  description: 'Your secure and anonymous identity starts here.',
  openGraph: {
    title: 'Blur Networks',
    description: 'Your secure and anonymous identity starts here.',
    images: [
      {
        url: ogImageUrl,
        width: 320,
        height: 320,
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Blur Networks',
    description: 'Your secure and anonymous identity starts here.',
    images: [ogImageUrl],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=PT+Sans:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          {children}
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
