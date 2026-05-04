import type { NextFunction, Request, Response } from 'express';
import { Logger } from '@nestjs/common';

const logger = new Logger('HTTP');

// Routes hit by uptime probes / liveness — too noisy to log every minute.
const SKIP_PATHS = new Set<string>(['/health']);

type AuthedUser = { name?: string; email?: string };

function actorLabel(req: Request): string {
  const user = (req as Request & { user?: AuthedUser }).user;
  if (!user) return 'anon';
  if (user.name) return user.name.split(' ')[0] ?? 'anon';
  if (user.email) return user.email.split('@')[0] ?? 'anon';
  return 'anon';
}

/**
 * Log every HTTP response as `actor METHOD /path STATUS Xms`. Tagged WARN for
 * 4xx, ERROR for 5xx. Skips uptime probes so the log isn't drowned by /health.
 * The actor is the authenticated user's first name (or email local-part for
 * old tokens that predate `name` in the JWT), or `anon` for public routes.
 */
export function requestTiming(req: Request, res: Response, next: NextFunction): void {
  if (SKIP_PATHS.has(req.path) || req.method === 'OPTIONS') return next();
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1_000_000;
    const line = `${actorLabel(req)} - ${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`;
    if (res.statusCode >= 500) logger.error(line);
    else if (res.statusCode >= 400) logger.warn(line);
    else logger.log(line);
  });
  next();
}
