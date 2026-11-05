/**
 * What the More menu tells people to say for the things that are not in it. tests/unit/moreMenuAsks.test.ts checks that each one
 * still reaches its panel, so this line cannot promise something the app no longer understands.
 */
export const MORE_MENU_ASKS = [
  'show my history',
  'show my memory',
  'show parked thoughts',
  'show my reminders',
  'have Stay call me',
] as const;
