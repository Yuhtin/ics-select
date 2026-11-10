import { describe, it, expect } from 'vitest';
import {
  OpportunityInputSchema,
  OPPORTUNITY_TYPE_LABELS,
  OpportunityLinkSchema,
  closingDate,
  daysUntilClose,
  isOpportunityOpen,
  whatsappHref,
} from './opportunity';

describe('opportunity', () => {
  it('accepts null on clearable optional text fields (PATCH clears them)', () => {
    const r = OpportunityInputSchema.partial().parse({ description: null, location: null, workMode: null, compensation: null });
    expect(r).toMatchObject({ description: null, location: null, workMode: null, compensation: null });
  });
  it('stays open on the deadline day late at night BRT', () => {
    const o = { status: 'PUBLISHED', deadline: new Date('2026-11-13T00:00:00Z'), eventDate: null };
    expect(isOpportunityOpen(o, new Date('2026-11-14T02:30:00Z'))).toBe(true);
    expect(isOpportunityOpen(o, new Date('2026-11-14T03:00:00Z'))).toBe(false);
  });
  it('falls back to eventDate when there is no deadline', () => {
    expect(closingDate({ deadline: null, eventDate: '2026-11-16' })).toBe('2026-11-16');
  });
  it('no closing date means open while PUBLISHED; DRAFT/ARCHIVED never open', () => {
    const now = new Date('2026-11-10T12:00:00Z');
    expect(isOpportunityOpen({ status: 'PUBLISHED', deadline: null, eventDate: null }, now)).toBe(true);
    expect(isOpportunityOpen({ status: 'DRAFT', deadline: null, eventDate: null }, now)).toBe(false);
    expect(isOpportunityOpen({ status: 'ARCHIVED', deadline: null, eventDate: null }, now)).toBe(false);
  });
  it('daysUntilClose counts BRT calendar days', () => {
    expect(daysUntilClose({ deadline: '2026-11-13', eventDate: null }, new Date('2026-11-10T12:00:00Z'))).toBe(3);
  });
  it('whatsappHref strips formatting', () => {
    expect(whatsappHref('+55 (11) 98765-4321')).toBe('https://wa.me/5511987654321');
  });
  it('rejects non-http links and accepts https', () => {
    expect(OpportunityLinkSchema.safeParse({ label: 'x', url: 'javascript:alert(1)' }).success).toBe(false);
    expect(OpportunityLinkSchema.safeParse({ label: 'x', url: 'www.x.com' }).success).toBe(false);
    expect(OpportunityLinkSchema.safeParse({ label: 'x', url: 'https://stripe.com/jobs' }).success).toBe(true);
  });
  it('requires title, type, companyName and defaults links/contacts to []', () => {
    const r = OpportunityInputSchema.parse({ title: 'T', type: 'SUMMER', companyName: 'Stripe' });
    expect(r.links).toEqual([]);
    expect(r.contacts).toEqual([]);
    expect(OpportunityInputSchema.safeParse({ title: 'T', type: 'SUMMER' }).success).toBe(false);
    expect(
      OpportunityInputSchema.safeParse({ title: 'T', type: 'SUMMER', companyName: 'S', deadline: '13/11/2026' }).success,
    ).toBe(false);
  });
  it('pins SUMMER and CONTRACT labels', () => {
    expect(OPPORTUNITY_TYPE_LABELS.SUMMER).toBe('Summer');
    expect(OPPORTUNITY_TYPE_LABELS.CONTRACT).toBe('Contract · PJ');
  });
  it('rejects impossible calendar dates', () => {
    const base = { title: 'T', type: 'SUMMER', companyName: 'S' };
    expect(OpportunityInputSchema.safeParse({ ...base, deadline: '2026-02-30' }).success).toBe(false);
    expect(OpportunityInputSchema.safeParse({ ...base, eventDate: '2026-13-45' }).success).toBe(false);
    expect(OpportunityInputSchema.safeParse({ ...base, deadline: '2026-11-13' }).success).toBe(true);
  });
});
