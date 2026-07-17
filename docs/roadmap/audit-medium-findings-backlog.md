# Backlog Temuan Audit Menengah

Status: backlog aktif  
Tanggal: 17 Juli 2026  
Sumber: audit paralel keamanan, backend/database, frontend, dan operasional.

## 1. Tujuan

Dokumen ini menyimpan temuan menengah agar tidak hilang ketika tim fokus pada P0/P1. Item di sini bukan blocker release internal secara default, tetapi harus ditinjau ulang saat:

- modul terkait sedang diubah;
- frekuensi user atau volume data meningkat;
- aplikasi mulai dibuka di luar tim internal;
- terjadi incident yang relevan;
- workstream P0/P1 terkait selesai lebih cepat.

Rencana utama berada di audit-remediation-p0-p1.md.

## 2. Aturan Triage

Status yang diperbolehkan:

| Status | Arti |
|---|---|
| Open | Belum dijadwalkan |
| Planned | Sudah masuk batch/sprint |
| In Progress | Sedang dikerjakan |
| Verified | Fix dan test selesai |
| Accepted | Risiko diterima dengan alasan dan tanggal review |
| Promoted | Naik menjadi P1/P0 |

Setiap item harus memiliki owner, target milestone, test acceptance, dan tanggal review berikutnya sebelum status berubah dari Open.

## 3. Ringkasan

| ID | Area | Temuan | Target default |
|---|---|---|---|
| M-01 | HTTP Security | Error 500 membocorkan pesan internal | Stabilization |
| M-02 | Health | Health publik tanpa throttle menjalankan query DB | Sebelum public pilot |
| M-03 | Auth Operations | Password bootstrap lewat command line | Stabilization |
| M-04 | API Capacity | Pagination dan nested write tanpa hard limit | Sebelum scale/public |
| M-05 | Finance Atomicity | Client invoice dapat tersisa tanpa invoice | Finance hardening |
| M-06 | Auditability | Mutasi group dan audit log tidak atomic | Group hardening |
| M-07 | Date Correctness | Tanggal kalender invalid dinormalisasi diam-diam | Stabilization |
| M-08 | API Contract | DTO draft tidak sama dengan runtime Prisma | Contract cleanup |
| M-09 | Frontend Form | Edit user dapat reset saat role selesai load | UX stabilization |
| M-10 | Accessibility | Dialog Profile tersembunyi dari accessibility tree | P1 Profile follow-up |
| M-11 | Observability | Telemetry invoice dapat menjadi no-op | Operations hardening |
| M-12 | Container | Runtime membawa dev dependency dan berjalan sebagai root | Image hardening |
| M-13 | Supply Chain | Action/image memakai tag mutable | Saat CI/public delivery |
| M-14 | Database Operations | Pembuatan index dapat memblokir write | Sebelum data membesar |
| M-15 | Runbook | Prosedur operasional merujuk capability yang tidak ada | Operations hardening |
| M-16 | Frontend Maintainability | Lint warning dan hook warning belum menjadi gate bersih | Refactor terjadwal |

## 4. M-01 — Sanitasi Error 500

Status: Open  
Lokasi utama: apps/backend/src/http/api-exception.filter.ts

### Risiko

Unhandled Prisma/runtime error dikirim menggunakan exception.message. Pesan dapat mengandung nama tabel, constraint, detail query, atau konfigurasi internal.

### Rekomendasi

1. Untuk non-HttpException, response selalu memakai pesan generik.
2. Sertakan requestId agar support dapat mencari log server.
3. Log exception lengkap hanya di server.
4. Pertahankan pesan bisnis terkontrol untuk status 4xx.
5. Ubah test yang saat ini mengharapkan pesan Boom terekspos.

### Acceptance

- Generic Error menghasilkan 500 dengan pesan generik.
- Log server tetap menyimpan stack/requestId.
- HttpException 400/404 tetap memiliki pesan bisnis yang aman.
- Tidak ada credential/SQL detail di response.

### Promotion Trigger

Naik menjadi P1 sebelum API dapat diakses publik.

## 5. M-02 — Health Endpoint dan Database Load

Status: Open  
Lokasi utama: apps/backend/src/health/health.controller.ts

### Risiko

Endpoint publik melewati throttle tetapi setiap request menjalankan SELECT 1. Flood dapat memenuhi connection pool.

### Rekomendasi

- Pisahkan /health/live tanpa query DB dari /health/ready dengan query DB.
- Batasi readiness pada network monitoring/internal.
- Terapkan throttle atau cache singkat.
- Tambahkan timeout dan concurrency protection.

### Acceptance

Flood liveness tidak menambah query database; readiness tetap mendeteksi koneksi gagal.

## 6. M-03 — Password Bootstrap di Process Arguments

Status: Open  
Lokasi utama: apps/backend/src/bootstrap-super-admin.ts dan docs/deployment-vps-docker.md

### Risiko

Parameter --password dapat tertinggal pada shell history dan process listing.

### Rekomendasi

- Tambahkan hidden TTY prompt atau --password-stdin.
- Hapus contoh password dari command line dokumentasi.
- Jangan log password.
- Rotasi credential jika prosedur lama pernah dipakai di shared host.

### Acceptance

Bootstrap production dapat dilakukan tanpa password muncul di history, command line, atau log.

## 7. M-04 — Hard Limit Collection dan Nested Write

Status: Open  
Lokasi: groups/invoices controller, pagination DTO, create/update group DTO.

### Risiko

Request authenticated dapat mengambil seluruh collection atau membuat nested operation sangat besar. Body 1 MB tidak membatasi jumlah operasi database.

### Rekomendasi

1. Wajibkan default pagination.
2. Tetapkan maximum page size.
3. Batasi audit log limit.
4. Tambahkan ArrayMaxSize dan MaxLength pada nested DTO.
5. Batasi panjang search query.
6. Ukur query plan untuk page terakhir.

### Acceptance

Semua endpoint collection memiliki default dan maximum; payload melebihi limit menghasilkan 400 terkontrol.

## 8. M-05 — Atomicity Client dan Invoice

Status: Open  
Lokasi: apps/backend/src/infrastructure/repositories/prisma/prisma-invoice.repository.ts

### Risiko

Client baru dibuat sebelum group/invoice tervalidasi. Request gagal dapat meninggalkan InvoiceClient yatim.

### Rekomendasi

- Resolusi/create client, validasi group, dan create/update invoice berada pada transaction yang sama.
- Version conflict tidak boleh menyimpan client baru.
- Tambahkan cleanup query untuk client yatim yang sudah ada setelah business review.

### Acceptance

POST/PATCH yang gagal tidak mengubah jumlah InvoiceClient.

## 9. M-06 — Atomicity Group dan Audit Log

Status: Open  
Lokasi: apps/backend/src/groups/application/groups.service.ts

### Risiko

Mutasi dapat commit lalu audit insert gagal, sehingga API mengembalikan 500 walaupun data sudah berubah. Retry dapat menggandakan efek.

### Keputusan yang Diperlukan

Pilih salah satu:

- audit wajib: mutasi dan audit satu transaction;
- audit best-effort: gunakan outbox/retry dan jangan ubah success menjadi 500 setelah commit.

### Acceptance

Simulasi audit failure menghasilkan state dan response konsisten sesuai keputusan.

## 10. M-07 — Validasi Tanggal Kalender

Status: Open  
Lokasi: apps/backend/src/utils/date-helpers.ts dan DTO tanggal.

### Risiko

Input seperti 2026-02-31 dapat diterima dan tersimpan sebagai tanggal Maret.

### Rekomendasi

- Gunakan strict ISO date-only validation.
- Lakukan round-trip year/month/day.
- Tolak timezone pada field date-only.
- Tambahkan boundary leap year.

### Acceptance

Tanggal invalid menghasilkan 400; 2024-02-29 valid dan 2026-02-29 invalid.

## 11. M-08 — Kontrak Hotel Agreement Draft

Status: Open  
Lokasi: hotel-agreement-draft.dto.ts dan prisma-hotel-agreement-draft.repository.ts

### Risiko

DTO menjanjikan status uppercase serta timestamp wajib, sedangkan runtime mengembalikan label title-case, status partial, dan timestamp berbeda.

### Rekomendasi

1. Tetapkan enum wire-format tunggal.
2. Putuskan apakah PARTIALLY_ASSIGNED bagian kontrak resmi.
3. Mapper memory/Prisma harus sama.
4. Swagger/OpenAPI diperbarui.
5. Tambahkan contract snapshot test.

### Acceptance

Response runtime lolos schema DTO yang sama untuk memory dan Prisma.

## 12. M-09 — Reset Form Edit User

Status: Open  
Lokasi: apps/frontend/src/pages/manage-role/hooks/use-manage-role.ts

### Risiko

Effect reset form bergantung pada role options. Input user dapat hilang ketika query role selesai.

### Rekomendasi

- Reset hanya saat editingUser.id/modal-open berubah.
- Jangan reset field dirty ketika options berubah.
- Perbaiki role saja bila selection tidak valid.
- Tambahkan delayed-query component test.

### Acceptance

Input yang sedang diketik tetap ada ketika role options selesai load.

## 13. M-10 — Accessibility Dialog Profile

Status: Open  
Lokasi: apps/frontend/src/pages/profile-page.tsx

### Risiko

Ancestor dialog memakai aria-hidden dan tidak memiliki focus trap. Screen reader tidak dapat mengakses dialog.

### Rekomendasi

- Hapus aria-hidden dari ancestor dialog.
- Gunakan focus trap bersama.
- Background menjadi inert.
- Fokus awal dan return focus wajib.
- Escape dan close button konsisten.

### Acceptance

Testing Library/axe contract menemukan dialog dan keyboard navigation tidak keluar dari modal.

## 14. M-11 — Telemetry Invoice No-op

Status: Open  
Lokasi: apps/backend/src/logging/telemetry.ts dan create-structured-logger.ts

### Risiko

Logger dibuat saat import sebelum root Pino siap; NOOP logger dapat tersimpan permanen.

### Rekomendasi

- Jadikan telemetry injectable dengan PinoLogger.
- Alternatif: resolve child logger lazily.
- Tambahkan bootstrap integration test ke sink test.
- Dokumentasikan event/metric yang benar-benar tersedia.

### Acceptance

Event invoice terlihat pada structured log setelah bootstrap dan test gagal bila sink no-op.

## 15. M-12 — Container Runtime Hardening

Status: Open  
Lokasi: apps/backend/Dockerfile

### Risiko

Runtime membawa root node_modules termasuk dev dependency dan berjalan sebagai root.

### Rekomendasi

- Prune/install production dependency.
- Salin dist dan artefak Prisma minimal.
- Gunakan USER non-root.
- Pertimbangkan read-only filesystem dan tmpfs bila kompatibel.
- Scan image setelah build.

### Acceptance

Backend start sebagai non-root, test smoke lulus, dan image tidak memuat test tooling/dev dependency utama.

## 16. M-13 — Supply Chain Pinning

Status: Deferred sampai CI/public delivery  
Lokasi: workflow, Dockerfile, compose.

### Risiko

Mutable major tags/digests membuat build berbeda tanpa perubahan repo.

### Rekomendasi

- Pin GitHub Actions ke commit SHA ketika CI diaktifkan.
- Pin production base image ke digest.
- Tetapkan permissions minimum.
- Gunakan Dependabot/Renovate.
- Hasilkan SBOM dan scan container.

### Acceptance

Release dapat direproduksi dari commit dan digest yang tercatat.

## 17. M-14 — Locking pada Migration Index

Status: Open  
Lokasi: migration optimize_database_indexes.

### Risiko

CREATE INDEX non-concurrent dapat memblokir write saat tabel membesar.

### Rekomendasi

- Ukur ukuran tabel/estimasi durasi pada clone.
- Gunakan CREATE INDEX CONCURRENTLY saat diperlukan.
- Set lock_timeout dan statement_timeout.
- Siapkan abort/maintenance plan.
- Jangan mengasumsikan kebutuhan ini mendesak saat tabel masih kecil.

### Acceptance

Migration rehearsal mencatat durasi dan tidak menyebabkan lock di luar budget.

## 18. M-15 — Akurasi Runbook Operasional

Status: Open  
Lokasi: docs/operations-runbook.md

### Risiko

Runbook menyebut db:backfill, feature flag, event, dan observability yang belum tersedia. Saat insiden, operator dapat menjalankan langkah yang tidak valid.

### Rekomendasi

- Tandai capability yang belum tersedia sebagai planned.
- Hapus command yang tidak ada.
- Verifikasi setiap command pada clone.
- Pisahkan runbook current-state dan roadmap.
- Lakukan tabletop/game day.

### Acceptance

Setiap command pada runbook dapat dijalankan dan memiliki expected output/rollback.

## 19. M-16 — Lint dan Maintainability Frontend

Status: Open  
Bukti baseline: lint lulus dengan 77 warning saat audit.

### Risiko

Warning unused code dan React hook dependency dapat menyembunyikan defect serta meningkatkan noise sehingga warning baru diabaikan.

### Rekomendasi

1. Kelompokkan warning: hook correctness, unused production code, unused test code.
2. Selesaikan hook correctness terlebih dahulu.
3. Hapus dead import/helper secara bertahap.
4. Tetapkan warning budget menurun.
5. Setelah nol atau baseline disepakati, gunakan max-warnings pada QA.

### Acceptance

Tidak ada react-hooks correctness warning; jumlah warning memiliki baseline dan tidak boleh bertambah.

## 20. Review Cadence

- Review backlog setelah setiap batch P1.
- Review bulanan selama aplikasi internal aktif.
- Review ulang seluruh item sebelum public pilot.
- Item yang memicu incident langsung dipromosikan ke P1/P0.
- Item Accepted harus memiliki alasan, owner risiko, dan tanggal kedaluwarsa acceptance.
