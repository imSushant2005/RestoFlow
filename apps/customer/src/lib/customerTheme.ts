function normalizeHexColor(value: string | null | undefined, fallback: string) {
  const trimmed = String(value || '').trim();
  if (/^#[0-9a-f]{3}$/i.test(trimmed) || /^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed.length === 4
      ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`
      : trimmed;
  }
  return fallback;
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = normalizeHexColor(hex, '#f97316').replace('#', '');
  const safeAlpha = Math.min(1, Math.max(0, alpha));
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${safeAlpha})`;
}

export function buildCustomerThemeVars(source: {
  primaryColor?: string | null;
  accentColor?: string | null;
} | null | undefined) {
  const brand = normalizeHexColor(source?.primaryColor, '#f97316');
  const accent = normalizeHexColor(source?.accentColor, '#1e293b');

  return {
    '--brand': brand,
    '--accent': accent,
    '--brand-soft': hexToRgba(brand, 0.12),
    '--accent-soft': hexToRgba(accent, 0.12),
    '--brand-gradient': `linear-gradient(135deg, ${brand}, ${accent})`,
  } as Record<string, string>;
}
