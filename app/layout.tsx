import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PwaManager } from '@/components/PwaManager';

export const viewport: Viewport = {
  themeColor: '#f59e0b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'Taigi Composer & Karaoke Studio',
  description: 'Compose, edit, and play aligned Taigi (Hanji/POJ/TL) lyrics with numbered musical notation (Numbered Notation) and interactive Karaoke engine.',
  applicationName: 'Taigi Composer',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Taigi Composer',
  },
  formatDetection: {
    telephone: false,
  },
  manifest: 'manifest.webmanifest',
  icons: {
    icon: [
      { url: 'icons/icon.svg', type: 'image/svg+xml' },
      { url: 'icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: 'icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
      { url: 'favicon.ico' },
    ],
    apple: [
      { url: 'icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'Taigi Composer & Karaoke Studio',
    description: 'Compose, edit, and play aligned Taigi (Hanji/POJ/TL) lyrics with numbered musical notation (Numbered Notation) and interactive Karaoke engine.',
    type: 'website',
    siteName: 'Taigi Composer',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Taigi Composer & Karaoke Studio',
    description: 'Compose, edit, and play aligned Taigi (Hanji/POJ/TL) lyrics with numbered musical notation (Numbered Notation) and interactive Karaoke engine.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="manifest.webmanifest" />
        <link rel="apple-touch-icon" href="icons/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Taigi Composer" />
      </head>
      <body suppressHydrationWarning className="antialiased">
        {children}
        <PwaManager />
      </body>
    </html>
  );
}
