import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Camera, QrCode } from 'lucide-react';

export function QrScannerPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [error, setError] = useState('');
  const [manualValue, setManualValue] = useState('');
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleScannedValue = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    try {
      if (/^https?:\/\//i.test(trimmed)) {
        const url = new URL(trimmed);
        navigate(`${url.pathname}${url.search}`);
        return;
      }
      if (trimmed.startsWith('/')) {
        navigate(trimmed);
        return;
      }
      setError('QR content was read, but the link format is not supported yet.');
    } catch {
      setError('Could not understand this QR code. Please try another one.');
    }
  };

  const startScanner = async () => {
    const BarcodeDetectorCtor = (window as any).BarcodeDetector;
    if (!BarcodeDetectorCtor) {
      setError('This browser does not support live QR scanning. Paste the QR link below instead.');
      return;
    }

    try {
      setIsStarting(true);
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      const detector = new BarcodeDetectorCtor({ formats: ['qr_code'] });

      const scanFrame = async () => {
        if (!videoRef.current) return;

        try {
          const codes = await detector.detect(videoRef.current);
          const firstCode = codes?.[0]?.rawValue;
          if (firstCode) {
            handleScannedValue(firstCode);
            return;
          }
        } catch {
          // keep scanning
        }

        rafRef.current = requestAnimationFrame(scanFrame);
      };

      rafRef.current = requestAnimationFrame(scanFrame);
    } catch (requestError: any) {
      setError(requestError?.message || 'Camera access failed. Please allow camera permission.');
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[var(--bg)] px-4 py-6">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/6 bg-white text-slate-700 shadow-sm"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Customer QR Scan</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Scan Table QR</h1>
          </div>
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-white/6 bg-slate-950 p-5 text-white shadow-2xl">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/15 text-blue-400">
                <QrCode size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black">Point your camera at the table code</h2>
                <p className="mt-1 text-sm font-medium text-slate-400">We’ll open the restaurant login and party-size flow automatically.</p>
              </div>
            </div>

            <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-black">
              <video ref={videoRef} className="aspect-[4/5] w-full object-cover" playsInline muted />
            </div>

            <button
              type="button"
              onClick={startScanner}
              disabled={isStarting}
              className="flex h-13 w-full items-center justify-center gap-3 rounded-2xl bg-blue-600 px-5 text-[12px] font-black uppercase tracking-[0.14em] text-white shadow-xl shadow-blue-900/30 transition-all hover:bg-blue-500 disabled:opacity-50"
            >
              <Camera size={18} />
              {isStarting ? 'Starting Camera...' : 'Start Scanning'}
            </button>
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/6 bg-white p-5 shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Manual backup</p>
          <h2 className="mt-2 text-lg font-black text-slate-900">Paste a QR link</h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            If the browser blocks camera access, paste the QR URL here and continue.
          </p>
          <textarea
            value={manualValue}
            onChange={(event) => setManualValue(event.target.value)}
            placeholder="Paste QR URL here"
            className="mt-4 min-h-[120px] w-full rounded-2xl border-2 border-gray-100 bg-gray-50 p-4 font-semibold text-slate-900 outline-none transition-all focus:border-blue-400 focus:bg-white"
          />
          <button
            type="button"
            onClick={() => handleScannedValue(manualValue)}
            className="mt-4 flex h-12 w-full items-center justify-center rounded-2xl bg-slate-900 px-5 text-[12px] font-black uppercase tracking-[0.14em] text-white"
          >
            Open QR Link
          </button>
          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
