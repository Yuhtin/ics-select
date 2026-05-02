import { SetMetadata } from '@nestjs/common';
import type { UserEventType } from '@ics-select/prisma';

export const LOG_EVENT_KEY = 'log-event';

export type MetaExtractor = (args: {
  request: unknown;
  result: unknown;
  body: unknown;
}) => Record<string, unknown> | undefined;

export type LogEventConfig = {
  type: UserEventType;
  meta?: MetaExtractor;
};

export const LogEvent = (type: UserEventType, meta?: MetaExtractor) =>
  SetMetadata(LOG_EVENT_KEY, { type, meta } satisfies LogEventConfig);
