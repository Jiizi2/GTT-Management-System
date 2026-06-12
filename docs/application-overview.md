# Gambaran Aplikasi

Dashboard operasional Umrah untuk tim internal. Dipakai untuk monitoring grup perjalanan, penyusunan itinerary, checklist keberangkatan, tracking visa dan hotel agreement, manajemen invoice, serta administrasi user dan master data.

## Arsitektur

Monorepo npm workspaces:

- `apps/frontend` — React SPA (dashboard web)
- `apps/backend` — NestJS REST API

## Modul Fitur

| Modul | Fungsi |
|---|---|
| Overview | Statistik, daftar grup, pencarian, filter aktif/non-aktif |
| Add New Group | Wizard pembuatan grup dengan itinerary dan data visa awal |
| H-1 Checklist | Tugas keberangkatan dekat (driver/bus assignment) |
| Visa Tracking | Status visa, hotel agreement Makkah/Madinah, jadwal Raudhah |
| Agreement Inbox | Kelola dan assign hotel agreement draft ke grup |
| Invoice | Daftar invoice, relasi client/grup, create/update invoice |
| Raudhah Reminder | Ringkasan appointment Raudhah dan status cetak tasreh |
| User Management | CRUD akun operasional (super-admin only) |
| Master Data | Kelola opsi kategori master data (super-admin only) |
| Profile | Pengaturan profil operator |

## Peran Pengguna

- `super-admin` — akses penuh termasuk User Management dan Master Data
- `admin` — akses operasional standar

## Alur Data

1. User login di frontend → token di-set sebagai HttpOnly cookie oleh backend.
2. Frontend memverifikasi sesi via `/api/auth/session`.
3. Request ke `/api/*` dikirim dengan `credentials: "include"` (cookie-based).
4. Backend menyimpan data ke memory (dev) atau PostgreSQL via Prisma (production).

## Mode Runtime Backend

| Mode | Keterangan |
|---|---|
| `DATA_SOURCE=memory` | Default dev, non-persisten, tidak butuh database |
| `DATA_SOURCE=prisma` | Persisten ke PostgreSQL, wajib di `NODE_ENV=production` |

## Pengujian

- Unit test frontend dan backend
- Integration test backend (Prisma + database)
- API e2e backend
- UI e2e frontend (Playwright)
