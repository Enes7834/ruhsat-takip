import { useEffect, useState } from "react";

type Theme = "dark" | "light";

function currentTheme(): Theme {
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") return saved;
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  const next = theme === "dark" ? "aydınlık" : "koyu";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`${next} temaya geç`}
      title={`${next} temaya geç`}
      className="grid h-8 w-8 place-items-center rounded-sm border border-line text-dim transition-colors hover:border-hivis hover:text-hivis"
    >
      {theme === "dark" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
