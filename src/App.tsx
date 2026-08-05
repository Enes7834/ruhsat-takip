import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, NavLink } from "react-router-dom";
import PermitsPage from "./pages/PermitsPage";
import ThemeToggle from "./components/ThemeToggle";

// Kod bölme — ilk açılışta yalnız pano JS'si yüklenir
const PermitDetailPage = lazy(() => import("./pages/PermitDetailPage"));
const NotesPage = lazy(() => import("./pages/NotesPage"));

const Loading = () => <p className="mx-auto max-w-7xl px-5 py-20 text-dim">Yükleniyor…</p>;

export default function App() {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-base/85 backdrop-blur">
        <nav className="mx-auto flex max-w-7xl items-center gap-4 px-5 py-3 md:px-8">
          <NavLink to="/surec" className="flex items-center gap-2.5">
            <span className="brand-mark">D</span>
            <span className="leading-tight">
              <span className="block font-display text-sm font-extrabold tracking-tight text-ink">
                DURAN İNŞAAT
              </span>
              <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-hivis">
                Ruhsat Takip
              </span>
            </span>
          </NavLink>

          <span className="mx-1 hidden h-6 w-px bg-line sm:block" />

          <NavLink
            to="/surec"
            className={({ isActive }) =>
              `hidden text-sm sm:block ${isActive ? "text-hivis" : "text-dim hover:text-ink"}`
            }
          >
            Pano
          </NavLink>
          <NavLink
            to="/notlar"
            aria-label="Not defteri"
            title="Not defteri"
            className={({ isActive }) =>
              `grid h-8 w-8 place-items-center rounded-sm border transition-colors ${
                isActive ? "border-hivis text-hivis" : "border-line text-dim hover:border-hivis hover:text-hivis"
              }`
            }
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4a2 2 0 0 1 2-2h10l4 4v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" />
              <path d="M8 8h6M8 12h8M8 16h5" />
            </svg>
          </NavLink>

          <span
            aria-hidden="true"
            className="flex-1 select-none text-center text-[18px] leading-none text-hivis md:text-[30px]"
            style={{ fontFamily: '"Sacramento", "Snell Roundhand", "Apple Chancery", cursive' }}
          >
            Ali Hamza Duran
          </span>
          <div className="flex items-center gap-3">
            <p className="hidden font-mono text-[11px] uppercase tracking-widest text-faint lg:block">
              Belediye Onay & Ruhsat Süreci
            </p>
            <ThemeToggle />
          </div>
        </nav>
        <div className="hazard-strip" />
      </header>
      <main>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Navigate to="/surec" replace />} />
            <Route path="/surec" element={<PermitsPage />} />
            <Route path="/surec/:id" element={<PermitDetailPage />} />
            <Route path="/notlar" element={<NotesPage />} />
            <Route
              path="*"
              element={<p className="mx-auto max-w-7xl px-5 py-20 text-dim">Sayfa bulunamadı.</p>}
            />
          </Routes>
        </Suspense>
      </main>
      <footer className="mt-20 border-t border-line bg-sunken/60">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-6 md:px-8">
          <p className="text-xs text-faint">
            <span className="font-semibold text-dim">Duran İnşaat</span> · Sultangazi, İstanbul — ruhsat
            ve belediye süreç takip sistemi
          </p>
          <p className="font-mono text-[11px] uppercase tracking-widest text-faint">
            Dahili kullanım · {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </>
  );
}
