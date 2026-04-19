export async function lockSessionForMutation(tx: any, sessionId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`dining-session:${sessionId}`}))`;
}
