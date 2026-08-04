# Duran İnşaat · Ruhsat Takip

Belediye onay ve yapı ruhsatı süreç takip paneli. React 19 + Vite + Tailwind 4 + Supabase.

## Geliştirme

```bash
npm install
npm run dev
```

## Yayına alma (Vercel)

```bash
npx vercel login
npx vercel --prod
```

İlk çalıştırmada proje adı sorulur; `vercel.json` build ve SPA yönlendirmesini hazır tutar.
Sonuçta `https://<proje-adi>.vercel.app` adresi verilir — her cihazdan bu adresle girilir.

## Veri modu

- **Supabase yoksa:** veriler yalnızca açtığın tarayıcıda (localStorage) durur. Başka cihazdan
  girince dosyalar görünmez.
- **Supabase varsa:** tüm cihazlar aynı veriyi görür. Kurulum:
  1. `.env` oluştur: `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY`
  2. `supabase/schema.sql` içeriğini Supabase → SQL Editor'de çalıştır
  3. Vercel → Settings → Environment Variables'a aynı iki değeri ekle, yeniden deploy et

## Erişim

Panel `noindex` olarak yayınlanır (arama motorlarına düşmez). Adresi bilen herkes açabilir;
giriş ekranı için Supabase Auth eklenmesi gerekir.
