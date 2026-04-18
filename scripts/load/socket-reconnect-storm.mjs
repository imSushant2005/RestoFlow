import { createRequire } from 'node:module';

const requireFromCustomer = createRequire(new URL('../../apps/customer/package.json', import.meta.url));
const { io } = requireFromCustomer('socket.io-client');

const SOCKET_URL = process.env.SOCKET_URL || 'http://127.0.0.1:4000';
const CLIENT_COUNT = Number(process.env.SOCKET_CLIENTS || 500);
const BATCH_SIZE = Number(process.env.SOCKET_BATCH_SIZE || 25);
const WAVE_COUNT = Number(process.env.SOCKET_WAVES || 2);
const RECONNECT_DELAY_MS = Number(process.env.SOCKET_RECONNECT_DELAY_MS || 1500);
const SOCKET_BEARER_TOKEN = process.env.SOCKET_BEARER_TOKEN || '';
const SOCKET_SESSION_ACCESS_TOKEN = process.env.SOCKET_SESSION_ACCESS_TOKEN || '';
const SOCKET_TENANT_SLUG = process.env.SOCKET_TENANT_SLUG || '';

if (!SOCKET_BEARER_TOKEN && !SOCKET_SESSION_ACCESS_TOKEN) {
  console.error('Provide SOCKET_BEARER_TOKEN or SOCKET_SESSION_ACCESS_TOKEN.');
  process.exit(1);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildAuth() {
  if (SOCKET_BEARER_TOKEN) {
    return { token: SOCKET_BEARER_TOKEN };
  }
  return {
    tenantSlug: SOCKET_TENANT_SLUG,
    sessionAccessToken: SOCKET_SESSION_ACCESS_TOKEN,
  };
}

function createClient(index) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      timeout: 10_000,
      reconnection: false,
      auth: buildAuth(),
    });

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve({ socket, ...result });
    };

    socket.on('connect', () => {
      socket.emit('sync:request', {}, () => {
        finish({
          ok: true,
          clientIndex: index,
          connectMs: Date.now() - startedAt,
        });
      });
    });

    socket.on('connect_error', (error) => {
      finish({
        ok: false,
        clientIndex: index,
        connectMs: Date.now() - startedAt,
        error: error?.message || 'connect_error',
      });
    });
  });
}

async function connectBatch(startIndex, batchSize) {
  const connections = [];
  for (let offset = 0; offset < batchSize; offset += 1) {
    connections.push(createClient(startIndex + offset));
  }
  return Promise.all(connections);
}

async function connectAllClients() {
  const results = [];
  for (let index = 0; index < CLIENT_COUNT; index += BATCH_SIZE) {
    const currentBatchSize = Math.min(BATCH_SIZE, CLIENT_COUNT - index);
    const batchResults = await connectBatch(index, currentBatchSize);
    results.push(...batchResults);
  }
  return results;
}

async function main() {
  console.log(
    `[socket-reconnect-storm] connecting ${CLIENT_COUNT} clients to ${SOCKET_URL} in ${WAVE_COUNT} waves`,
  );

  let activeSockets = [];

  for (let wave = 1; wave <= WAVE_COUNT; wave += 1) {
    const connected = await connectAllClients();
    const succeeded = connected.filter((result) => result.ok);
    const failed = connected.filter((result) => !result.ok);
    const avgMs =
      connected.length > 0
        ? Math.round(connected.reduce((sum, result) => sum + result.connectMs, 0) / connected.length)
        : 0;

    console.log(
      JSON.stringify({
        wave,
        total: connected.length,
        succeeded: succeeded.length,
        failed: failed.length,
        avgConnectMs: avgMs,
        maxConnectMs: connected.reduce((max, result) => Math.max(max, result.connectMs), 0),
      }),
    );

    activeSockets.forEach((result) => result.socket.disconnect());
    activeSockets = succeeded;

    if (wave < WAVE_COUNT) {
      activeSockets.forEach((result) => result.socket.disconnect());
      activeSockets = [];
      await sleep(RECONNECT_DELAY_MS);
    }
  }

  activeSockets.forEach((result) => result.socket.disconnect());
  console.log('[socket-reconnect-storm] complete');
}

main().catch((error) => {
  console.error('[socket-reconnect-storm] fatal', error);
  process.exit(1);
});
