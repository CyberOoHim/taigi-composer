import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Taigi Composer & Karaoke Studio (台語簡譜創作與卡拉OK)',
  description: 'Compose, edit, and play aligned Taigi (Hanji/POJ/PIJ) lyrics with numbered musical notation (Jianpu) and interactive Karaoke engine.',
  openGraph: {
    title: 'Taigi Composer & Karaoke Studio',
    description: 'Compose, edit, and play aligned Taigi (Hanji/POJ/PIJ) lyrics with numbered musical notation (Jianpu) and interactive Karaoke engine.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Taigi Composer & Karaoke Studio',
    description: 'Compose, edit, and play aligned Taigi (Hanji/POJ/PIJ) lyrics with numbered musical notation (Jianpu) and interactive Karaoke engine.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
