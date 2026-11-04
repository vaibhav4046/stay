'use client';

import { Sheet } from '@/components/Sheet';
import { canShareScreen, canUseCamera, type ShareMode } from '@/lib/vision/capture';

/** "Show Stay": the three ways to let it see. Starting a share needs a tap, which is why it is a panel and not something to say. */
export function ShowStayPanel({ onShare, onPicture, onClose }: { onShare: (mode: ShareMode) => void; onPicture: () => void; onClose: () => void }) {
  const screen = canShareScreen();
  const camera = canUseCamera();
  return (
    <Sheet title="Show Stay" onClose={onClose}>
      <p className="text-ink-2">Let Stay see what you are working on, so it can help with the real thing.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button type="button" className="btn btn-secondary flex-col !items-start gap-0.5 !py-3 text-left" disabled={!screen} onClick={() => onShare('screen')} data-testid="share-screen">
          <span className="font-semibold">Share my screen</span>
          <span className="meta">{screen ? 'A window or the whole screen' : 'Not available in this browser'}</span>
        </button>
        <button type="button" className="btn btn-secondary flex-col !items-start gap-0.5 !py-3 text-left" disabled={!camera} onClick={() => onShare('camera')} data-testid="share-camera">
          <span className="font-semibold">Use the camera</span>
          <span className="meta">Point it at your desk, a form, a mess</span>
        </button>
        <button type="button" className="btn btn-secondary flex-col !items-start gap-0.5 !py-3 text-left" onClick={onPicture} data-testid="add-picture">
          <span className="font-semibold">Add a picture</span>
          <span className="meta">A photo or screenshot from this device</span>
        </button>
      </div>
      <p className="meta mt-4" data-testid="vision-privacy">
        Stay looks at a picture only when you send one or ask it to look. The picture goes to the AI model that answers you, is not saved, and never goes into your history. Close private tabs first. You can stop at any time.
      </p>
    </Sheet>
  );
}
