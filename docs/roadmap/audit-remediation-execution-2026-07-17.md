# Eksekusi Remediasi Audit P0/P1 — 17 Juli 2026

Status dokumen ini membedakan perubahan codebase dari pekerjaan yang membutuhkan akses production, reviewer, atau keputusan operasional eksternal.

| ID | Status repo | Bukti / sisa gate |
|---|---|---|
| P0-01 | Closed berdasarkan konfirmasi owner | Rekonsiliasi read-only pada dump 17 Juli: 16 invoice, 25 `InvoiceItem`, seluruh 16 invoice memiliki item relasional, dan mismatch nilai `Invoice.amount` terhadap jumlah `InvoiceItem.totalPriceIdr` = 0. Satu selisih count JSON legacy pada `GTT/INV/2026/0016` diklasifikasikan sebagai snapshot legacy stale: invoice diperbarui 13 Juli menjadi dua item dengan total relasional tepat Rp25.308.030, sedangkan JSON lama masih satu item. Owner mengonfirmasi invoice aman; tidak ada backfill yang diperlukan. |
| P0-02 | Implemented | Restore hanya membaca `LOCAL_RESTORE_DATABASE_URL`, menolak remote/nama tanpa marker lokal, mewajibkan konfirmasi, menjalankan satu `psql --single-transaction` dengan `ON_ERROR_STOP`, melakukan post-check, meredaksi credential, dan memiliki test safety. |
| P1-01 | Closed | Runner Windows diperbaiki agar memakai `npm_execpath` dan memiliki regression guard untuk URL kosong/remote/non-test. Fresh database QA lokal dibuat, seluruh 32 migration direplay, dan `qa:full` lulus di Windows. Owner menerima production Linux yang sudah berjalan sebagai bukti kompatibilitas Linux. |
| P1-02 | Implemented | PATCH mempertahankan property yang absent untuk notes, status, DP, client/group, description, recipient, amount, dan items; optimistic version tetap aktif dan konflik diperiksa sebelum pembuatan client. Memory/Prisma parity diperbarui. |
| P1-03 | Implemented dan concurrency verified | Migration `tokenVersion`, lookup user aktif/role terbaru pada guard, revocation saat role/password berubah, lifetime 1 jam/24 jam, dan invariant Super Admin memakai transaction serializable plus advisory lock. Integration test concurrent demotion membuktikan tepat satu operasi ditolak dan satu active Super Admin tetap ada. Rollout wajib login ulang setelah migration/deploy. |
| P1-04 | Implemented dan fresh-migration verified | Identity runtime hanya `sourceDraftId`; backfill hanya untuk legacy match yang unambiguous; unique draft/group; assignment serializable dengan lock per draft dan capacity check dalam transaction; update/unassign tidak lagi memakai natural-key fallback. Rekonsiliasi dump menemukan 0 legacy assignment ambigu. Prisma sekarang mempersist status `REJECTED` untuk draft kedaluwarsa sebelum mengembalikan 400, sama dengan repository memory. |
| P1-05 | Implemented | Persisted session hanya placeholder; mount/focus/reconnect memvalidasi backend; expiry timer; principal switch/logout membersihkan query/mutation cache non-auth; multi-tab memicu revalidation. |
| P1-06 | Safe-disabled / logout implemented | Edit profile dan change password dinonaktifkan karena endpoint self-service belum ada sehingga UI tidak memberi sukses palsu. Semua logout memakai mutation yang sama dan cleanup lokal tetap berjalan pada kegagalan endpoint. |
| P1-07 | Safe-removed | Tombol Save Draft dihapus karena backend belum memiliki status/entity draft. Generate Invoice tetap memakai validasi final. Implementasi draft penuh memerlukan keputusan domain baru. |
| P1-08 | Implemented | Mutasi aggregate group diserialisasikan, tidak lagi mengabaikan completion/error lama, snapshot tetap per mutation, dan invalidation selalu berjalan pada `finally`. |
| P1-09 | Implemented / topology gate | Nginx menimpa `X-Forwarded-For`, backend mempercayai tepat satu hop saat `TRUST_PROXY=true`, login dan API memiliki edge rate limit, limiter aplikasi tetap memakai IP + normalized identifier. Deployment wajib memastikan backend tidak diekspos langsung. |
| P1-10 | Plan complete / implementation Operations | Liveness/readiness dipisah dan readiness memeriksa migration terakhir. Baseline backup menetapkan RPO 6 jam, RTO 4 jam, dump tiap 6 jam, retention 7 hari/30 hari/12 bulan, encryption off-host, freshness alert 7 jam, pre-deploy backup, dan restore drill kuartalan di `docs/operations/production-backup-restore-plan.md`. Pemasangan scheduler/storage/alert tetap pekerjaan Operations pada production. |
| PUB-01 | Closed dengan historical exception | Cap dan tanda tangan dihapus dari public bundle. Penggantinya memakai secret mount read-only dan endpoint per-invoice yang memvalidasi session/role/status, menolak file non-PNG, memakai `no-store`, dan mencatat akses. Skema privat diterapkan pada production untuk penggunaan berikutnya. Dokumen/aset historis yang sudah berjalan tidak diterbitkan ulang atau diubah; owner menerima risiko historis tersebut. |
| PUB-02 | Partial, deployment gate | Trusted proxy/header hardening tersedia. TLS certificate, redirect HTTPS, dan HSTS harus diterapkan pada reverse proxy/perimeter pemilik domain sebelum akses publik; konfigurasi repo ini tidak mengasumsikan lokasi terminasi TLS. |

## Hasil verifikasi lokal

- Environment: Windows 11 Pro 10.0.26200, Node v20.13.1, baseline commit `4b8c7e7`.
- `npm run qa:full`: PASS, 164 detik pada `gtt_ops_test_audit_20260717_v2`.
- Fresh migration rehearsal: 32/32 migration PASS pada database QA baru.
- Backend unit: 39 files, 251 tests PASS.
- Frontend unit: 17 files, 79 tests PASS.
- Restore safety: 4 tests PASS.
- Integration URL guard: 3 tests PASS.
- Frontend smoke: 15 tests PASS.
- Backend API: 3 tests PASS.
- Frontend component: 34 files, 523 tests PASS.
- Prisma integration: 3 files, 8 tests PASS, termasuk concurrent Super Admin dan hotel assignment.
- Playwright Edge: 9 tests PASS.
- Invoice reconciliation: 16 invoice, 25 item relasional, canonical amount mismatch 0; satu exception JSON legacy stale terdokumentasi.
- Legacy hotel assignment ambiguity: 0.
- `git diff --check`: PASS.

## Gap yang tidak dapat ditutup dari workstation ini

1. Pemasangan scheduler backup, storage off-host, alert, dan restore drill pertama memerlukan akses Operations production.
2. TLS certificate, redirect HTTPS, HSTS, dan verifikasi bahwa backend tidak terekspos langsung memerlukan domain serta reverse proxy/perimeter production.

## Urutan rollout wajib

1. Review dua migration baru dan hasil query legacy hotel assignment pada clone.
2. Backup production baru, catat checksum/commit/migration, lalu restore drill pada clone.
3. Jalankan `qa:full` dengan database QA disposable dan simpan template evidence.
4. Deploy migration additive, kemudian backend, lalu frontend/Nginx. Semua user login ulang.
5. Jalankan readiness, smoke internal, rekonsiliasi InvoiceItem, sampling Finance, dan monitoring conflict/capacity/auth.
6. Jangan membuka akses publik sebelum TLS/perimeter dan delivery dokumen berotorisasi ditutup oleh owner terkait.
