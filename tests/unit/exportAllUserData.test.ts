import { describe, it, expect, beforeEach } from 'vitest';
import { exportAllUserDataJson } from '@/lib/storage/repository';

class MemStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return Array.from(this.m.keys())[i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

let storage: MemStorage;

beforeEach(() => {
  storage = new MemStorage();
  (globalThis as unknown as { window: { localStorage: MemStorage } }).window = { localStorage: storage };
});

describe('"download everything as JSON" (privacy page, Settings)', () => {
  it('includes the conversation, what Stay learned and the Today list', () => {
    storage.setItem('stay_active_session_v1', JSON.stringify({ transcripts: [{ id: 'u-1', role: 'user', text: 'Clean the garage' }] }));
    storage.setItem('stay_learnings_v1', JSON.stringify({ enabled: true, items: [{ id: 'l1', text: 'Short blocks help' }] }));
    storage.setItem('stay_today_list_v1', JSON.stringify([{ id: 't1', text: 'buy milk', bucket: 'today', done: false }]));

    const out = JSON.parse(exportAllUserDataJson());

    expect(out.otherSavedData.stay_active_session_v1.transcripts[0].text).toBe('Clean the garage');
    expect(out.otherSavedData.stay_learnings_v1.items[0].text).toBe('Short blocks help');
    expect(out.otherSavedData.stay_today_list_v1[0].text).toBe('buy milk');
  });

  it('keeps plain-text settings as text and does not repeat what is already exported by name', () => {
    storage.setItem('stay_selected_voice', 'audrey');
    storage.setItem('stay_user_memory_v1', JSON.stringify([{ id: 'm1', text: 'likes mornings' }]));

    const out = JSON.parse(exportAllUserDataJson());

    expect(out.otherSavedData.stay_selected_voice).toBe('audrey');
    expect(out.memory[0].text).toBe('likes mornings');
    expect(out.otherSavedData).not.toHaveProperty('stay_user_memory_v1');
  });

  it('never exports the person\'s own API keys or cloud setup, nor keys that are not Stay\'s', () => {
    storage.setItem('stay_byok', JSON.stringify({ groq: 'gsk_secret' }));
    storage.setItem('stay_supabase_url', 'https://example.supabase.co');
    storage.setItem('stay_supabase_anon_key', 'anon-secret');
    storage.setItem('other_app_key', 'not ours');

    const text = exportAllUserDataJson();

    expect(text).not.toContain('gsk_secret');
    expect(text).not.toContain('anon-secret');
    expect(text).not.toContain('example.supabase.co');
    expect(text).not.toContain('not ours');
  });
});
