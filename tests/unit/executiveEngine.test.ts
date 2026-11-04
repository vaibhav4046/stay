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
      expect(result.spokenSummary).toContain('first move takes about 45 seconds');
      expect(JSON.stringify(result)).not.toMatch(/dread|dopamine|% of users|inertiaBreakRate/i); // no invented rate, no pseudo-science
    });

    it('calculates reality for physical cleaning tasks', () => {
      const result = calculateTaskReality('Tidy and clean the kitchen');
      expect(result.perceivedMinutes).toBe(120);
      expect(result.microEntrySeconds).toBe(60);
      expect(result.recommendedSprintMinutes).toBe(5);
    });

    it('calculates reality for open-ended writing and essay tasks', () => {
      const result = calculateTaskReality('Write literature review essay');
      expect(result.perceivedMinutes).toBe(240);
      expect(result.microEntrySeconds).toBe(90);
      expect(result.recommendedSprintMinutes).toBe(15);
    });

    it('calculates reality for interpersonal and email communication tasks', () => {
      const result = calculateTaskReality('Reply to landlord about leaking radiator');
      expect(result.perceivedMinutes).toBe(45);
      expect(result.microEntrySeconds).toBe(30);
      expect(result.recommendedSprintMinutes).toBe(5);
    });
  });

  describe('Friction-Free Starter Angle Brainstorming', () => {
    it('generates 3 concrete low-friction angles for writing tasks', () => {
      const result = brainstormStarterAngles('Write conference proposal abstract');
      expect(result.angles).toHaveLength(3);
      expect(result.angles[0].name).toBe('A rough first pass');
      expect(result.angles[1].name).toBe('Write the ending first');
      expect(result.angles[2].name).toBe('Say it out loud');
      result.angles.forEach((angle) => {
        expect(angle.prompt.length).toBeGreaterThan(15);
        expect(angle.timeSeconds).toBeLessThanOrEqual(120);
        expect(angle.rationale.length).toBeGreaterThan(10);
      });
      expect(result.spokenSummary).toContain('Three ways in');
    });

    it('generates 3 bounded angles for physical tasks', () => {
      const result = brainstormStarterAngles('Clean out the garage');
      expect(result.angles).toHaveLength(3);
      expect(result.angles[0].name).toBe('Five things');
      expect(result.angles[1].name).toBe('One surface');
      expect(result.angles[2].name).toBe('One song');
    });

    it('generates 3 low-threat angles for bureaucratic/financial admin', () => {
      const result = brainstormStarterAngles('Pay overdue council tax bill');
      expect(result.angles).toHaveLength(3);
      expect(result.angles[0].name).toBe('Just open it');
      expect(result.angles[1].name).toBe('One field');
      expect(result.angles[2].name).toBe('Take a screenshot');
    });
  });

  describe('3-Phase Execution Path Synthesis', () => {
    it('synthesizes a 3-phase path with realistic time horizons', () => {
      const result = synthesizeTaskPath('Submit passport renewal application');
      expect(result.phases).toHaveLength(3);
      expect(result.phases[0].name).toBe('Get ready');
      expect(result.phases[1].name).toBe('Work');
      expect(result.phases[2].name).toBe('Stop cleanly');
      expect(result.totalSprintMinutes).toBeGreaterThanOrEqual(8);
      expect(result.spokenSummary).toContain('three parts');
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
