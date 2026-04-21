const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const rootEnvPath = path.resolve(__dirname, '..', '.env');

if (fs.existsSync(rootEnvPath)) {
  const raw = fs.readFileSync(rootEnvPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function redactConnectionString(url) {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return 'invalid-url';
  }
}

async function check(label, connectionString) {
  if (!connectionString) {
    console.log(`[${label}] skipped: missing connection string`);
    return false;
  }

  const client = new Client({
    connectionString,
    statement_timeout: 15000,
    query_timeout: 15000,
  });

  const startedAt = Date.now();

  try {
    await client.connect();
    const result = await client.query(
      'select current_database() as database_name, current_user as current_user, now() as server_time',
    );
    const latencyMs = Date.now() - startedAt;
    const row = result.rows[0] || {};
    console.log(`[${label}] ok in ${latencyMs}ms`);
    console.log(`[${label}] url=${redactConnectionString(connectionString)}`);
    console.log(
      `[${label}] database=${row.database_name || 'unknown'} user=${row.current_user || 'unknown'} server_time=${row.server_time || 'unknown'}`,
    );
    return true;
  } catch (error) {
    console.error(`[${label}] failed:`, error instanceof Error ? error.message : String(error));
    return false;
  } finally {
    await client.end().catch(() => {});
  }
}

async function main() {
  const results = {
    pooled: await check('pooled', process.env.DATABASE_URL),
    direct: await check('direct', process.env.DIRECT_DATABASE_URL),
  };

  const preferred = process.env.NODE_ENV === 'production' ? 'pooled' : results.direct ? 'direct' : 'pooled';
  console.log(`[summary] preferred_runtime_connection=${preferred}`);

  if (!results.pooled && !results.direct) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[db-check] failed:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
