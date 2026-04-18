import { getRedisClient } from '../src/services/cache.service';

async function checkRedis() {
  const redis = getRedisClient();
  if (!redis) {
    console.log('Redis NOT configured.');
    return;
  }
  
  const start = performance.now();
  await redis.ping();
  const latency = performance.now() - start;
  console.log(`REDIS_PING_LATENCY: ${latency.toFixed(2)}ms`);
}

checkRedis().catch(console.error).finally(() => process.exit());
