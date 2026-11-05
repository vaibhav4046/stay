/** Sends one Web Push message. The payload is end-to-end encrypted to the browser by `web-push`; the push service only relays it. */
import webpush from 'web-push';
import type { PushSubscriptionJson } from './validate';

const SITE = 'https://stay-two-swart.vercel.app';

export const pushSendConfigured = () => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY ?? '';

export type SendResult = 'ok' | 'gone' | 'failed';

export async function sendPush(sub: PushSubscriptionJson, body: string, topic: string): Promise<SendResult> {
  try {
    await webpush.sendNotification(sub, JSON.stringify({ title: 'Stay', body, inbox: topic !== 'welcome', slot: topic === 'welcome' ? undefined : topic }), {
      vapidDetails: { subject: process.env.PUSH_CONTACT || SITE, publicKey: process.env.VAPID_PUBLIC_KEY ?? '', privateKey: process.env.VAPID_PRIVATE_KEY ?? '' },
      TTL: 6 * 60 * 60, // an unread nudge from this morning is stale by afternoon
      urgency: 'low',
      topic, // a newer message in the same slot replaces one that never arrived
      timeout: 8000,
    });
    return 'ok';
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    return status === 404 || status === 410 ? 'gone' : 'failed';
  }
}
