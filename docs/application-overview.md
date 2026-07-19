# Gambaran Aplikasi

GTT memiliki dua area produk dalam satu frontend: **Ops** untuk tim internal dan **Portal Agent** di route `/agent` untuk akses Agent yang tenant-scoped dan read-only. Keduanya dipakai untuk monitoring grup perjalanan, visa, hotel agreement, checklist, dan invoice sesuai hak akses.

## Arsitektur

Monorepo npm workspaces:

- `apps/frontend` — satu React SPA untuk Ops dan Portal Agent
- `apps/backend` — NestJS REST API

Direktori frontend lama `apps/agent-portal` telah dihentikan; source Portal Agent aktif berada di `apps/frontend/src/agent`.

## Modul Fitur

| Modul | Fungsi |
|---|---|
| Overview | Statistik, daftar grup, pencarian, filter aktif/non-aktif |
| Add New Group | Wizard pembuatan grup dengan itinerary dan data visa awal |
| H-1 Checklist | Tugas keberangkatan dekat (driver/bus assignment) |
| Visa Tracking | Status visa, hotel agreement Makkah/Madinah, jadwal Raudhah |
| Visa Tracking | Monitoring visa internal dan detail read-only yang external-friendly di Portal Agent |
| Agreement Inbox | Kelola dan assign hotel agreement draft ke grup |
| Invoice | Daftar invoice, relasi client/grup, create/update invoice |
| Raudhah Reminder | Ringkasan appointment Raudhah dan status cetak tasreh |
| User Management | CRUD akun operasional (super-admin only) |
| Master Data | Kelola opsi kategori master data (super-admin only) |
| Profile | Pengaturan profil operator |

## Peran Pengguna

- `super-admin` — akses penuh termasuk User Management dan Master Data
- `admin` — akses operasional standar
- `agent` — akses Portal Agent ke data milik Agent sendiri, tanpa mutation data operasional

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
