# Aset Cap dan Tanda Tangan Invoice Privat

Cap dan tanda tangan tidak boleh diletakkan di `apps/frontend/public` atau disimpan di Git. Frontend hanya mengambil aset saat operator terautentikasi membuat export untuk invoice yang valid.

## Menyiapkan aset

1. Gunakan desain cap dan tanda tangan baru. Aset lama yang pernah berada di public bundle dianggap sudah terekspos dan tidak digunakan kembali.
2. Siapkan dua PNG transparan, masing-masing maksimum 2 MiB:
   - `stamp.png`
   - `signature.png`
3. Simpan di `.private/invoice-document-assets/`, yang sudah di-ignore Git. Backend lokal memakai direktori ini otomatis tanpa perubahan `.env`.
4. Untuk deployment rutin, `INVOICE_DOCUMENT_ASSET_HOST_DIR` dapat menunjuk ke direktori terenkripsi di host. Compose memasangnya ke `/run/secrets/invoice-document-assets` secara read-only.

Contoh lokal di PowerShell:

```powershell
New-Item -ItemType Directory -Force .private\invoice-document-assets
Copy-Item C:\secure-assets\stamp-rotated.png .private\invoice-document-assets\stamp.png
Copy-Item C:\secure-assets\signature-rotated.png .private\invoice-document-assets\signature.png
```

`INVOICE_DOCUMENT_ASSET_DIR` hanya diperlukan bila lokasi default lokal ingin dioverride:

```dotenv
INVOICE_DOCUMENT_ASSET_DIR=C:\vibe-private\invoice-document-assets
```

## Alur akses

1. Exporter mengirim cookie session ke `GET /api/invoices/:invoiceId/document-assets/stamp` dan `/signature`.
2. Guard memvalidasi session dan role terbaru. Endpoint hanya menerima `super-admin` atau `admin`.
3. Backend memastikan invoice ada dan tidak berstatus Cancelled.
4. Backend menerima hanya regular file PNG yang tidak kosong dan maksimum 2 MiB.
5. Akses dicatat ke structured application log dengan user ID, role, invoice ID/number, jenis aset, dan waktu log.
6. Respons memakai `Cache-Control: no-store, private` dan `X-Content-Type-Options: nosniff`.
7. Browser mengubah respons menjadi data URL sementara di memori untuk iframe print. Tidak ada static URL atau file aset yang masuk build frontend.

Jika aset belum dikonfigurasi atau tidak valid, export tetap berhasil tanpa cap/tanda tangan dan menampilkan fallback aman. Rotasi cukup mengganti dua file pada secret mount; tidak perlu rebuild frontend.

## Batas keamanan

Operator yang memang berwenang melihat invoice final dapat melihat bitmap melalui browser selama sesi aktif. Mekanisme ini mencegah akses anonim dan caching publik, tetapi tidak dapat mencegah operator berwenang mengambil screenshot. Batasi role, pertahankan log, review akses, dan rotasi aset bila terjadi penyalahgunaan.
