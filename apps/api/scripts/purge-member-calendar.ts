/**
 * Delete the study events ICS created on a member's Google Calendar.
 *
 * Why: when a member leaves the program mid-cycle their published plans keep
 * living on their personal calendar. `CyclesService.removeMember` only drops
 * the CycleMembership row — nothing cleans the calendar. This script does.
 *
 * Scope is deliberately narrow:
 *   - Only events whose description carries the `ICS ID: <planId>/<itemId>`
 *     marker AND whose planId belongs to a WeeklyPlan owned by this member.
 *     An event the member created themselves is never touched.
 *   - Only events starting from NOW. Past events are the member's study
 *     history; deleting them rewrites a record nobody benefits from erasing.
 *
 * Must run BEFORE revoking the member's access — it needs their GoogleAccount
 * tokens to reach the calendar at all.
 *
 * Defaults to a dry-run. Pass `--apply` to actually delete.
 *
 * Run from repo root:
 *   pnpm --filter @ics-select/api purge:calendar -- --email pedro@x.com
 *   pnpm --filter @ics-select/api purge:calendar -- --email pedro@x.com --apply
 */
import { createDecipheriv } from 'crypto';
import { PrismaClient } from '@ics-select/prisma';
import { google } from 'googleapis';

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

/** Mirrors AesGcmService.decrypt — the script can't reach Nest's DI container. */
function decrypt(payload: string, key: Buffer): string {
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < IV_LENGTH + TAG_LENGTH) throw new Error('ciphertext too short');
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

/** Mirrors extractIcsId from src/common/ics-id. */
const ICS_ID_PATTERN = /ICS ID:\s*([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)/;
function extractIcsId(description: string | null | undefined) {
  if (!description) return null;
  const m = description.match(ICS_ID_PATTERN);
  return m ? { planId: m[1]!, itemId: m[2]! } : null;
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set — source apps/api/.env.production first`);
  return v;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const email = argValue('--email');
  if (!email) {
    throw new Error('Missing --email <address>');
  }
  // How far ahead to look. Plans never extend beyond the cycle, but a generous
  // window costs one extra page and removes the "did we miss one?" question.
  const horizonDays = Number(argValue('--horizon-days') ?? 400);

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true },
    });
    if (!user) throw new Error(`No user with email ${email}`);

    const plans = await prisma.weeklyPlan.findMany({
      where: { userId: user.id },
      select: { id: true, weekStart: true, status: true },
    });
    const planIds = new Set(plans.map((p) => p.id));
    console.log(`\nMember: ${user.name} <${user.email}>  (id ${user.id})`);
    console.log(`WeeklyPlans owned: ${plans.length}`);
    if (planIds.size === 0) {
      console.log('No plans — nothing on the calendar could belong to ICS. Done.\n');
      return;
    }

    const account = await prisma.googleAccount.findUnique({
      where: { userId: user.id },
      select: { accessTokenEnc: true, refreshTokenEnc: true, expiresAt: true },
    });
    if (!account) {
      throw new Error(
        'No GoogleAccount row — their tokens are already gone, the calendar is unreachable.',
      );
    }
    if (!account.refreshTokenEnc && account.expiresAt.getTime() < Date.now()) {
      throw new Error(
        'Access token expired and no refresh token stored — cannot reach this calendar. ' +
          'The member would have to log in again first.',
      );
    }

    const key = Buffer.from(envOrThrow('ENCRYPTION_KEY'), 'base64');
    const oauth2 = new google.auth.OAuth2({
      clientId: envOrThrow('GOOGLE_OAUTH_CLIENT_ID'),
      clientSecret: envOrThrow('GOOGLE_OAUTH_CLIENT_SECRET'),
    });
    oauth2.setCredentials({
      access_token: decrypt(account.accessTokenEnc, key),
      refresh_token: account.refreshTokenEnc
        ? decrypt(account.refreshTokenEnc, key)
        : undefined,
      expiry_date: account.expiresAt.getTime(),
    });
    const calendar = google.calendar({ version: 'v3', auth: oauth2 });

    const timeMin = new Date();
    const timeMax = new Date(timeMin.getTime() + horizonDays * 24 * 60 * 60 * 1000);
    console.log(
      `Window: ${timeMin.toISOString()} → ${timeMax.toISOString()} (${horizonDays}d, future only)\n`,
    );

    // listEventsInRange in the service caps at 100 with no pagination; a purge
    // cannot afford to silently stop at page one, so we page explicitly.
    type Hit = { id: string; summary: string; start: string; planId: string };
    const hits: Hit[] = [];
    let scanned = 0;
    let pageToken: string | undefined;
    do {
      const res = await calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 250,
        pageToken,
        fields: 'nextPageToken,items(id,summary,description,start)',
      });
      for (const e of res.data.items ?? []) {
        scanned++;
        if (!e.id) continue;
        const ics = extractIcsId(e.description);
        if (!ics || !planIds.has(ics.planId)) continue;
        hits.push({
          id: e.id,
          summary: e.summary ?? '(sem título)',
          start: e.start?.dateTime ?? e.start?.date ?? '?',
          planId: ics.planId,
        });
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);

    console.log(`Scanned ${scanned} future event(s); ${hits.length} belong to ICS plans.\n`);
    for (const h of hits) {
      console.log(`  ${h.start.slice(0, 16).padEnd(18)} ${h.summary.slice(0, 58)}`);
    }
    if (hits.length === 0) {
      console.log('Nothing to delete.\n');
      return;
    }

    if (!apply) {
      console.log(`\nDry-run. Re-run with --apply to delete these ${hits.length} event(s).\n`);
      return;
    }

    let deleted = 0;
    const failures: Array<{ id: string; reason: string }> = [];
    for (const h of hits) {
      try {
        await calendar.events.delete({ calendarId: 'primary', eventId: h.id });
        deleted++;
      } catch (err) {
        // 410 Gone means the member already deleted it — the desired end state.
        const status = (err as { code?: number }).code;
        if (status === 410 || status === 404) {
          deleted++;
          continue;
        }
        failures.push({ id: h.id, reason: err instanceof Error ? err.message : String(err) });
      }
    }
    console.log(`\nDeleted ${deleted}/${hits.length} event(s).`);
    if (failures.length > 0) {
      console.log(`${failures.length} failed:`);
      for (const f of failures) console.log(`  ${f.id}: ${f.reason}`);
      process.exitCode = 1;
    }
    console.log('');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
