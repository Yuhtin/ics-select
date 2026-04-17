export const TRACKS = [
  'BIG_TECH',
  'CONSULTING_TECH',
  'COMPETITIVE_PROGRAMMING',
  'STARTUP',
  'OTHER',
] as const;

export type Track = (typeof TRACKS)[number];
