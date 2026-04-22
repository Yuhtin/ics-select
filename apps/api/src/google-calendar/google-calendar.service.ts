import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { google, type calendar_v3 } from 'googleapis';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { AesGcmService } from '../common/crypto/aes-gcm.service.js';
import { embedIcsId } from '../common/ics-id/ics-id.js';

export type CreateEventInput = {
  summary: string;
  description: string;
  start: Date;
  end: Date;
  icsId?: { planId: string; itemId: string };
};

export type FreeBusyBlock = { start: Date; end: Date };

type ClientFactory = (auth: unknown) => calendar_v3.Calendar;
type CachedAuth = { client: calendar_v3.Calendar; expiresAt: number };
const AUTH_TTL_SAFETY_MS = 60_000; // rebuild 60s before Google thinks the token expires

@Injectable()
export class GoogleCalendarService {
  private readonly authCache = new Map<string, CachedAuth>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly aes: AesGcmService,
    @Optional() private readonly clientFactory: ClientFactory = defaultClientFactory,
  ) {}

  invalidateAuth(userId: string): void {
    this.authCache.delete(userId);
  }

  async getFreeBusy(userId: string, timeMin: Date, timeMax: Date): Promise<FreeBusyBlock[]> {
    const client = await this.clientFor(userId);
    const res = await client.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: 'primary' }],
      },
    });
    const busy = res.data.calendars?.primary?.busy ?? [];
    return busy
      .filter((b) => b.start && b.end)
      .map((b) => ({ start: new Date(b.start!), end: new Date(b.end!) }));
  }

  async listEventsInRange(
    userId: string,
    timeMin: Date,
    timeMax: Date,
    opts: { includeAllDay?: boolean } = {},
  ): Promise<Array<{
    id: string;
    summary: string;
    description: string;
    start: Date;
    end: Date;
    allDay: boolean;
    location?: string;
    htmlLink?: string;
    meetLink?: string;
  }>> {
    const client = await this.clientFor(userId);
    const res = await client.events.list({
      calendarId: 'primary',
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100,
      fields: 'items(id,summary,description,start,end,location,htmlLink,conferenceData/entryPoints)',
    });
    const events = res.data.items ?? [];
    const includeAllDay = opts.includeAllDay === true;
    return events
      .filter((e) => {
        if (!e.id) return false;
        const hasDateTime = e.start?.dateTime && e.end?.dateTime;
        const hasDateOnly = e.start?.date && e.end?.date;
        if (hasDateTime) return true;
        if (hasDateOnly) return includeAllDay;
        return false;
      })
      .map((e) => {
        const allDay = !e.start?.dateTime;
        const start = allDay
          ? new Date(e.start!.date + 'T00:00:00')
          : new Date(e.start!.dateTime!);
        const end = allDay
          ? new Date(e.end!.date + 'T00:00:00')
          : new Date(e.end!.dateTime!);
        const meetLink = (e.conferenceData?.entryPoints ?? []).find(
          (p) => p.entryPointType === 'video',
        )?.uri;
        return {
          id: e.id!,
          summary: e.summary ?? '',
          description: e.description ?? '',
          start,
          end,
          allDay,
          location: e.location ?? undefined,
          htmlLink: e.htmlLink ?? undefined,
          meetLink: meetLink ?? undefined,
        };
      });
  }

  async createEvent(userId: string, input: CreateEventInput): Promise<string> {
    const description = input.icsId
      ? embedIcsId(input.description, input.icsId)
      : input.description;
    const client = await this.clientFor(userId);
    const res = await client.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: input.summary,
        description,
        start: { dateTime: input.start.toISOString() },
        end: { dateTime: input.end.toISOString() },
      },
    });
    const id = res.data.id;
    if (!id) throw new Error('Google Calendar did not return an event id');
    return id;
  }

  async updateEvent(userId: string, eventId: string, input: CreateEventInput): Promise<void> {
    const client = await this.clientFor(userId);
    await client.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody: {
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.start.toISOString() },
        end: { dateTime: input.end.toISOString() },
      },
    });
  }

  async rescheduleEvent(
    userId: string,
    eventId: string,
    start: Date,
    end: Date,
  ): Promise<void> {
    const client = await this.clientFor(userId);
    await client.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody: {
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      },
    });
  }

  async deleteEvent(userId: string, eventId: string): Promise<void> {
    const client = await this.clientFor(userId);
    await client.events.delete({ calendarId: 'primary', eventId });
  }

  async findEventIdByIcsId(
    userId: string,
    planId: string,
    itemId: string,
    range: { start: Date; end: Date },
  ): Promise<string | null> {
    const client = await this.clientFor(userId);
    const res = await client.events.list({
      calendarId: 'primary',
      timeMin: range.start.toISOString(),
      timeMax: range.end.toISOString(),
      singleEvents: true,
      maxResults: 250,
    });
    const marker = `ICS ID: ${planId}/${itemId}`;
    const hit = (res.data.items ?? []).find(
      (e) => typeof e.description === 'string' && e.description.includes(marker),
    );
    return hit?.id ?? null;
  }

  private async clientFor(userId: string): Promise<calendar_v3.Calendar> {
    const cached = this.authCache.get(userId);
    if (cached && cached.expiresAt > Date.now() + AUTH_TTL_SAFETY_MS) {
      return cached.client;
    }

    const row = await this.prisma.googleAccount.findUnique({ where: { userId } });
    if (!row) throw new NotFoundException('GoogleAccount for user not found');
    const accessToken = this.aes.decrypt(row.accessTokenEnc);
    const refreshToken = row.refreshTokenEnc ? this.aes.decrypt(row.refreshTokenEnc) : null;
    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken ?? undefined,
      expiry_date: row.expiresAt.getTime(),
    });
    const client = this.clientFactory(oauth2);
    this.authCache.set(userId, { client, expiresAt: row.expiresAt.getTime() });
    return client;
  }
}

function defaultClientFactory(auth: unknown): calendar_v3.Calendar {
  return google.calendar({ version: 'v3', auth: auth as any });
}
