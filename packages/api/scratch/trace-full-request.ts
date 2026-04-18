import { prisma } from '../src/db/prisma';
import { getAnalytics } from '../src/controllers/analytics.controller';
import { tenantRateLimitMiddleware } from '../src/middlewares/tenant-rate-limit.middleware';
import { Request, Response } from 'express';

process.env.NODE_ENV = 'development'; // Enable Prisma query events

async function traceRequest() {
  console.log('--- STARTING HIGH-RESOLUTION LATENCY TRACE ---');
  
  const timeline: any[] = [];
  const startMark = performance.now();

  const mockReq = {
    tenantId: 'cmo4gpttk0000sk3792v3a9f9', // Benchmark tenant
    query: { days: '30' },
    ip: '127.0.0.1',
    socket: {}
  } as unknown as Request;

  const mockRes = {
    status: (code: number) => {
      timeline.push({ event: `HTTP_STATUS: ${code}`, elapsed: performance.now() - startMark });
      return mockRes;
    },
    json: (data: any) => {
      const endMark = performance.now();
      timeline.push({ event: 'RESPONSE_SENT', elapsed: endMark - startMark });
      
      console.log('\n--- TRACE TIMELINE (ms) ---');
      timeline.forEach(t => {
        const extra = t.duration ? ` (DB Context: ${t.duration}ms)` : '';
        console.log(`${t.elapsed.toFixed(2)}ms: ${t.event}${extra}`);
      });
    }
  } as unknown as Response;

  // 1. Hook into Prisma to measure internal DB time
  (prisma as any).$on('query', (e: any) => {
    const now = performance.now() - startMark;
    timeline.push({ event: `PRISMA_WIRE_READY: ${e.query.substring(0, 50)}...`, elapsed: now, duration: e.duration });
  });

  console.log('0.00ms: REQUEST_PICKUP');
  
  try {
    // Stage 1: Middleware
    timeline.push({ event: 'MIDDLEWARE_START: RateLimit', elapsed: performance.now() - startMark });
    await new Promise<void>((resolve) => tenantRateLimitMiddleware(mockReq, mockRes, () => resolve()));
    timeline.push({ event: 'MIDDLEWARE_END: RateLimit', elapsed: performance.now() - startMark });

    // Stage 2: Controller
    timeline.push({ event: 'CONTROLLER_START: getAnalytics', elapsed: performance.now() - startMark });
    await getAnalytics(mockReq, mockRes);
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

traceRequest();

