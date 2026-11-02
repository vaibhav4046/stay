/**
 * Languages from the 18 October 2026 live test (docs/STAY_VERIFICATION_2026-10-18.md, part 2). The page shows ticks only: the raw
 * output of that test was not saved, so no error rates are shown.
 */
/** One synthesized sentence per language on auto-detect (STAY_VERIFICATION part 2). The page shows ticks only: the raw output was not saved. */
export const LANGS_OK: Array<[string, string, number]> = [
  ['en', 'English', 0], ['es', 'Spanish', 0], ['fr', 'French', 0], ['de', 'German', 0], ['it', 'Italian', 0], ['pt', 'Portuguese', 13],
  ['hi', 'Hindi', 5], ['ja', 'Japanese', 0], ['zh', 'Chinese', 0], ['ko', 'Korean', 0], ['nl', 'Dutch', 0], ['ru', 'Russian', 0],
  ['tr', 'Turkish', 0], ['ar', 'Arabic', 3], ['sv', 'Swedish', 0], ['no', 'Norwegian', 2], ['da', 'Danish', 0], ['fi', 'Finnish', 0],
  ['ro', 'Romanian', 2], ['vi', 'Vietnamese', 0], ['id', 'Indonesian', 4], ['ms', 'Malay', 1], ['he', 'Hebrew', 2],
];
/** Misheard on auto-detect and silent when pinned; the app uses the browser's speech recognition for these (the third number is the error rate in the old verification note). */ // claims-lint-allow: figures from an older note, never shown on the page
export const LANGS_NO: Array<[string, string, number]> = [
  ['pl', 'Polish', 58], ['hu', 'Hungarian', 38], ['el', 'Greek', 100], ['uk', 'Ukrainian', 100], ['bn', 'Bengali', 100], ['ta', 'Tamil', 100], ['te', 'Telugu', 100], ['th', 'Thai', 100],
];
