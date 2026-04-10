# Dokumentasi Aplikasi (Umum)

Dokumen ini menjelaskan gambaran menyeluruh aplikasi, fitur utama, peran pengguna, dan alur data antar komponen.

## 1. Ringkasan Aplikasi

Dashboard ini dipakai untuk operasional travel/umrah, terutama untuk:

- Monitoring grup perjalanan.
- Penyusunan dan pemeliharaan itinerary.
- Checklist operasional H-1 (driver/bus assignment).
- Tracking status visa, hotel agreement, dan jadwal Raudhah.
- Manajemen invoice.
- Manajemen user dan master data (khusus super-admin).

Arsitektur proyek berbentuk monorepo:

- `apps/frontend`: antarmuka pengguna (web dashboard).
- `apps/backend`: API dan logika domain.

## 2. Modul Fitur Utama

Modul pada dashboard:

- `Overview`: statistik mingguan, daftar grup, pencarian, filter aktif.
- `Add New Group`: wizard pembuatan grup + itinerary + data visa awal.
- `H-1 Checklist`: daftar tugas keberangkatan dekat waktu sekarang (today sampai H+2), termasuk driver assignment.
- `Visa Tracking`: pemantauan status visa, pembayaran, agreement hotel Makkah/Madinah, dan jadwal Raudhah.
- `Invoice`: daftar invoice, client, create/update invoice.
- `Raudhah Reminder`: ringkasan appointment Raudhah dan status cetak tasreh.
- `User Management`: CRUD user operasional (super-admin only).
- `Master Data`: kelola opsi kategori master data (super-admin only).
- `Profile`: pengaturan profil operator.

## 3. Peran Pengguna dan Akses

Akses dasar:

- `super-admin`
- `admin`

Aturan penting:

- Semua endpoint backend memakai auth guard global, kecuali endpoint public.
- Fitur `User Management` dan `Master Data` dibatasi hanya untuk `super-admin`.

## 4. Alur Data End-to-End

Alur umum:

1. User login di frontend (`/api/auth/login`).
2. Backend mengembalikan Bearer token.
3. Token disimpan di browser (localStorage) dan dipakai untuk request berikutnya.
4. Frontend memanggil endpoint `/api/*` untuk sync data.
5. Backend menyimpan/ambil data dari:
   - mode `memory` (default, non-persisten), atau
   - mode `prisma` (persisten ke PostgreSQL).

Polanya bersifat optimistic di frontend:

- UI di-update lebih dulu.
- Sync ke backend dilakukan setelahnya.
- Jika sync gagal dan host lokal, frontend tetap bisa fallback lokal; jika bukan lokal, state bisa di-reset dari backend.

## 5. Mode Runtime Data

Backend mendukung dua mode:

- `DATA_SOURCE=memory`:
  - cepat untuk development awal.
  - data tidak persisten.
  - tersedia dummy/default records di memori.
- `DATA_SOURCE=prisma`:
  - menggunakan PostgreSQL melalui Prisma.
  - data persisten.
  - cocok untuk staging/production.

Di `NODE_ENV=production`, backend mewajibkan `DATA_SOURCE=prisma`.

## 6. Kualitas dan Pengujian

Suite yang tersedia:

- Unit test frontend dan backend.
- Integration test backend (Prisma + database).
- API e2e backend.
- UI e2e frontend (Playwright) dengan backend yang dijalankan saat test.

Pipeline CI di repo juga menggabungkan check + test + build sesuai release flow.

