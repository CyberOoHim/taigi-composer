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
  description: 'Compose, edit, and play aligned Taigi (羅馬字 / 漢羅) lyrics with numbered musical notation (Numbered Notation) and interactive Karaoke engine.',
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
    description: 'Compose, edit, and play aligned Taigi (羅馬字 / 漢羅) lyrics with numbered musical notation (Numbered Notation) and interactive Karaoke engine.',
    type: 'website',
    siteName: 'Taigi Composer',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Taigi Composer & Karaoke Studio',
    description: 'Compose, edit, and play aligned Taigi (羅馬字 / 漢羅) lyrics with numbered musical notation (Numbered Notation) and interactive Karaoke engine.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var z=localStorage.getItem('taigi_composer_ui_text_zoom');if(z){var v=parseFloat(z);if(!isNaN(v)&&v>=0.7&&v<=2.0){document.documentElement.style.fontSize=(v*100)+'%';document.documentElement.style.setProperty('--ui-text-zoom',String(v));document.documentElement.setAttribute('data-ui-zoom',String(Math.round(v*100)));}}}catch(e){}})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning className="antialiased">
        {children}
        <PwaManager />
      </body>
    </html>
  );
}
