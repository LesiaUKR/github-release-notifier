import { collectDefaultMetrics, Counter, Histogram, register } from 'prom-client';

collectDefaultMetrics();

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'] as const,
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

export const scannerCyclesTotal = new Counter({
  name: 'scanner_cycles_total',
  help: 'Total number of scanner polling cycles',
});

export const scannerNewReleasesFound = new Counter({
  name: 'scanner_new_releases_found_total',
  help: 'Total number of new releases detected by scanner',
});

export const emailsSentTotal = new Counter({
  name: 'emails_sent_total',
  help: 'Total number of notification emails sent',
  labelNames: ['status'] as const,
});

export { register };
