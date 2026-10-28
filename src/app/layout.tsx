import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { AutoDirection } from '../components/auto-direction';
import { FormValidation } from '../components/form-validation';
import { IranBanner } from '../components/iran';
import { SiteFooter, SiteHeader } from '../components/site-header';
import { ViewAsBanner } from '../components/view-as-banner';
import { Toaster } from '../components/toast';
import { webEnv } from '../lib/env';
import { MONITORING_META } from '../lib/monitoring/browser';
import { browserMonitoringConfig, monitoringConfig } from '../lib/monitoring/config';
import { messages } from '../messages/fa';
import { currentTheme } from './theme';
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

// The browser's bar: turquoise in light, the dark surface in dark (wave 1, part 10)
const BAR = { light: '#0b6e77', dark: '#16211f' };

export async function generateViewport(): Promise<Viewport> {
  const theme = await currentTheme();
  return {
    themeColor:
      theme === 'auto'
        ? [
            { media: '(prefers-color-scheme: light)', color: BAR.light },
            { media: '(prefers-color-scheme: dark)', color: BAR.dark },
          ]
        : BAR[theme],
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Every page is rendered per request: the CSP nonce from src/proxy.ts changes on each one, and
  // Next.js can only put it on its scripts when it renders the page.
  await connection();
  const env = webEnv();
  // Browser error monitoring's settings (src/lib/monitoring/browser.ts); none when it is off
  const monitoring = browserMonitoringConfig(monitoringConfig(env), env.APP_URL);
  // Light or dark when chosen; otherwise globals.css follows the device (src/app/theme.ts)
  const theme = await currentTheme();

  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable} data-theme={theme === 'auto' ? undefined : theme}>
      <head>{monitoring && <meta name={MONITORING_META} content={JSON.stringify(monitoring)} />}</head>
      <body className="flex min-h-dvh flex-col bg-white font-sans text-neutral-900 antialiased">
        <ViewAsBanner />
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
