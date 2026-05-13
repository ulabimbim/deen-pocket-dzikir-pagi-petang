# Deen Pocket: Dzikir Pagi & Petang

Static vanilla PWA untuk membaca dzikir pagi dan petang secara card-by-card.

## Struktur

- `index.html`, `styles.css`, `app.js`: aplikasi utama.
- `data/dzikir.json`: hasil konversi dari XLSX.
- `content/dzikir-pagi-petang.xlsx`: sumber konten asli.
- `manifest.json`, `service-worker.js`, `icons/`: kebutuhan PWA.
- `scripts/build_assets.py`: konversi XLSX ke JSON dan generator icon.

## Menjalankan lokal

```bash
python3 -m http.server 4173
```

Buka `http://localhost:4173`.

## Regenerate data dan icon

```bash
/Users/widirosa/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/build_assets.py
```

## Verifikasi lokal

Dengan server lokal masih berjalan:

```bash
NODE_PATH=/Users/widirosa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/widirosa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/verify_pwa.cjs
```

## Catatan support

CTA dukungan memakai konstanta `SUPPORT_URL` di `app.js`. Ganti nilai placeholder dengan link dukungan Deen Area sebelum deploy publik.
