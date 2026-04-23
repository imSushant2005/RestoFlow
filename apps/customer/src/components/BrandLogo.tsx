import { useEffect, useMemo, useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { getImageUrlCandidates } from '../lib/images';

type BrandLogoProps = {
  src?: string | null;
  alt: string;
  name?: string | null;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  iconSize?: number;
};

function getInitials(name?: string | null) {
  const tokens = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (tokens.length === 0) return 'BF';
  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toUpperCase();
  }
  return tokens.map((token) => token[0]?.toUpperCase() || '').join('') || 'BF';
}

export function BrandLogo({
  src,
  alt,
  name,
  className = '',
  imageClassName = '',
  fallbackClassName = '',
  iconSize = 24,
}: BrandLogoProps) {
  const imageUrls = useMemo(() => getImageUrlCandidates(src), [src]);
  const [imageIndex, setImageIndex] = useState(0);
  const [hasError, setHasError] = useState(false);
  const normalizedSrc = imageUrls[imageIndex] || '';

  useEffect(() => {
    setImageIndex(0);
    setHasError(false);
  }, [imageUrls]);

  const initials = getInitials(name || alt);

  return (
    <div className={`overflow-hidden ${className}`}>
      {normalizedSrc && !hasError ? (
        <img
          src={normalizedSrc}
          key={normalizedSrc}
          alt={alt}
          loading="lazy"
          onError={() => {
            if (imageIndex < imageUrls.length - 1) {
              setImageIndex((current) => current + 1);
              return;
            }
            setHasError(true);
          }}
          className={imageClassName}
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center bg-white/10 text-sm font-black uppercase tracking-[0.16em] ${fallbackClassName}`}
          style={{ borderRadius: 'inherit' }}
        >
          {name ? initials : <UtensilsCrossed size={iconSize} />}
        </div>
      )}
    </div>
  );
}
