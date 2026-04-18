export async function lockSessionForMutation(tx: any, sessionId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`dining-session:${sessionId}`}))`;
}
