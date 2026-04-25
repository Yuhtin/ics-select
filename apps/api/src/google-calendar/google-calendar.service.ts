import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  private readonly logger = new Logger(GoogleCalendarService.name);
  private readonly authCache = new Map<string, CachedAuth>();
  // Deduplicates concurrent clientFor(userId) calls so N parallel Calendar
  // requests don't each run `findUnique` + AES decrypt + spawn a distinct
  // OAuth2Client (each of which would then race to refresh the same token
  // against Google's OAuth endpoint).
  private readonly inflightAuth = new Map<string, Promise<calendar_v3.Calendar>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly aes: AesGcmService,
    private readonly config: ConfigService,
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
    // private extended properties are stamped on every ICS-owned event so a
    // housekeeping job can list/clean orphaned events without depending on
    // our DB rows. Google indexes these and they survive description edits.
    const extendedProperties = input.icsId
      ? {
          private: {
            icsPlanId: input.icsId.planId,
            icsItemId: input.icsId.itemId,
          },
        }
      : undefined;
    const client = await this.clientFor(userId);
    const res = await client.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: input.summary,
        description,
        start: { dateTime: input.start.toISOString() },
        end: { dateTime: input.end.toISOString() },
        extendedProperties,
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

  private async clientFor(userId: string): Promise<calendar_v3.Calendar> {
    const cached = this.authCache.get(userId);
    if (cached && cached.expiresAt > Date.now() + AUTH_TTL_SAFETY_MS) {
      return cached.client;
    }

    const inflight = this.inflightAuth.get(userId);
    if (inflight) return inflight;

    const promise = this.buildClient(userId).finally(() => {
      this.inflightAuth.delete(userId);
    });
    this.inflightAuth.set(userId, promise);
    return promise;
  }

  private async buildClient(userId: string): Promise<calendar_v3.Calendar> {
    const row = await this.prisma.googleAccount.findUnique({ where: { userId } });
    if (!row) throw new NotFoundException('GoogleAccount for user not found');
    const accessToken = this.aes.decrypt(row.accessTokenEnc);
    const refreshToken = row.refreshTokenEnc ? this.aes.decrypt(row.refreshTokenEnc) : null;

    // OAuth2 must be built with client credentials so googleapis can call
    // the token endpoint when the access_token expires. Without clientId +
    // clientSecret, every refresh returns `invalid_request` and the whole
    // Calendar surface goes dark for that member.
    const oauth2 = new google.auth.OAuth2({
      clientId: this.config.getOrThrow<string>('GOOGLE_OAUTH_CLIENT_ID'),
      clientSecret: this.config.getOrThrow<string>('GOOGLE_OAUTH_CLIENT_SECRET'),
    });
    oauth2.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken ?? undefined,
      expiry_date: row.expiresAt.getTime(),
    });

    // Persist refreshed tokens back to the DB. googleapis fires this event
    // whenever it rotates the access_token (or mints a new refresh_token).
    oauth2.on('tokens', (tokens) => {
      void this.persistRefreshedTokens(userId, tokens).catch((err) => {
        this.logger.warn(
          `persistRefreshedTokens failed · user=${userId} · ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      });
    });

    const client = this.clientFactory(oauth2);
    this.authCache.set(userId, { client, expiresAt: row.expiresAt.getTime() });
    return client;
  }

  private async persistRefreshedTokens(
    userId: string,
    tokens: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null },
  ): Promise<void> {
    if (!tokens.access_token && !tokens.refresh_token) return;

    const data: {
      accessTokenEnc?: string;
      refreshTokenEnc?: string;
      expiresAt?: Date;
    } = {};

    if (tokens.access_token) {
      data.accessTokenEnc = this.aes.encrypt(tokens.access_token);
    }
    if (tokens.refresh_token) {
      data.refreshTokenEnc = this.aes.encrypt(tokens.refresh_token);
    }
    if (tokens.expiry_date) {
      data.expiresAt = new Date(tokens.expiry_date);
    }

    if (Object.keys(data).length === 0) return;

    await this.prisma.googleAccount.update({ where: { userId }, data });

    // Keep the auth cache in sync with the new expiry so cached clients
    // are considered fresh for the full lifetime of the rotated token.
    const cached = this.authCache.get(userId);
    if (cached && data.expiresAt) {
      this.authCache.set(userId, {
        client: cached.client,
        expiresAt: data.expiresAt.getTime(),
      });
    }
  }
}

function defaultClientFactory(auth: unknown): calendar_v3.Calendar {
  return google.calendar({ version: 'v3', auth: auth as any });
}
