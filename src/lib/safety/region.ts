/**
 * Crisis contacts that suit where the person is. Where they are comes from the browser's time zone first (a UK person
 * with an American-English browser is still in the UK), then the language's country. Unknown means "show every region".
 * Numbers checked 2 Nov 2026 against nhs.uk pages, samaritans.org, giveusashout.org, 988.ca and findahelpline.com
 * (sources in docs/audit/SOURCES.md). Re-check before each release.
 */
export type CrisisRegion = 'GB' | 'US' | 'CA' | 'OTHER';

export const FIND_A_HELPLINE_URL = 'https://findahelpline.com';

export interface CrisisResource {
  name: string;
  contact: string;
  href: string;
  detail: string;
  regions: readonly CrisisRegion[];
}

export const CRISIS_RESOURCES: readonly CrisisResource[] = [
  {
    name: 'Emergency services (UK)',
    contact: '999',
    href: 'tel:999',
    detail: 'Call 999 or go to your nearest A&E if you or someone else is in immediate danger.',
    regions: ['GB'],
  },
  {
    name: 'NHS urgent mental health help (UK)',
    contact: '111',
    href: 'tel:111',
    detail: 'Call 111 and choose the mental health option (option 2 in most of England) for urgent NHS mental health advice.',
    regions: ['GB'],
  },
  {
    name: 'Samaritans (UK, 24/7, free)',
    contact: '116 123',
    href: 'tel:116123',
    detail: 'Free, confidential listening support at any hour.',
    regions: ['GB'],
  },
  {
    name: 'Shout crisis text line (UK)',
    contact: 'Text SHOUT to 85258',
    href: 'sms:85258',
    detail: 'Free 24/7 text support across the UK.',
    regions: ['GB'],
  },
  {
    name: '988 Suicide & Crisis Lifeline (US)',
    contact: '988',
    href: 'tel:988',
    detail: 'Call or text 988, free and confidential, any hour. Call 911 if someone is in immediate danger.',
    regions: ['US'],
  },
  {
    name: '9-8-8 Suicide Crisis Helpline (Canada)',
    contact: '988',
    href: 'tel:988',
    detail: 'Call or text 988, free, in English or French, any hour. Call 911 if someone is in immediate danger.',
    regions: ['CA'],
  },
  {
    name: 'Anywhere else',
    contact: 'findahelpline.com',
    href: FIND_A_HELPLINE_URL,
    detail: 'Find a free helpline in your country. In an emergency, call your local emergency number.',
    regions: ['OTHER'],
  },
];

const UK_ZONES = /^(Europe\/(London|Belfast|Isle_of_Man|Jersey|Guernsey)|GB|Etc\/GB)$/;
const CA_ZONES = /^America\/(Toronto|Vancouver|Edmonton|Winnipeg|Halifax|St_Johns|Regina|Moncton|Glace_Bay|Goose_Bay|Whitehorse|Iqaluit|Yellowknife|Rankin_Inlet|Cambridge_Bay|Inuvik|Dawson|Dawson_Creek|Fort_Nelson|Swift_Current|Thunder_Bay|Nipigon|Rainy_River|Atikokan|Blanc-Sablon|Creston|Resolute|Pangnirtung)$/;
const US_ZONES = /^(America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Juneau|Sitka|Nome|Adak|Metlakatla|Yakutat|Menominee|Indiana\/.+|Kentucky\/.+|North_Dakota\/.+)|Pacific\/Honolulu|US\/.+)$/;

/** Region from a time zone name and a language tag such as "en-GB". Either can be missing. */
export function regionFromLocale(locale?: string, timeZone?: string): CrisisRegion {
  if (timeZone) {
    if (UK_ZONES.test(timeZone)) return 'GB';
    if (CA_ZONES.test(timeZone)) return 'CA';
    if (US_ZONES.test(timeZone)) return 'US';
    return 'OTHER';
  }
  const country = /[-_]([A-Za-z]{2})(?:[-_]|$)/.exec(locale ?? '')?.[1]?.toUpperCase();
  if (country === 'GB' || country === 'UK') return 'GB';
  if (country === 'US') return 'US';
  if (country === 'CA') return 'CA';
  return 'OTHER';
}

/** The browser's best guess; null on the server, where no region is known. */
export function detectRegion(): CrisisRegion | null {
  if (typeof window === 'undefined') return null;
  let timeZone: string | undefined;
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    timeZone = undefined;
  }
  return regionFromLocale(typeof navigator === 'undefined' ? undefined : navigator.language, timeZone);
}

/** Every contact, the person's own region first. A null region means we do not know, so the order is UK, US, Canada, elsewhere. */
export function crisisResourcesFor(region: CrisisRegion | null): CrisisResource[] {
  if (!region) return [...CRISIS_RESOURCES];
  const mine = CRISIS_RESOURCES.filter((r) => r.regions.includes(region));
  const rest = CRISIS_RESOURCES.filter((r) => !r.regions.includes(region));
  return [...mine, ...rest];
}

const LEAD =
  'Coaching has paused because what you shared sounds like you may be in crisis or unsafe. Stay is not a crisis service. Please reach out for immediate human support right now: ';

/** What Stay says and shows. A null region lists every country, because a server does not know where the person is. */
export function crisisMessageFor(region: CrisisRegion | null): string {
  switch (region) {
    case 'GB':
      return `${LEAD}call 999 in an emergency, call 111 and choose the mental health option for urgent NHS help, or call Samaritans free on 116 123.`;
    case 'US':
      return `${LEAD}call or text 988, the Suicide and Crisis Lifeline, or call 911 if you are in immediate danger.`;
    case 'CA':
      return `${LEAD}call or text 988, the Suicide Crisis Helpline, or call 911 if you are in immediate danger.`;
    case 'OTHER':
      return `${LEAD}call your local emergency number, or find a free helpline in your country at findahelpline.com.`;
    default:
      return `${LEAD}in the UK call 999, or 111 and choose the mental health option, or Samaritans on 116 123. In the US or Canada call or text 988. Anywhere else, call your local emergency number or visit findahelpline.com.`;
  }
}
