import { beforeEach, describe, expect, it } from 'vitest';
import { loadParked, parkThought, unparkThought, PARKING_KEY } from '@/lib/coach/parkingLot';

class MemStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return Array.from(this.m.keys())[i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}

beforeEach(() => {
  (globalThis as unknown as { window: { localStorage: MemStorage } }).window = { localStorage: new MemStorage() };
});

describe('parking lot', () => {
  it('starts empty and keeps newest first', () => {
    expect(loadParked()).toEqual([]);
    parkThought('call the dentist');
    parkThought('buy printer ink');
    expect(loadParked().map((i) => i.text)).toEqual(['buy printer ink', 'call the dentist']);
  });
  it('ignores blanks and case-insensitive duplicates, and trims long text', () => {
    parkThought('   ');
    parkThought('Water the plants');
    parkThought('water the PLANTS');
    expect(loadParked()).toHaveLength(1);
    expect(parkThought('x'.repeat(500))[0].text.length).toBe(140);
  });
  it('removes by id and survives corrupt storage', () => {
    const [a] = parkThought('one');
    parkThought('two');
    expect(unparkThought(a.id).map((i) => i.text)).toEqual(['two']);
    (globalThis as unknown as { window: { localStorage: MemStorage } }).window.localStorage.setItem(PARKING_KEY, '{not json');
    expect(loadParked()).toEqual([]);
  });
  it('caps the list at 50', () => {
    for (let i = 0; i < 60; i++) parkThought(`thought ${i}`);
    expect(loadParked()).toHaveLength(50);
    expect(loadParked()[0].text).toBe('thought 59');
  });
});
