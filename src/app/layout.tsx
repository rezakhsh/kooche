import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { messages } from '../messages/fa';
import './globals.css';

// Vazirmatn variable font (100–900), subset by scripts/subset-font.sh. SIL OFL, see fonts/OFL.txt.
const vazirmatn = localFont({
  src: './fonts/Vazirmatn-subset.woff2',
  weight: '100 900',
  display: 'swap',
  variable: '--font-vazirmatn',
});

export const metadata: Metadata = {
  title: messages.site.name,
  description: messages.site.description,
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Every page is rendered per request: the CSP nonce from src/proxy.ts changes on each one, and
  // Next.js can only put it on its scripts when it renders the page.
  await connection();

  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body className="min-h-dvh bg-white font-sans text-neutral-900 antialiased">{children}</body>
    </html>
  );
}
