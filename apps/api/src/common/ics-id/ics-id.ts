export const ICS_ID_PREFIX = 'ICS ID: ';

const PATTERN = /ICS ID:\s*([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)/;

export function embedIcsId(
  originalBody: string,
  ids: { planId: string; itemId: string },
): string {
  const tail = `\n\n${ICS_ID_PREFIX}${ids.planId}/${ids.itemId}`;
  return `${originalBody.trimEnd()}${tail}`;
}

export function extractIcsId(
  description: string | null | undefined,
): { planId: string; itemId: string } | null {
  if (!description) return null;
  const match = description.match(PATTERN);
  if (!match) return null;
  return { planId: match[1], itemId: match[2] };
}
