# 🚀 BHOJFLOW Go-Live Checklist
**Status:** Ready for controlled production launch (First 100+ Vendors)

This document is the operational manual for launching the new performance-hardened BHOJFLOW architecture. It prioritizes stability and observability during the initial rollout phase.

---

## 🏗️ 1. Infrastructure Preparation

- [ ] **Region Alignment (Critical Path):** Move API server to `eastus2` (North Virginia).
  - *Context:* Current latency carries a ~300ms link tax to Neon. Alignment will collapse dashboard load times to <100ms.
- [ ] **Redis Tier Elevation:** Upgrade Redis instance to a persistent, high-availability tier.
  - *Context:* The system now relies on Redis as a Tier-1 performance bridge.
- [ ] **Connection Pool Scaling:** Ensure `connection_limit=5` is set in the production `DATABASE_URL`.

## 📈 2. Monitoring & Alerting (The "Baseline")

Configure your monitoring provider (e.g., Datadog, Prometheus, or CloudWatch) for these thresholds:

- [ ] **Cache Hit Rate:** Alert if `getHits / (getHits + getMisses)` drops below **70%** for more than 15 mins.
- [ ] **Circuit Breaker Status:** Alert immediately on `[CACHE_CIRCUIT] Transitioned to OPEN`.
  - *Implication:* Users are now hitting the 2s "Cold Path" baseline.
- [ ] **Warming Job Health:** Log watch for `[CACHE_WARMING] Job execution failed`.
- [ ] **DB CPU Usage:** Monitor for spikes coinciding with warming job offsets (every 12m).

## 🌊 3. Rollout Stages

1. **Stage 1 (Internal Test):** Deploy with 1-2 proxy tenants. Verify `warmerMetrics` increment.
2. **Stage 2 (Pilot - 10 Vendors):** Onboard 10 low-traffic restaurants. Monitor for "Thundering Herd" logs.
3. **Stage 3 (Scale up to 100):** Gradual onboarding. Verify `stormPrevented` metric is > 0 during peak hours.

## 🔄 4. Rollback & Emergency Plan

- [ ] **Rollback Command:** Identify the `git revert` or deployment SHA for the state **pre-cache-hardening**.
- [ ] **Emergency Cache Kill:** A utility script to run `redis-cli FLUSHALL` if stale data propagates.
- [ ] **Bypass Mode:** To disable the cache, unset the `REDIS_URL` environment variable. The system will "Fail Open" to in-memory/DB.

## 🩺 5. Health Checks (Operator Guide)

### Cache/Warming Health
- **Check:** Run `npx tsx scratch/verify-hardening-v2.ts`.
- **Expected:** `Storm Mitigated: True`, `Warm Hit Latency: < 400ms`.

### Circuit-Breaker Check
- **Check:** Search logs for `[CACHE_CIRCUIT]`.
- **Expected:** Should rarely transition. If `OPEN`, verify the 30s backoff timer is respected.

### Cold-Hit vs Warm-Hit UX
- **Active Tenant (Last 4h):** Should see **~300ms** (Instant feel after region shift).
- **New Tenant:** Will see **~3.9s** initial load (TLS + Link + Handshake).
- **First-Action Lag:** After an order is created, the background re-warm takes **~2.5s** (Debounce + Exec). The user's next navigation will be warm.

---

## 🛠️ 6. Post-Deploy Verification

1. **Verify Jobs:** Ensure `runWarming` is visible in logs after the 3-minute startup delay.
2. **Verify Lock:** Check Redis for keys matching `lock:job:*`.
3. **Verify Invalidation:** Create an order for a test tenant; verify the dashboard cache is re-populated within 5 seconds.

---

**Final Verdict:** The system is **ready for controlled production launch**.
👉 *Infrastructure distance is the only remaining bottleneck for sub-100ms performance.*
