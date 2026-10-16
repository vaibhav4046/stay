import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Stay — Living Voice AI ADHD Companion',
    short_name: 'Stay',
    description: 'Living 24/7 Voice AI Companion & ADHD Task-Starting Scaffolding',
    start_url: '/app/today?voice=auto',
    display: 'standalone',
    background_color: '#FAF8F5',
    theme_color: '#006A67',
    orientation: 'portrait',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
    shortcuts: [
      {
        name: 'Talk to Stay (Living Voice)',
        short_name: 'Talk',
        description: 'Instant hands-free living voice companion',
        url: '/app/today?voice=auto',
        icons: [{ src: '/favicon.ico', sizes: '96x96' }],
      },
      {
        name: 'Start 20m Focus Block',
        short_name: 'Focus 20m',
        description: 'Start a 20-minute body-double focus sprint',
        url: '/app/today?timer=20&voice=auto',
        icons: [{ src: '/favicon.ico', sizes: '96x96' }],
      },
      {
        name: 'Ground Me (Calm & Breathe)',
        short_name: 'Ground Me',
        description: 'Instant sensory grounding and box breathing',
        url: '/app/today?action=grounding',
        icons: [{ src: '/favicon.ico', sizes: '96x96' }],
      },
    ],
  };
}
