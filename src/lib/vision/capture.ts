/**
 * Browser side of vision: ask to share a screen or open the camera, and turn a video frame or a file into a small JPEG.
 * Nothing leaves the browser until the person sends a message or presses "Look now".
 */
export type ShareMode = 'screen' | 'camera';

export const canShareScreen = () => typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function';
export const canUseCamera = () => typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';

/** Opens the browser's own picker (screen) or permission prompt (camera). Must be called from a tap or click. */
export async function startShare(mode: ShareMode): Promise<MediaStream> {
  if (mode === 'screen') return navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 5 }, audio: false });
  return navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
}

const TARGET_CHARS = 650_000; // keeps one request well under the server's cap

/** Draws a source at a bounded size and encodes it as a JPEG, lowering quality or size until it is small enough. */
function encode(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, srcW: number, srcH: number, maxSide: number): string | null {
  if (!srcW || !srcH) return null;
  let side = maxSide;
  for (let attempt = 0; attempt < 4; attempt++) {
    const scale = Math.min(1, side / Math.max(srcW, srcH));
    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    draw(ctx, w, h);
    for (const q of [0.72, 0.55, 0.4]) {
      const url = canvas.toDataURL('image/jpeg', q);
      if (url.length <= TARGET_CHARS) return url;
    }
    side = Math.round(side * 0.75);
  }
  return null;
}

/** The current frame of a playing video, or null if it has no picture yet. */
export function frameFromVideo(video: HTMLVideoElement | null, maxSide = 1280): string | null {
  if (!video || video.readyState < 2) return null;
  return encode((ctx, w, h) => ctx.drawImage(video, 0, 0, w, h), video.videoWidth, video.videoHeight, maxSide);
}

export const MAX_FILE_BYTES = 15 * 1024 * 1024;

/** A picture chosen from the device (or taken with the phone camera). Rejects anything that is not an image. */
export async function imageFromFile(file: File, maxSide = 1280): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('not_an_image');
  if (file.size > MAX_FILE_BYTES) throw new Error('too_big');
  const bmp = await createImageBitmap(file);
  try {
    const url = encode((ctx, w, h) => ctx.drawImage(bmp, 0, 0, w, h), bmp.width, bmp.height, maxSide);
    if (!url) throw new Error('could_not_read');
    return url;
  } finally {
    bmp.close();
  }
}
