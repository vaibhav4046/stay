import { describe, expect, it } from 'vitest';
import { detectTopicShape } from '@/lib/voice/useVoiceAgent';

describe('Topic Shape Classifier', () => {
  it('detects ice cream, sweet treats, and food as shape 1 (conical swell)', () => {
    expect(detectTopicShape('I want to eat ice cream after this')).toBe(1);
    expect(detectTopicShape('Can I have some cake or dessert as a reward?')).toBe(1);
    expect(detectTopicShape('Grab a coffee and snack')).toBe(1);
    expect(detectTopicShape('A sweet cookie')).toBe(1);
  });

  it('detects letters, paperwork, email, code, and documents as shape 2 (structured facets)', () => {
    expect(detectTopicShape('I need to reply to this letter from my landlord')).toBe(2);
    expect(detectTopicShape('Writing an email to my manager')).toBe(2);
    expect(detectTopicShape('Doing my tax paperwork and spreadsheets')).toBe(2);
    expect(detectTopicShape('Fix this code bug in the file')).toBe(2);
    expect(detectTopicShape('Drafting an essay')).toBe(2);
  });

  it('detects music, art, creativity, and brainstorming as shape 3 (spiral ribbons)', () => {
    expect(detectTopicShape('Listen to music while brainstorming')).toBe(3);
    expect(detectTopicShape('I want to draw and sketch on canvas')).toBe(3);
    expect(detectTopicShape('Creative design work for my portfolio')).toBe(3);
    expect(detectTopicShape('Playing my guitar')).toBe(3);
  });

  it('detects breathing, somatic grounding, therapeutic, and overwhelm as shape 4 (concentric calming ripples)', () => {
    expect(detectTopicShape('Help me breathe, I feel anxious')).toBe(4);
    expect(detectTopicShape('I am completely overwhelmed right now')).toBe(4);
    expect(detectTopicShape('Let us meditate and calm down')).toBe(4);
    expect(detectTopicShape('Somatic ground me')).toBe(4);
    expect(detectTopicShape('Make it feel therapeutic and soothing')).toBe(4);
    expect(detectTopicShape('Gentle zen mindfulness')).toBe(4);
  });

  it('defaults to 0 (organic fluid wave) for neutral or unclassified speech', () => {
    expect(detectTopicShape('Hello how are you today')).toBe(0);
    expect(detectTopicShape('The car is parked outside')).toBe(0);
    expect(detectTopicShape('Testing 1 2 3')).toBe(0);
  });

  it('detects ADHD cognitive games, web research, and timer hourglass as shapes 5, 6, and 7', () => {
    expect(detectTopicShape('I want to play a game')).toBe(5);
    expect(detectTopicShape('Play memory puzzle game')).toBe(5);
    expect(detectTopicShape('Search the web for ADHD neuroscience')).toBe(6);
    expect(detectTopicShape('Start a countdown timer hourglass')).toBe(7);
  });
});

import { evaluateParametricShapePoint } from '@/components/Signal';
import {
  generateLiveAgenticArtifact,
  analyzeUserAdhdPhenotype,
  ADHD_CLINICAL_ENCYCLOPEDIA,
} from '@/lib/coach/adhdClinicalEngine';

describe('Smooth Parametric Shape Sculpture & 24/7 Living ADHD Clinical Engine', () => {
  it('evaluates smooth, non-NaN parametric control points across all 8 topic shapes (0..7) and layer scales', () => {
    for (const shapeId of [0, 1, 2, 3, 4, 5, 6, 7]) {
      for (const layerScale of [1.0, 0.82, 0.64]) {
        const ptTop = evaluateParametricShapePoint(shapeId, -Math.PI / 2, 1.0, 0.35, layerScale);
        const ptBottom = evaluateParametricShapePoint(shapeId, Math.PI / 2, 1.0, 0.35, layerScale);
        expect(Number.isFinite(ptTop[0])).toBe(true);
        expect(Number.isFinite(ptTop[1])).toBe(true);
        expect(Number.isFinite(ptBottom[0])).toBe(true);
        expect(Number.isFinite(ptBottom[1])).toBe(true);
      }
    }
  });

  it('autonomously drafts editable correspondence, tax triage worksheets, or document skeletons (24/7 Living Agent)', () => {
    const landlordArtifact = generateLiveAgenticArtifact(
      "uhh my brain is fried and I haven't replied to my landlord or touched my tax paperwork"
    );
    expect(landlordArtifact.artifactType).toContain('Correspondence');
    expect(landlordArtifact.agentStatus).toContain('Stay Autonomous Agent');
    expect(landlordArtifact.draftContent).toContain('Subject: Quick update — Lease letter');
    expect(landlordArtifact.checklist.length).toBe(3);

    const writingArtifact = generateLiveAgenticArtifact('Write conference proposal abstract');
    expect(writingArtifact.draftContent).toContain('Core Problem');
    expect(writingArtifact.checklist.length).toBe(3);
  });

  it('analyzes personal ADHD phenotype (Dopamine, Working Memory, Prefrontal Axis) and exposes 1775-2024 clinical history', () => {
    const profile = analyzeUserAdhdPhenotype(
      'I need to reply to my landlord email',
      4,
      6
    );
    expect(profile.phenotypeTitle).toBeTruthy();
    expect(profile.tonicDopamineAfter).toBeGreaterThan(profile.tonicDopamineBefore);
    expect(profile.workingMemoryLoadAfter).toBeLessThan(profile.workingMemoryLoadBefore);
    expect(ADHD_CLINICAL_ENCYCLOPEDIA.length).toBeGreaterThanOrEqual(7);
    expect(ADHD_CLINICAL_ENCYCLOPEDIA[0].eraOrYear).toContain('1775');
  });
});


