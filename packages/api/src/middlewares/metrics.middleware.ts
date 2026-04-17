import { Request, Response, NextFunction } from 'express';

type RouteMetric = {
  count: number;
  errors: number;
  totalMs: number;
  maxMs: number;
};

const httpRouteMetrics = new Map<string, RouteMetric>();

function getMetricKey(req: Request) {
  const routePath = req.route?.path ? String(req.route.path) : req.path;
  return `${req.method.toUpperCase()} ${req.baseUrl || ''}${routePath}`;
}

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();

  res.on('finish', () => {
    const key = getMetricKey(req);
    const existing = httpRouteMetrics.get(key) || {
      count: 0,
      errors: 0,
      totalMs: 0,
      maxMs: 0,
    };

    const durationMs = Date.now() - startedAt;
    existing.count += 1;
    existing.totalMs += durationMs;
    existing.maxMs = Math.max(existing.maxMs, durationMs);
    if (res.statusCode >= 500) {
      existing.errors += 1;
    }

    httpRouteMetrics.set(key, existing);
  });

  next();
}

export function getHttpMetricsSnapshot() {
  return Array.from(httpRouteMetrics.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([route, metric]) => ({
      route,
      count: metric.count,
      errors: metric.errors,
      avgMs: metric.count > 0 ? Math.round((metric.totalMs / metric.count) * 100) / 100 : 0,
      maxMs: metric.maxMs,
    }));
}
