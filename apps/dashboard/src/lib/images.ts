function extractGoogleDriveId(url: string) {
  const knownPatterns = [
    /\/file\/d\/([-\w]{25,})/i,
    /[?&]id=([-\w]{25,})/i,
    /\/uc\?[^#]*id=([-\w]{25,})/i,
    /\/thumbnail\?[^#]*id=([-\w]{25,})/i,
    /\/d\/([-\w]{25,})/i,
    /\/folders\/([-\w]{25,})/i,
  ];

  for (const pattern of knownPatterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }

  const fallback = url.match(/[-\w]{25,}/);
  return fallback?.[0] || null;
}

export function getDirectImageUrl(url: string | null | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();

  if (!trimmed) return '';
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (/^data:|^blob:/i.test(trimmed)) return trimmed;

  if (trimmed.includes('drive.google.com') || trimmed.includes('drive.usercontent.google.com')) {
    const driveId = extractGoogleDriveId(trimmed);
    if (driveId) {
      return `https://lh3.googleusercontent.com/d/${driveId}=w1600`;
    }
  }

  if (trimmed.includes('dropbox.com')) {
    return trimmed
      .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
      .replace(/[?&]dl=0/, '')
      .replace(/[?&]raw=1/, '');
  }

  if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('/') && /^[\w.-]+\.[a-z]{2,}/i.test(trimmed)) {
    return `https://${trimmed}`;
  }

  return trimmed;
}
