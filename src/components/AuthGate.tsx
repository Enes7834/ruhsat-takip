import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { inputCls } from "./permits/PermitUI";

/**
 * Supabase bağlıysa giriş zorunlu — RLS politikaları yalnız authenticated
 * kullanıcıya izin veriyor. Supabase yoksa (demo modu) kapı açık kalır.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(!supabase);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!supabase) return <>{children}</>;
  if (!checked) return <p className="mx-auto max-w-7xl px-5 py-20 text-dim">Yükleniyor…</p>;

  if (!session) {
    const onLogin = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setBusy(true);
      setMsg(null);
      const f = new FormData(e.currentTarget);
      const { error } = await supabase!.auth.signInWithPassword({
        email: String(f.get("email")),
        password: String(f.get("password")),
      });
      if (error) setMsg("Giriş başarısız: e-posta veya şifre hatalı.");
      setBusy(false);
    };

    return (
      <section className="mx-auto max-w-sm px-5 py-24">
        <h1 className="font-display text-2xl font-bold text-ink">Ruhsat Takip</h1>
        <p className="mt-2 text-sm text-dim">Devam etmek için giriş yapın.</p>
        <form onSubmit={onLogin} className="mt-8 space-y-3">
          <input name="email" type="email" required placeholder="E-posta" className={inputCls} />
          <input name="password" type="password" required placeholder="Şifre" className={inputCls} />
          {msg && <p className="text-sm font-semibold text-[#ff8f8f]">{msg}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-sm bg-hivis px-6 py-3 text-sm font-semibold text-hivis-ink transition-colors hover:bg-[#e8c67a] disabled:bg-line disabled:text-faint"
          >
            {busy ? "Giriş yapılıyor…" : "Giriş Yap"}
          </button>
        </form>
      </section>
    );
  }

  return <>{children}</>;
}

/** Üst barda gösterilen çıkış butonu — oturum yoksa hiç render edilmez */
export function SignOutButton() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!supabase || !session) return null;
  return (
    <button
      type="button"
      onClick={() => void supabase!.auth.signOut()}
      className="text-xs text-faint hover:text-hivis"
    >
      Çıkış
    </button>
  );
}
