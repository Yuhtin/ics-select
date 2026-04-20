import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import type { ItemOutcome, ItemFormat } from '@ics-select/prisma';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { GoogleCalendarService } from '../../google-calendar/google-calendar.service.js';
import { extractIcsId } from '../../common/ics-id/ics-id.js';

const DEFAULT_TZ = 'America/Sao_Paulo';

export type CalendarEvent = {
  id: string;
  kind: 'ICS' | 'EXTERNAL';
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  meetLink?: string;
  htmlLink?: string;
  ics?: {
    planId: string;
    itemId: string;
    url: string | null;
    format: ItemFormat;
    topic: { slug: string; label: string } | null;
    outcome: ItemOutcome;
  };
};

export type GetWeekResponse = {
  weekStart: string;
  weekEnd: string;
  timezone: string;
  hasGoogleConnection: boolean;
  events: CalendarEvent[];
};

function isGoogleAuthFailure(err: unknown): boolean {
  const msg = (err as { message?: string })?.message ?? String(err);
  return (
    msg.includes('invalid_grant') ||
    msg.includes('Invalid Credentials') ||
    msg.includes('No refresh token')
  );
}

@Injectable()
export class MeCalendarService {
  private readonly logger = new Logger(MeCalendarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gcal: GoogleCalendarService,
  ) {}

  async getWeek(userId: string, weekStart: Date): Promise<GetWeekResponse> {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const availability = await this.prisma.memberAvailability.findUnique({
      where: { userId },
    });
    const timezone = availability?.timezone ?? DEFAULT_TZ;

    const googleAccount = await this.prisma.googleAccount.findUnique({
      where: { userId },
    });

    const base = {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      timezone,
    };

    if (!googleAccount) {
      return { ...base, hasGoogleConnection: false, events: [] };
    }

    let raw: Awaited<ReturnType<typeof this.gcal.listEventsInRange>>;
    try {
      raw = await this.gcal.listEventsInRange(userId, weekStart, weekEnd, {
        includeAllDay: true,
      });
    } catch (err) {
      if (isGoogleAuthFailure(err)) {
        this.logger.warn(
          `calendar: google auth failed for user ${userId}: ${(err as Error).message}`,
        );
        return { ...base, hasGoogleConnection: false, events: [] };
      }
      throw err;
    }

    // Extract itemIds from events that have an ICS ID marker.
    const itemIds: string[] = [];
    const icsByEventId = new Map<string, { planId: string; itemId: string }>();
    for (const e of raw) {
      const parsed = extractIcsId(e.description);
      if (parsed) {
        itemIds.push(parsed.itemId);
        icsByEventId.set(e.id, parsed);
      }
    }

    // Batch-fetch plan items for enrichment.
    const items =
      itemIds.length > 0
        ? await this.prisma.weeklyPlanItem.findMany({
            where: { id: { in: itemIds } },
            select: {
              id: true,
              weeklyPlanId: true,
              outcome: true,
              libraryItem: {
                select: {
                  url: true,
                  format: true,
                  topics: {
                    select: {
                      isPrimary: true,
                      topic: { select: { slug: true, label: true } },
                    },
                  },
                },
              },
            },
          })
        : [];

    const itemMap = new Map(items.map((it) => [it.id, it] as const));

    const events: CalendarEvent[] = raw.map((e) => {
      const ids = icsByEventId.get(e.id);
      const matched = ids ? itemMap.get(ids.itemId) : undefined;

      if (ids && matched) {
        const primary = matched.libraryItem.topics.find((t) => t.isPrimary);
        return {
          id: e.id,
          kind: 'ICS',
          title: e.summary,
          start: e.start.toISOString(),
          end: e.end.toISOString(),
          allDay: e.allDay,
          location: e.location,
          meetLink: e.meetLink,
          htmlLink: e.htmlLink,
          ics: {
            planId: ids.planId,
            itemId: ids.itemId,
            url: matched.libraryItem.url ?? null,
            format: matched.libraryItem.format,
            topic: primary
              ? { slug: primary.topic.slug, label: primary.topic.label }
              : null,
            outcome: matched.outcome,
          },
        };
      }

      return {
        id: e.id,
        kind: 'EXTERNAL',
        title: e.summary,
        start: e.start.toISOString(),
        end: e.end.toISOString(),
        allDay: e.allDay,
        location: e.location,
        meetLink: e.meetLink,
        htmlLink: e.htmlLink,
      };
    });

    return { ...base, hasGoogleConnection: true, events };
  }

  async reschedule(
    userId: string,
    eventId: string,
    start: Date,
    end: Date,
  ): Promise<void> {
    // Look up the event in a 48h window around the new time to verify it's ICS.
    // Using listEventsInRange keeps us on one auth path; googleapis lacks a
    // cheap "get single event by id" without another service method.
    const windowStart = new Date(start.getTime() - 24 * 60 * 60 * 1000);
    const windowEnd = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    const events = await this.gcal.listEventsInRange(userId, windowStart, windowEnd, {
      includeAllDay: true,
    });
    const target = events.find((e) => e.id === eventId);
    if (!target || !extractIcsId(target.description)) {
      throw new ForbiddenException('Cannot reschedule non-ICS events');
    }
    await this.gcal.rescheduleEvent(userId, eventId, start, end);
  }
}
