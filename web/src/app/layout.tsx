import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Flux — AI Instagram content, on autopilot',
    template: '%s · Flux',
  },
  description:
    'Flux is the AI content engine that turns one topic into a finished, on-brand Instagram carousel — ready to schedule.',
  applicationName: 'Flux',
  authors: [{ name: 'Flux' }],
  openGraph: {
    title: 'Flux',
    description: 'AI Instagram content, on autopilot.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#08090C',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} dark`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
