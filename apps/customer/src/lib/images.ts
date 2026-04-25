export const DEFAULT_MENU_IMAGE =
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80';

const INVALID_IMAGE_VALUES = new Set(['undefined', 'null', 'none', 'n/a', 'na', '#']);

function normalizeImageValue(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (INVALID_IMAGE_VALUES.has(trimmed.toLowerCase())) return '';
  return trimmed;
}

function extractGoogleDriveId(url: string) {
  const knownPatterns = [
    /\/file\/d\/([-\w]{25,})/i,
    /[?&]id=([-\w]{25,})/i,
    /\/uc\?[^#]*id=([-\w]{25,})/i,
    /\/thumbnail\?[^#]*id=([-\w]{25,})/i,
    /\/open\?[^#]*id=([-\w]{25,})/i,
    /\/download\?[^#]*id=([-\w]{25,})/i,
    /\/d\/([-\w]{25,})/i,
    /\/folders\/([-\w]{25,})/i,
  ];

  for (const pattern of knownPatterns) {
    const match = url.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  const fallback = url.match(/[-\w]{25,}/);
  return fallback?.[0] || null;
}

/**
 * Converts various image URL formats to direct browser-renderable links.
 * Google Drive can be fussy in <img> tags, so expose a candidate list for retrying.
 */
export function getImageUrlCandidates(url: string | null | undefined): string[] {
  const trimmed = normalizeImageValue(url);

  if (!trimmed) return [];
  if (trimmed.startsWith('//')) return [`https:${trimmed}`];
  if (/^data:|^blob:/i.test(trimmed)) return [trimmed];

  if (trimmed.includes('drive.google.com') || trimmed.includes('drive.usercontent.google.com')) {
    const driveId = extractGoogleDriveId(trimmed);
    if (driveId) {
      return Array.from(new Set([
        `https://drive.usercontent.google.com/download?id=${driveId}&export=view&authuser=0`,
        `https://lh3.googleusercontent.com/d/${driveId}=w1600`,
        `https://lh3.googleusercontent.com/d/${driveId}=s1600`,
        `https://drive.google.com/thumbnail?id=${driveId}&sz=w1600`,
        `https://drive.google.com/uc?export=view&id=${driveId}`,
        `https://drive.google.com/uc?export=download&id=${driveId}`,
      ]));
    }
  }

  if (trimmed.includes('dropbox.com')) {
    return [trimmed
      .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
      .replace(/[?&]dl=0/, '')
      .replace(/[?&]raw=1/, '')];
  }

  if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('/') && /^[\w.-]+\.[a-z]{2,}/i.test(trimmed)) {
    return [`https://${trimmed}`];
  }

  return [trimmed];
}

export function pickFirstImageSource(...values: Array<unknown>): string {
  for (const value of values) {
    if (Array.isArray(value)) {
      const nested = pickFirstImageSource(...value);
      if (nested) return nested;
      continue;
    }

    const normalized = normalizeImageValue(value);
    if (normalized) return normalized;
  }

  return '';
}

export function getDirectImageUrl(url: string | null | undefined): string {
  return getImageUrlCandidates(url)[0] || '';
}
