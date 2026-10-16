import { describe, expect, it } from 'vitest';
import {
  analyzeStreamingUtterance,
  CLINICAL_INTERVENTIONS,
  getInterventionForBarrier,
} from '@/lib/coach/knowledge';

describe('ADHD Clinical Knowledge Engine (VoiceAgentRAG)', () => {
  it('contains evidence-grounded interventions for all 5 adult ADHD barriers', () => {
    expect(CLINICAL_INTERVENTIONS.length).toBeGreaterThanOrEqual(5);

    const overwhelm = getInterventionForBarrier('overwhelm');
    expect(overwhelm.strategy).toBe('task_shrinking');
    expect(overwhelm.evidenceSource).toContain('Safren');
    expect(overwhelm.backchannelCues.length).toBeGreaterThanOrEqual(3);

    const perfectionism = getInterventionForBarrier('perfectionism_or_fear');
    expect(perfectionism.strategy).toBe('reframing');
    expect(perfectionism.evidenceSource).toContain('Ramsay & Rostain');

    const unclear = getInterventionForBarrier('unclear_next_step');
    expect(unclear.strategy).toBe('implementation_intention');
    expect(unclear.evidenceSource).toContain('Gollwitzer');

    const boredom = getInterventionForBarrier('boredom_or_distraction');
    expect(boredom.strategy).toBe('timeboxing');
    expect(boredom.evidenceSource).toContain('Knouse');

    const lowEnergy = getInterventionForBarrier('low_energy');
    expect(lowEnergy.defaultMinutes).toBe(5);
  });

  it('detects overwhelm and provides clinical backchannel in real time', () => {
    const res = analyzeStreamingUtterance('I am drowning in emails and there is too much to handle');
    expect(res.detectedBarrier).toBe('overwhelm');
    expect(res.confidence).toBeGreaterThan(0.7);
    expect(res.suggestedBackchannel).toContain('heavy');
    expect(res.detectedTask).toBeDefined();
  });

  it('detects perfectionism / fear of making mistakes', () => {
    const res = analyzeStreamingUtterance("I'm terrified of making a stupid mistake on this contract");
    expect(res.detectedBarrier).toBe('perfectionism_or_fear');
    expect(res.suggestedBackchannel).toContain('draft');
    expect(res.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it('detects unclear next steps when user is lost', () => {
    const res = analyzeStreamingUtterance("I don't know where to start with this presentation");
    expect(res.detectedBarrier).toBe('unclear_next_step');
    expect(res.suggestedBackchannel).toContain('physical move');
  });

  it('detects boredom and understimulation', () => {
    const res = analyzeStreamingUtterance('This spreadsheet is so boring and tedious I keep scrolling my phone');
    expect(res.detectedBarrier).toBe('boredom_or_distraction');
    expect(res.suggestedBackchannel).toContain('dopamine');
  });

  it('extracts task targets using verb heuristics', () => {
    const res = analyzeStreamingUtterance('I have been putting off filing tax invoices for three months');
    expect(res.detectedTask).toBe('filing tax invoices');
  });

  it('executes in sub-millisecond latency for full-duplex voice streams', () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      analyzeStreamingUtterance('I am putting off sorting receipts because it is so boring');
    }
    const elapsed = performance.now() - start;
    const avgMs = elapsed / 100;
    // Realtime streaming constraint: must be well under 5ms per frame
    expect(avgMs).toBeLessThan(1.5);
  });
});
