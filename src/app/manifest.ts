import type { MetadataRoute } from 'next';
import { messages } from '../messages/fa';

// "Add to home screen" on phones: name, colours and the logo as the app icon
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: messages.site.title,
    short_name: messages.site.name,
    description: messages.site.description,
    lang: 'fa',
    dir: 'rtl',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0b6e77',
    icons: [
      { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
      { src: '/icon.png', type: 'image/png', sizes: '512x512' },
      { src: '/apple-icon.png', type: 'image/png', sizes: '180x180' },
    ],
  };
}
