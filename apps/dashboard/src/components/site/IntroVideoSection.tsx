import { useEffect, useRef, useState } from 'react';
import { Loader2, PlayCircle, Volume2, VolumeX } from 'lucide-react';
import dashboardPoster from '../../assets/new-dashboard-preview.png';

type IntroVideoSectionProps = {
  title?: string;
  description?: string;
  posterSrc?: string;
};

export function IntroVideoSection({
  title = 'See the full restaurant flow in one connected operating system.',
  description = 'This walkthrough shows how BHOJFLOW connects QR ordering, kitchen updates, waiter coordination, billing, and completion without dropping the customer or staff context between steps.',
  posterSrc = dashboardPoster,
}: IntroVideoSectionProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  const videoSrc = import.meta.env.VITE_SITE_INTRO_VIDEO_URL || '/BHOJFLOW-intro.mp4';

  useEffect(() => {
    const element = videoRef.current;
    if (!element || hasFailed) return;

    element.muted = isMuted;
    const playPromise = element.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => undefined);
    }
  }, [hasFailed, isMuted]);

  return (
    <section className="rounded-[32px] border p-5 sm:p-6" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: 'var(--brand)' }}>
            Product Intro
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl" style={{ color: 'var(--text-1)' }}>
            {title}
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 sm:text-base" style={{ color: 'var(--text-2)' }}>
            {description}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              'Guests scan, browse, customize, and order on mobile.',
              'Kitchen and floor teams stay updated in real time.',
              'Bills and payment states stay ready for reconciliation.',
            ].map((point) => (
              <div
                key={point}
                className="rounded-2xl border p-4 text-sm font-medium"
                style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)' }}
              >
                {point}
              </div>
            ))}
          </div>
        </div>

        <div
          className="relative overflow-hidden rounded-[28px] border"
          style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(2, 6, 23, 0.7)' }}
        >
          <div className="relative aspect-[16/10] w-full">
            {!hasFailed ? (
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                poster={posterSrc}
                autoPlay
                loop
                playsInline
                muted={isMuted}
                preload="metadata"
                onLoadedData={() => setIsReady(true)}
                onError={() => {
                  setHasFailed(true);
                  setIsReady(true);
                }}
              >
                <source src={videoSrc} type="video/mp4" />
              </video>
            ) : (
              <img src={posterSrc} alt="BHOJFLOW dashboard preview" className="h-full w-full object-cover" />
            )}

            {!isReady ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm">
                <div className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold text-white" style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(15,23,42,0.8)' }}>
                  <Loader2 size={16} className="animate-spin" />
                  Loading intro
                </div>
              </div>
            ) : null}

            {hasFailed ? (
              <div className="absolute inset-x-4 bottom-4 rounded-2xl border px-4 py-3 text-sm font-medium text-white" style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(15,23,42,0.8)' }}>
                Video preview not available on this device yet. The poster below still shows the live operations workspace.
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-4" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'rgba(255,255,255,0.72)' }}>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1">
                <PlayCircle size={12} />
                Intro walkthrough
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-3 py-1">
                Poster fallback included
              </span>
            </div>

            {!hasFailed ? (
              <button
                type="button"
                onClick={() => setIsMuted((current) => !current)}
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-white"
                style={{ background: 'rgba(59, 130, 246, 0.16)', border: '1px solid rgba(59,130,246,0.2)' }}
              >
                {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                {isMuted ? 'Muted' : 'Sound on'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
