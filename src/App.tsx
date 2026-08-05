import { Routes, Route, Navigate, NavLink } from "react-router-dom";
import PermitsPage from "./pages/PermitsPage";
import PermitDetailPage from "./pages/PermitDetailPage";
import TariffPage from "./pages/TariffPage";
import CalculatorPage from "./pages/CalculatorPage";

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
            to="/tarife"
            className={({ isActive }) =>
              `hidden text-sm sm:block ${isActive ? "text-hivis" : "text-dim hover:text-ink"}`
            }
          >
            Harç Tarifesi
          </NavLink>
          <NavLink
            to="/hesapla"
            className={({ isActive }) =>
              `hidden text-sm sm:block ${isActive ? "text-hivis" : "text-dim hover:text-ink"}`
            }
          >
            Hesaplama
          </NavLink>

          <div className="ml-auto flex items-center gap-4">
            <p className="hidden font-mono text-[11px] uppercase tracking-widest text-faint lg:block">
              Belediye Onay & Ruhsat Süreci
            </p>
          </div>
        </nav>
        <div className="hazard-strip" />
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/surec" replace />} />
          <Route path="/surec" element={<PermitsPage />} />
          <Route path="/surec/:id" element={<PermitDetailPage />} />
          <Route path="/tarife" element={<TariffPage />} />
          <Route path="/hesapla" element={<CalculatorPage />} />
          <Route
            path="*"
            element={<p className="mx-auto max-w-7xl px-5 py-20 text-dim">Sayfa bulunamadı.</p>}
          />
        </Routes>
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
