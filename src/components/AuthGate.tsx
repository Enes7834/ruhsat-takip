import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { inputCls } from "./permits/PermitUI";

type Mode = "login" | "forgot" | "reset";

/**
 * Supabase bağlıysa giriş zorunlu — RLS politikaları yalnız authenticated
 * kullanıcıya izin veriyor. Supabase yoksa (demo modu) kapı açık kalır.
 *
 * Ek olarak "Şifremi unuttum" akışı: e-postaya sıfırlama bağlantısı gönderilir,
 * kullanıcı bağlantıya tıklayınca PASSWORD_RECOVERY olayı düşer ve yeni şifre
 * belirleme ekranı açılır.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(!supabase);
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setMode("reset");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!supabase) return <>{children}</>;
  if (!checked) return <p className="mx-auto max-w-7xl px-5 py-20 text-dim">Yükleniyor…</p>;

  const btn =
    "w-full rounded-sm bg-hivis px-6 py-3 text-sm font-semibold text-hivis-ink transition-colors hover:bg-[#e8c67a] disabled:bg-line disabled:text-faint";

  // Kullanıcı e-postadaki sıfırlama linkinden geldi — yeni şifre belirlesin
  if (session && mode === "reset") {
    const onReset = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const pw = String(f.get("password"));
      const pw2 = String(f.get("password2"));
      if (pw.length < 6) return setMsg("Şifre en az 6 karakter olmalı.");
      if (pw !== pw2) return setMsg("Şifreler aynı değil.");
      setBusy(true);
      setMsg(null);
      const { error } = await supabase!.auth.updateUser({ password: pw });
      setBusy(false);
      if (error) return setMsg("Şifre güncellenemedi: " + error.message);
      setOk("Şifre güncellendi. Panele yönlendiriliyorsun…");
      setTimeout(() => {
        setMode("login");
        setOk(null);
      }, 1200);
    };
    return (
      <Shell title="Yeni şifre belirle" hint="Bu bağlantı tek kullanımlıktır.">
        <form onSubmit={onReset} className="mt-6 space-y-3">
          <input name="password" type="password" required placeholder="Yeni şifre" className={inputCls} />
          <input name="password2" type="password" required placeholder="Yeni şifre (tekrar)" className={inputCls} />
          {msg && <p className="text-sm font-semibold text-[#ff8f8f]">{msg}</p>}
          {ok && <p className="text-sm font-semibold text-[#5ae5a0]">{ok}</p>}
          <button type="submit" disabled={busy} className={btn}>
            {busy ? "Kaydediliyor…" : "Şifreyi Kaydet"}
          </button>
        </form>
      </Shell>
    );
  }

  if (session) return <>{children}</>;

  if (mode === "forgot") {
    const onForgot = async (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const email = String(new FormData(e.currentTarget).get("email"));
      setBusy(true);
      setMsg(null);
      const { error } = await supabase!.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      setBusy(false);
      if (error) return setMsg("Gönderilemedi: " + error.message);
      setOk("Sıfırlama bağlantısı e-postana gönderildi. Gelen kutunu (ve spam klasörünü) kontrol et.");
    };
    return (
      <Shell title="Şifremi unuttum" hint="Kayıtlı e-postana sıfırlama bağlantısı göndeririz.">
        <form onSubmit={onForgot} className="mt-6 space-y-3">
          <input name="email" type="email" required placeholder="E-posta" className={inputCls} />
          {msg && <p className="text-sm font-semibold text-[#ff8f8f]">{msg}</p>}
          {ok && <p className="text-sm font-semibold text-[#5ae5a0]">{ok}</p>}
          <button type="submit" disabled={busy || !!ok} className={btn}>
            {busy ? "Gönderiliyor…" : "Bağlantı Gönder"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setMsg(null);
              setOk(null);
            }}
            className="w-full text-center text-xs text-dim hover:text-hivis"
          >
            ← Giriş ekranına dön
          </button>
        </form>
      </Shell>
    );
  }

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
    <Shell title="Ruhsat Takip" hint="Devam etmek için giriş yapın.">
      <form onSubmit={onLogin} className="mt-6 space-y-3">
        <input name="email" type="email" required placeholder="E-posta" className={inputCls} />
        <input name="password" type="password" required placeholder="Şifre" className={inputCls} />
        {msg && <p className="text-sm font-semibold text-[#ff8f8f]">{msg}</p>}
        <button type="submit" disabled={busy} className={btn}>
          {busy ? "Giriş yapılıyor…" : "Giriş Yap"}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("forgot");
            setMsg(null);
          }}
          className="w-full text-center text-xs text-dim hover:text-hivis"
        >
          Şifremi unuttum
        </button>
      </form>
    </Shell>
  );
}

function Shell({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section className="mx-auto max-w-sm px-5 py-24">
      <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
      <p className="mt-2 text-sm text-dim">{hint}</p>
      {children}
    </section>
  );
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
