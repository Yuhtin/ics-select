import { z } from 'zod';

export const OPPORTUNITY_TYPES = [
  'INTERNSHIP', 'SUMMER', 'FULL_TIME', 'CONTRACT', 'FREELANCE', 'EVENT', 'MENTORSHIP', 'OTHER',
] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

export const OPPORTUNITY_TYPE_LABELS: Record<OpportunityType, string> = {
  INTERNSHIP: 'Internship',
  SUMMER: 'Summer',
  FULL_TIME: 'Full-time',
  CONTRACT: 'Contract · PJ',
  FREELANCE: 'Freelance',
  EVENT: 'Event',
  MENTORSHIP: 'Mentorship',
  OTHER: 'Other',
};

export const WORK_MODES = ['REMOTE', 'HYBRID', 'ONSITE'] as const;
export type WorkMode = (typeof WORK_MODES)[number];

export const OPPORTUNITY_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

const httpUrl = z
  .string()
  .url()
  .refine((u) => /^https?:\/\//i.test(u), 'must be an http(s) URL');

export const OpportunityLinkSchema = z.object({
  label: z.string().min(1).max(80),
  url: httpUrl,
});

export const OpportunityContactSchema = z.object({
  name: z.string().min(1).max(80),
  role: z.string().max(80).optional(),
  whatsapp: z.string().max(40).refine((s) => s.replace(/\D/g, '').length >= 8, 'at least 8 digits').optional(),
  email: z.string().email().optional(),
  linkedin: httpUrl.optional(),
});

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'invalid calendar date');

export const OpportunityInputSchema = z.object({
  title: z.string().min(1).max(160),
  type: z.enum(OPPORTUNITY_TYPES),
  companyName: z.string().min(1).max(120),
  description: z.string().max(5000).nullable().optional(),
  location: z.string().max(120).nullable().optional(),
  workMode: z.enum(WORK_MODES).nullable().optional(),
  compensation: z.string().max(120).nullable().optional(),
  deadline: dateOnly.nullable().optional(),
  eventDate: dateOnly.nullable().optional(),
  links: z.array(OpportunityLinkSchema).max(10).default([]),
  contacts: z.array(OpportunityContactSchema).max(10).default([]),
  status: z.enum(OPPORTUNITY_STATUSES).optional(),
});
export type OpportunityInput = z.infer<typeof OpportunityInputSchema>;

/** 'YYYY-MM-DD' in America/Sao_Paulo. */
export function brtToday(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(now);
}

type DateLike = Date | string | null;
const datePart = (d: DateLike): string | null =>
  d == null ? null : (typeof d === 'string' ? d : d.toISOString()).slice(0, 10);

/** Dates are stored at T00:00:00Z, so the UTC date part is the calendar date. */
export function closingDate(o: { deadline: DateLike; eventDate: DateLike }): string | null {
  return datePart(o.deadline) ?? datePart(o.eventDate);
}

export function isOpportunityOpen(
  o: { status: string; deadline: DateLike; eventDate: DateLike },
  now: Date,
): boolean {
  if (o.status !== 'PUBLISHED') return false;
  const c = closingDate(o);
  return c === null || c >= brtToday(now);
}

export function daysUntilClose(
  o: { deadline: DateLike; eventDate: DateLike },
  now: Date,
): number | null {
  const c = closingDate(o);
  if (c === null) return null;
  return Math.round((Date.parse(c) - Date.parse(brtToday(now))) / 86_400_000);
}

export function whatsappHref(raw: string): string {
  return `https://wa.me/${raw.replace(/\D/g, '')}`;
}
