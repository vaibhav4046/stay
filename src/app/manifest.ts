import type { MetadataRoute } from 'next';

// Colours mirror apps/shared/tokens.json (the one place the wrappers read their theme from).
const CANVAS = '#FAF8F5';
const png = (name: string, size: number, purpose: 'any' | 'maskable' | 'monochrome') => ({
  src: `/icons/${name}.png`,
  sizes: `${size}x${size}`,
  type: 'image/png',
  purpose,
});

export default function manifest(): MetadataRoute.Manifest {
  const shortcutIcon = [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }];
  return {
    id: '/app/today',
    name: 'Stay: start the thing you have been avoiding',
    short_name: 'Stay',
    description: 'A voice companion that turns a task you cannot begin into one small first step.',
    lang: 'en-GB',
    dir: 'ltr',
    start_url: '/app/today?voice=auto',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'any',
    background_color: CANVAS,
    theme_color: CANVAS,
    categories: ['health', 'lifestyle', 'productivity'],
    icons: [
      png('icon-192', 192, 'any'),
      png('icon-512', 512, 'any'),
      png('icon-maskable-192', 192, 'maskable'),
      png('icon-maskable-512', 512, 'maskable'),
      png('icon-mono-512', 512, 'monochrome'),
    ],
    shortcuts: [
      { name: 'Talk to Stay', short_name: 'Talk', description: 'Open Stay ready to talk', url: '/app/today?voice=auto', icons: shortcutIcon },
      { name: 'Brain dump', short_name: 'Brain dump', description: 'Empty your head onto the page', url: '/app/today?action=dump', icons: shortcutIcon },
      { name: 'Start a 20 minute block', short_name: 'Focus 20m', description: 'Start a 20 minute focus block', url: '/app/today?timer=20', icons: shortcutIcon },
      { name: 'Ground me', short_name: 'Ground Me', description: 'A short breathing and grounding exercise', url: '/app/today?action=grounding', icons: shortcutIcon },
    ],
    screenshots: [
      { src: '/screenshots/today-narrow.png', sizes: '780x1688', type: 'image/png', form_factor: 'narrow', label: 'Tap the orb and say what you are putting off' },
      { src: '/screenshots/today-wide.png', sizes: '1280x800', type: 'image/png', form_factor: 'wide', label: 'Stay on a desktop screen' },
    ],
    // Text or a link shared from another app is parked in the parking lot (src/app/app/share/page.tsx).
    share_target: { action: '/app/share', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } },
  } as MetadataRoute.Manifest;
}
