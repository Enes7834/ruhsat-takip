import { useEffect, useRef } from "react";

/**
 * İnce, düşük opasiteli Matrix-tarzı karakter yağmuru — arka plan katmanı.
 * Tema değişince fade/kalem renkleri yeniden hesaplanır. Reduced-motion'da render etmez.
 */
export default function MatrixRain() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const CHARS = "0123456789ABCDEF{}[]<>/\\|+=*01アカサタナハマヤラワ";
    const FONT_SIZE = 14;

    let width = 0;
    let height = 0;
    let cols = 0;
    let drops: number[] = [];
    let raf = 0;
    let last = 0;

    // Tema-farkındalıklı renkler
    let fade = "rgba(8, 14, 28, 0.08)";
    let ink = "rgba(217, 178, 92, 0.38)";
    let head = "rgba(255, 220, 140, 0.75)";

    const refreshColors = () => {
      const isLight = document.documentElement.getAttribute("data-theme") === "light";
      if (isLight) {
        fade = "rgba(244, 246, 251, 0.09)";
        ink = "rgba(184, 145, 63, 0.28)";
        head = "rgba(140, 100, 40, 0.55)";
      } else {
        fade = "rgba(8, 14, 28, 0.08)";
        ink = "rgba(217, 178, 92, 0.38)";
        head = "rgba(255, 220, 140, 0.75)";
      }
    };
    refreshColors();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(width / FONT_SIZE);
      drops = new Array(cols).fill(0).map(() => Math.random() * -50);
    };

    resize();
    window.addEventListener("resize", resize);

    // Tema değişimini dinle
    const observer = new MutationObserver(refreshColors);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      // ~20 fps — enerji tüketimi düşük, göze rahat
      if (now - last < 50) return;
      last = now;

      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, width, height);

      ctx.font = `${FONT_SIZE}px "IBM Plex Mono", ui-monospace, monospace`;
      for (let i = 0; i < cols; i++) {
        const ch = CHARS[Math.floor(Math.random() * CHARS.length)];
        const x = i * FONT_SIZE;
        const y = drops[i] * FONT_SIZE;
        // Damla başı biraz daha parlak — akış hissi
        ctx.fillStyle = head;
        ctx.fillText(ch, x, y);
        ctx.fillStyle = ink;
        ctx.fillText(ch, x, y - FONT_SIZE);
        if (y > height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    };

    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      observer.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 opacity-40 md:opacity-45"
      style={{ zIndex: -1 }}
    />
  );
}
