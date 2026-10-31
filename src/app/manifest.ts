import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MajiFlow',
    short_name: 'MajiFlow',
    description: 'Clean drinking water delivery from refill stations across Kenya',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#ffffff',
    theme_color: '#0057E6',
    icons: [
      {
        src: '/logo-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/logo-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        // Full-bleed background so Android's icon mask never crops the drop.
        src: '/logo-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
