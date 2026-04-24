import type { NextFunction, Request, Response } from 'express';
import { Logger } from '@nestjs/common';

const logger = new Logger('HTTP');

// Routes hit by uptime probes / liveness — too noisy to log every minute.
const SKIP_PATHS = new Set<string>(['/health']);

/**
 * Log every HTTP response as `METHOD /path STATUS Xms`. Tagged WARN for 4xx,
 * ERROR for 5xx. Skips uptime probes so the log isn't drowned by /health.
 */
export function requestTiming(req: Request, res: Response, next: NextFunction): void {
  if (SKIP_PATHS.has(req.path)) return next();
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1_000_000;
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`;
    if (res.statusCode >= 500) logger.error(line);
    else if (res.statusCode >= 400) logger.warn(line);
    else logger.log(line);
  });
  next();
}
