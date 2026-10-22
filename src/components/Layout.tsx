import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useTheme } from '@/lib/theme';
import { useNotebook } from '@/lib/notebook-context';
import { assetUrl, AS_OF, EDITION_URL, longDate, manifest, PACK, scrollToId } from '@/lib/data';
import Drawer from '@/components/ui/Drawer';
import { S } from '@/strings';
const SearchModal = lazy(() => import('./SearchModal'));
const NotebookPanel = lazy(() => import('./notebook/NotebookPanel'));
const QuoteControl = lazy(() => import('./notebook/QuoteControl'));

/** The five surfaces (KICKOFF §4): the menu stays at five; record pages live under /plan, /rules and /library. */
export const NAV = [
  { to: '/', label: S.nav.start, end: true },
  { to: '/plan', label: S.nav.plan },
  { to: '/rules', label: S.nav.rules },
  { to: '/numbers', label: S.nav.numbers },
  { to: '/library', label: S.nav.library },
];

/** ≥ 900 px the Notebook docks beside the page; below that it is a drawer (KICKOFF §4c). */
function useWide(): boolean {
  const q = '(min-width: 900px)';
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => { const m = window.matchMedia(q); const on = () => setWide(m.matches); m.addEventListener('change', on); return () => m.removeEventListener('change', on); }, []);
  return wide;
}

function Logo() {
  const { theme } = useTheme();
  const full = assetUrl(theme === 'dark' ? 'brand/toptechhr-logo-dark.png' : 'brand/toptechhr-logo.png');
  return (
    <Link to="/" className="flex shrink-0 items-center" aria-label={`${S.appName} — ${S.nav.start}`} data-testid="logo-link">
      {/* the full logo at width, the mark alone at phone width */}
      <img src={full} alt={S.logoAlt} height={44} width={211} className="hidden sm:block h-[44px] w-auto" data-testid="logo" />
      <img src={assetUrl('brand/toptechhr-mark.png')} alt={S.logoAlt} height={44} width={44} className="sm:hidden h-[44px] w-[44px]" data-testid="logo-mark" />
    </Link>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const nb = useNotebook();
  const wide = useWide();
  const [menu, setMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const loc = useLocation();
  const onNotebookPage = loc.pathname.startsWith('/notebook');
  const onPrint = /^\/notebook\/[^/]+\/print/.test(loc.pathname);
  useEffect(() => { setMenu(false); }, [loc.pathname]);
  useEffect(() => {
    const main = document.getElementById('main');
    if (main && loc.key !== 'default' && !loc.hash) { main.focus({ preventScroll: true }); window.scrollTo({ top: 0 }); }
  }, [loc.pathname, loc.key, loc.hash]);
  useEffect(() => { if (loc.hash && loc.hash.length > 1) scrollToId(decodeURIComponent(loc.hash.slice(1))); }, [loc.pathname, loc.hash]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen((o) => !o); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // the print view renders alone: no band, header, nav, footer or panel (KICKOFF §5)
  if (onPrint) return <main id="main" tabIndex={-1} className="outline-none">{children}</main>;

  const docked = wide && nb.open && !onNotebookPage;
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main" className="sr-only-focusable fixed left-2 top-2 z-[80] rounded px-3 py-2 text-white" style={{ background: 'var(--bx-fill)' }}>{S.skip}</a>
      <div className="no-print text-center text-[13px] font-semibold text-white" style={{ background: 'var(--bx-fill)' }}>
        <Link to="/rules#changed" className="block px-4 py-1.5 !text-white hover:underline" data-testid="top-band">{S.band(longDate(PACK.as_of ?? AS_OF), PACK.tag)}</Link>
      </div>
      <header className="no-print sticky top-0 z-40 shadow-card" style={{ background: 'var(--bx-surface)' }}>
        <div className="mx-auto flex max-w-content items-center gap-3 px-4 lg:px-14 py-3">
          <Logo />
          <nav aria-label="Primary" className="hidden md:flex flex-1 justify-center gap-6 lg:gap-9">
            {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `tt-nav-link ${isActive ? 'active' : ''}`}>{n.label}</NavLink>)}
          </nav>
          <div className="ml-auto md:ml-0 flex shrink-0 items-center gap-1.5">
            <button type="button" className="bx-btn !px-2" onClick={() => setSearchOpen(true)} aria-label={`${S.search} (Command K)`} title={`${S.search} ⌘K`}><span aria-hidden="true">⌕</span></button>
            <button type="button" onClick={toggle} className="bx-btn !px-2" aria-pressed={theme === 'dark'} aria-label={`Dark mode ${theme === 'dark' ? 'on' : 'off'}`} title="Light or dark" data-testid="theme-toggle"><span aria-hidden="true">{theme === 'dark' ? '☾' : '☼'}</span></button>
            {!onNotebookPage && (
              <button type="button" className={`bx-btn ${nb.open ? 'bx-btn-on' : ''}`} onClick={nb.toggle} aria-pressed={nb.open} data-testid="notebook-toggle">{S.notebook}</button>
            )}
            <button type="button" className="bx-btn !px-2 md:hidden" aria-expanded={menu} aria-controls="mobile-nav" aria-label={S.menu} onClick={() => setMenu((o) => !o)}><span aria-hidden="true">☰</span></button>
          </div>
        </div>
        {menu && (
          <nav id="mobile-nav" aria-label="Primary mobile" className="md:hidden px-4 pb-3">
            <ul className="grid gap-1">{NAV.map((n) => <li key={n.to}><NavLink to={n.to} end={n.end} className={({ isActive }) => `tt-nav-link block ${isActive ? 'active' : ''}`}>{n.label}</NavLink></li>)}</ul>
          </nav>
        )}
      </header>

      <div className={`flex-1 ${docked ? 'grid grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]' : ''}`}>
        <main id="main" tabIndex={-1} className="outline-none min-w-0 min-h-screen">{children}</main>
        {docked && (
          <aside id="notebook" aria-label={S.notebook} className="tt-notebook-dock no-print sticky top-[72px] h-[calc(100vh-72px)] overflow-hidden p-4 shadow-card" style={{ background: 'var(--bx-surface)' }} data-testid="notebook-dock">
            <Suspense fallback={<p className="bx-muted">{S.loading}</p>}><NotebookPanel onClose={() => nb.setOpen(false)} /></Suspense>
          </aside>
        )}
      </div>
      {!wide && !onNotebookPage && (
        <Drawer open={nb.open} onClose={() => nb.setOpen(false)} label={S.notebook} testId="notebook-drawer" wide>
          <Suspense fallback={<p className="bx-muted">{S.loading}</p>}><NotebookPanel /></Suspense>
        </Drawer>
      )}

      {searchOpen && <Suspense fallback={null}><SearchModal open onClose={() => setSearchOpen(false)} /></Suspense>}
      {!onNotebookPage && <Suspense fallback={null}><QuoteControl /></Suspense>}
      {nb.toast && <div role="status" className="no-print fixed bottom-4 left-1/2 z-[75] -translate-x-1/2 rounded-[10px] px-4 py-2 text-[14px] font-semibold text-white shadow-card" style={{ background: 'var(--bx-ink)', color: 'var(--bx-bg)' }} data-testid="toast">{nb.toast}</div>}

      <footer className="no-print mt-16" style={{ background: 'var(--bx-surface)' }}>
        <div className="mx-auto max-w-content px-4 lg:px-14 py-8 grid gap-3 text-[14px]">
          <p className="flex flex-wrap gap-x-5 gap-y-1">
            <span data-testid="footer-evidence">{S.footerEvidence(PACK.references, AS_OF)}</span>
            <Link to="/library/methods">{S.footerMethods}</Link>
            <a href={EDITION_URL} target="_blank" rel="noreferrer">{S.footerEdition} ↗</a>
            <Link to="/about">About</Link>
          </p>
          <p className="font-semibold" style={{ color: 'var(--bx-ink)' }} data-testid="footer-privacy">{S.footerPrivacy}</p>
          <p className="bx-muted" data-testid="footer-disclaimer">{manifest.disclaimer}</p>
        </div>
      </footer>
    </div>
  );
}
