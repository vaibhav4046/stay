import { describe, it, expect } from 'vitest';
import {
  calculateTaskReality,
  brainstormStarterAngles,
  synthesizeTaskPath,
} from '@/lib/coach/executiveEngine';
import { detectVoiceCommand } from '@/lib/voice/voiceCommands';

describe('ADHD Executive Engine (Calculation, Prediction, Brainstorm, Synthesis)', () => {
  describe('Time Reality Calculator & Time Blindness Debunker', () => {
    it('calculates reality for tax and financial administration tasks', () => {
      const result = calculateTaskReality('File my self-assessment tax return');
      expect(result.perceivedMinutes).toBeGreaterThanOrEqual(120);
      expect(result.microEntrySeconds).toBeLessThanOrEqual(60);
      expect(result.recommendedSprintMinutes).toBe(10);
      expect(result.inertiaBreakRate).toBeGreaterThan(80);
      expect(result.spokenSummary).toContain('minutes of dread');
    });

    it('calculates reality for physical cleaning tasks', () => {
      const result = calculateTaskReality('Tidy and clean the kitchen');
      expect(result.perceivedMinutes).toBe(120);
      expect(result.microEntrySeconds).toBe(60);
      expect(result.recommendedSprintMinutes).toBe(5);
      expect(result.inertiaBreakRate).toBe(89);
    });

    it('calculates reality for open-ended writing and essay tasks', () => {
      const result = calculateTaskReality('Write literature review essay');
      expect(result.perceivedMinutes).toBe(240);
      expect(result.microEntrySeconds).toBe(90);
      expect(result.recommendedSprintMinutes).toBe(15);
      expect(result.inertiaBreakRate).toBe(78);
    });

    it('calculates reality for interpersonal and email communication tasks', () => {
      const result = calculateTaskReality('Reply to landlord about leaking radiator');
      expect(result.perceivedMinutes).toBe(45);
      expect(result.microEntrySeconds).toBe(30);
      expect(result.recommendedSprintMinutes).toBe(5);
      expect(result.inertiaBreakRate).toBe(91);
    });
  });

  describe('Friction-Free Starter Angle Brainstorming', () => {
    it('generates 3 concrete low-friction angles for writing tasks', () => {
      const result = brainstormStarterAngles('Write conference proposal abstract');
      expect(result.angles).toHaveLength(3);
      expect(result.angles[0].name).toBe('The "Garbage First Pass"');
      expect(result.angles[1].name).toBe('The Reverse Finish Line');
      expect(result.angles[2].name).toBe('The 60-Second Verbal Dump');
      result.angles.forEach((angle) => {
        expect(angle.prompt.length).toBeGreaterThan(15);
        expect(angle.timeSeconds).toBeLessThanOrEqual(120);
        expect(angle.rationale.length).toBeGreaterThan(10);
      });
      expect(result.spokenSummary).toContain('3 easy entry angles');
    });

    it('generates 3 bounded angles for physical tasks', () => {
      const result = brainstormStarterAngles('Clean out the garage');
      expect(result.angles).toHaveLength(3);
      expect(result.angles[0].name).toBe('The 5-Item Rule');
      expect(result.angles[1].name).toBe('The "Single Surface" Boundary');
      expect(result.angles[2].name).toBe('One Song Sprint');
    });

    it('generates 3 low-threat angles for bureaucratic/financial admin', () => {
      const result = brainstormStarterAngles('Pay overdue council tax bill');
      expect(result.angles).toHaveLength(3);
      expect(result.angles[0].name).toBe('The "Open Tab Only" Move');
      expect(result.angles[1].name).toBe('The One-Field Rule');
      expect(result.angles[2].name).toBe('Visual Reconnaissance');
    });
  });

  describe('3-Phase Execution Path Synthesis', () => {
    it('synthesizes a 3-phase path with realistic time horizons', () => {
      const result = synthesizeTaskPath('Submit passport renewal application');
      expect(result.phases).toHaveLength(3);
      expect(result.phases[0].name).toBe('Desk Zero & Gathering');
      expect(result.phases[1].name).toBe('Focused Sprint Block');
      expect(result.phases[2].name).toBe('Clean Exit & Outcome Record');
      expect(result.totalSprintMinutes).toBeGreaterThanOrEqual(8);
      expect(result.spokenSummary).toContain('3-phase path');
    });
  });

  describe('Hands-Free Voice Command Interception', () => {
    it('detects calculate time commands', () => {
      expect(detectVoiceCommand('calculate time')).toEqual({ type: 'calculate_time' });
      expect(detectVoiceCommand('predict time')).toEqual({ type: 'calculate_time' });
      expect(detectVoiceCommand('how long will this take')).toEqual({ type: 'calculate_time' });
      expect(detectVoiceCommand('time reality check')).toEqual({ type: 'calculate_time' });
    });

    it('detects brainstorm starter angle commands', () => {
      expect(detectVoiceCommand('help me brainstorm')).toEqual({ type: 'brainstorm_angles' });
      expect(detectVoiceCommand('give me ideas')).toEqual({ type: 'brainstorm_angles' });
      expect(detectVoiceCommand('brainstorm ideas')).toEqual({ type: 'brainstorm_angles' });
      expect(detectVoiceCommand('unblock me')).toEqual({ type: 'brainstorm_angles' });
    });

    it('detects task path synthesis commands', () => {
      expect(detectVoiceCommand('outline steps')).toEqual({ type: 'synthesize_path' });
      expect(detectVoiceCommand('task path')).toEqual({ type: 'synthesize_path' });
      expect(detectVoiceCommand('research steps')).toEqual({ type: 'synthesize_path' });
      expect(detectVoiceCommand('give me a path')).toEqual({ type: 'synthesize_path' });
    });
  });
});
