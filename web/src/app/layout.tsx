import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono, Space_Grotesk } from 'next/font/google';
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
// Display face — geometric, used for hero numbers + page titles (the moments
// that matter). Body/UI stays on Inter.
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: {
    default: 'Flux — Your AI social media team',
    template: '%s · Flux',
  },
  description:
    'Daily Instagram content without hiring a designer. Flux researches, writes, designs, captions, and queues — every post on-brand, every time.',
  applicationName: 'Flux',
  authors: [{ name: 'Flux' }],
  openGraph: {
    title: 'Flux',
    description: 'Your AI social media team. On the payroll for $19.',
    type: 'website',
  },
  // icon.svg + apple-icon.svg live next to this file — Next auto-wires them.
};

export const viewport: Viewport = {
  themeColor: '#06070B',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrains.variable} ${spaceGrotesk.variable} dark`}
    >
      <body className="font-sans">{children}</body>
    </html>
  );
}
