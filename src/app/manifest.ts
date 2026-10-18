import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Stay: start the thing you have been avoiding',
    short_name: 'Stay',
    description: 'A voice companion that turns a task you cannot begin into one small first step.',
    start_url: '/app/today?voice=auto',
    display: 'standalone',
    background_color: '#FAF8F5',
    theme_color: '#FAF8F5',
    orientation: 'portrait',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Talk to Stay',
        short_name: 'Talk',
        description: 'Open Stay ready to talk',
        url: '/app/today?voice=auto',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Start a 20 minute block',
        short_name: 'Focus 20m',
        description: 'Start a 20 minute focus block',
        url: '/app/today?timer=20&voice=auto',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Ground me',
        short_name: 'Ground Me',
        description: 'A short breathing and grounding exercise',
        url: '/app/today?action=grounding',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
