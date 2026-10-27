import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { AutoDirection } from '../components/auto-direction';
import { FormValidation } from '../components/form-validation';
import { IranBanner } from '../components/iran';
import { SiteFooter, SiteHeader } from '../components/site-header';
import { Toaster } from '../components/toast';
import { webEnv } from '../lib/env';
import { MONITORING_META } from '../lib/monitoring/browser';
import { browserMonitoringConfig, monitoringConfig } from '../lib/monitoring/config';
import { messages } from '../messages/fa';
import './globals.css';

// Vazirmatn variable font (100–900), subset by scripts/subset-font.sh. SIL OFL, see fonts/OFL.txt.
const vazirmatn = localFont({
  src: './fonts/Vazirmatn-subset.woff2',
  weight: '100 900',
  display: 'swap',
  variable: '--font-vazirmatn',
});

export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(webEnv().APP_URL),
    title: messages.site.title,
    description: messages.site.description,
    applicationName: messages.site.name,
    // Icons and the share image are files next to this one: icon.svg, icon.png, apple-icon.png,
    // favicon.ico, opengraph-image.png (drawn by scripts/brand-assets.mjs), and manifest.ts
    openGraph: { siteName: messages.site.name, locale: 'fa_IR' },
  };
}

export const viewport: Viewport = {
  themeColor: '#0b6e77',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Every page is rendered per request: the CSP nonce from src/proxy.ts changes on each one, and
  // Next.js can only put it on its scripts when it renders the page.
  await connection();
  const env = webEnv();
  // Browser error monitoring's settings (src/lib/monitoring/browser.ts); none when it is off
  const monitoring = browserMonitoringConfig(monitoringConfig(env), env.APP_URL);

  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <head>{monitoring && <meta name={MONITORING_META} content={JSON.stringify(monitoring)} />}</head>
      <body className="flex min-h-dvh flex-col bg-white font-sans text-neutral-900 antialiased">
        <SiteHeader />
        <IranBanner />
        <div className="flex-1">{children}</div>
        <SiteFooter />
        <Toaster />
        <FormValidation />
        <AutoDirection />
      </body>
    </html>
  );
}
