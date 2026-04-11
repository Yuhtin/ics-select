import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { google, type calendar_v3 } from 'googleapis';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { AesGcmService } from '../common/crypto/aes-gcm.service.js';

export type CreateEventInput = {
  summary: string;
  description: string;
  start: Date;
  end: Date;
};

export type FreeBusyBlock = { start: Date; end: Date };

type ClientFactory = (auth: unknown) => calendar_v3.Calendar;

@Injectable()
export class GoogleCalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aes: AesGcmService,
    @Optional() private readonly clientFactory: ClientFactory = defaultClientFactory,
  ) {}

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

  async createEvent(userId: string, input: CreateEventInput): Promise<string> {
    const client = await this.clientFor(userId);
    const res = await client.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: input.summary,
        description: input.description,
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

  async deleteEvent(userId: string, eventId: string): Promise<void> {
    const client = await this.clientFor(userId);
    await client.events.delete({ calendarId: 'primary', eventId });
  }

  private async clientFor(userId: string): Promise<calendar_v3.Calendar> {
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
    return this.clientFactory(oauth2);
  }
}

function defaultClientFactory(auth: unknown): calendar_v3.Calendar {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return google.calendar({ version: 'v3', auth: auth as any });
}
