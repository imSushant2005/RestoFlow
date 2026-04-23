import { Link, useLocation, useParams } from 'react-router-dom';

function getLegalLinks(tenantSlug?: string) {
  const basePath = tenantSlug ? `/order/${tenantSlug}` : '';
  return [
    { label: 'Privacy Policy', href: `${basePath}/privacy` },
    { label: 'Terms & Conditions', href: `${basePath}/terms` },
  ];
}

export function CustomerFooter() {
  const { tenantSlug } = useParams();
  const location = useLocation();
  const legalLinks = getLegalLinks(tenantSlug);

  return (
    <footer
      className="relative overflow-hidden border-t"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 select-none text-[2.6rem] font-black uppercase tracking-[0.34em] opacity-[0.05] sm:block"
        style={{ color: 'var(--text-1)' }}
      >
        BHOJFLOW
      </div>

      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/bhojflow-logo.png" alt="BHOJFLOW" className="h-10 w-10 flex-shrink-0 rounded-xl object-contain" />
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: 'var(--brand)' }}>
              Powered by BHOJFLOW
            </p>
            <p className="mt-1 max-w-xl text-sm font-medium leading-relaxed" style={{ color: 'var(--text-3)' }}>
              Live restaurant ordering, session tracking, and billing flow.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-bold sm:text-sm">
          {legalLinks.map((link, index) => {
            const isActive = location.pathname === link.href;
            return (
              <div key={link.href} className="flex items-center gap-3">
                {index > 0 ? (
                  <span aria-hidden="true" className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                    •
                  </span>
                ) : null}
                <Link
                  to={link.href}
                  className="transition-colors hover:opacity-80"
                  style={{ color: isActive ? 'var(--brand)' : 'var(--text-2)' }}
                >
                  {link.label}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </footer>
  );
}
