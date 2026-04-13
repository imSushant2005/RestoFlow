const MENU_SNAPSHOT_PREFIX = 'rf_menu_snapshot_';

function getMenuSnapshotKey(tenantSlug: string | null | undefined) {
  const scope = tenantSlug?.trim() || 'global';
  return `${MENU_SNAPSHOT_PREFIX}${scope}`;
}

export function readMenuSnapshot(tenantSlug: string | null | undefined) {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(getMenuSnapshotKey(tenantSlug));
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeMenuSnapshot(tenantSlug: string | null | undefined, data: unknown) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(
      getMenuSnapshotKey(tenantSlug),
      JSON.stringify({
        savedAt: new Date().toISOString(),
        data,
      }),
    );
  } catch {
    // Ignore storage quota and serialization errors.
  }
}
