# Rencana Remediasi Audit P0/P1

Status: rencana aktif  
Tanggal penyusunan: 17 Juli 2026  
Konteks: internal operations tool yang sudah berjalan di production dan akan dipersiapkan menuju akses publik sesuai roadmap.

## 1. Keputusan Konteks

Rencana ini menggunakan keputusan berikut:

1. Production sudah aktif dan tidak sedang mengalami outage. Temuan migrasi InvoiceItem tidak diperlakukan sebagai alasan rollback otomatis.
2. Migrasi yang berhasil dijalankan belum otomatis membuktikan seluruh invoice historis memiliki line item relasional. Pekerjaan P0 pertama adalah verifikasi read-only dan penutupan bukti, bukan menjalankan backfill secara membabi buta.
3. GitHub Actions belum diimplementasikan sebagai bagian delivery. QA manual adalah release gate resmi untuk saat ini; implementasi CI berada di luar scope rencana ini.
4. Aplikasi masih dipakai tim internal dengan user terbatas. Risiko yang membutuhkan akses internet publik diberi label Public Readiness Gate, tetapi defect integritas data, autentikasi, dan concurrency tetap diprioritaskan.
5. Perubahan P0/P1 tidak boleh mengubah data production tanpa backup, dry run pada clone, query verifikasi, reviewer, dan rollback procedure.

## 2. Definisi Prioritas

| Prioritas | Definisi dalam konteks GTT |
|---|---|
| P0 | Risiko kehilangan/korupsi data atau operasi destruktif lintas environment yang dapat terjadi pada operasi internal saat ini |
| P1 | Defect keamanan, correctness, concurrency, dan reliability yang material tetapi dapat diperbaiki melalui rollout terencana |
| Public Gate | Kontrol yang wajib selesai sebelum pengguna di luar jaringan/tim internal diberi akses |
| Medium Backlog | Temuan valid yang disimpan untuk triage setelah P0/P1 stabil |

## 3. Ringkasan Workstream

| ID | Workstream | Prioritas | Owner utama | Dependensi |
|---|---|---:|---|---|
| P0-01 | Verifikasi integritas InvoiceItem production | P0 closure | Backend/Database | Akses read-only production |
| P0-02 | Hardening restore production-to-local | P0 prevention | Backend/Operations | Tidak ada |
| P1-01 | Jalur QA manual deterministik | P1 | QA/Backend/Frontend | Fondasi script telah diterapkan |
| P1-02 | Semantik PATCH invoice | P1 | Backend Finance | QA API + Prisma |
| P1-03 | Revokasi session dan invariant Super Admin | P1 | Backend Auth | Migration AuthUser |
| P1-04 | Atomic assignment hotel agreement | P1 | Backend Visa/Group | Prisma transaction design |
| P1-05 | Lifecycle auth dan isolasi cache frontend | P1 | Frontend | Kontrak auth backend |
| P1-06 | Profile, password, dan logout yang jujur | P1 | Frontend + Backend Auth | P1-03/P1-05 |
| P1-07 | Domain Save Draft invoice | P1 | Finance Full-stack | Keputusan status draft |
| P1-08 | Sequencing mutasi group frontend | P1 | Frontend Group | Query/mutation contract |
| P1-09 | Trusted proxy dan rate-limit identity | P1 | Backend/Operations | Topologi proxy production |
| P1-10 | Backup, readiness, dan rollback operasional | P1 | Operations/Backend | P0-01/P0-02 |
| PUB-01 | Static signature/stamp dan delivery dokumen | Public Gate | Finance/Security | Kebijakan dokumen |
| PUB-02 | TLS-only exposure dan public hardening | Public Gate | Operations/Security | Domain dan reverse proxy |

## 4. Aturan Eksekusi

Setiap workstream wajib memiliki issue/task ID, owner, reviewer, daftar file, test reproduksi sebelum fix, test sesudah fix, rollout, rollback, bukti pada staging/clone, dan dokumentasi yang diperbarui.

Perubahan database memakai pola expand, migrate, verify, contract. Kolom legacy tidak dihapus pada release yang sama dengan backfill.

## 5. P0-01 — Verifikasi Integritas InvoiceItem Production

### Tujuan

Membuktikan apakah line item invoice historis lengkap setelah migrasi relasional. Karena production sudah berjalan, default action adalah observasi read-only. Backfill hanya dibuat jika ditemukan mismatch.

### Bukti kode

- Kolom legacy masih berada pada Invoice.items.
- Relasi baru berada pada Invoice.itemsRel.
- Migrasi pembuatan InvoiceItem tidak memiliki INSERT/backfill.
- Mapper runtime membaca itemsRel.

### Tahap A — Persiapan

1. Tentukan satu operator database dan satu reviewer.
2. Ambil backup production baru dan catat checksum file.
3. Gunakan akun database read-only.
4. Catat commit aplikasi, migration terakhir, total Invoice, dan total InvoiceItem.
5. Jangan menjalankan migration atau update pada tahap observasi.

### Tahap B — Rekonsiliasi

Jalankan query read-only dan simpan hasilnya sebagai artefak audit:

~~~sql
SELECT
  COUNT(*) AS total_invoice,
  COUNT(*) FILTER (WHERE items IS NOT NULL) AS invoice_with_legacy_items
FROM "Invoice";

SELECT
  COUNT(*) AS total_relational_items,
  COUNT(DISTINCT "invoiceId") AS invoice_with_relational_items
FROM "InvoiceItem";

SELECT
  i.id,
  i."invoiceNumber",
  CASE
    WHEN jsonb_typeof(i.items) = 'array' THEN jsonb_array_length(i.items)
    ELSE 0
  END AS legacy_count,
  COUNT(ii.id)::int AS relational_count
FROM "Invoice" i
LEFT JOIN "InvoiceItem" ii ON ii."invoiceId" = i.id
WHERE i.items IS NOT NULL
GROUP BY i.id, i."invoiceNumber", i.items
HAVING
  CASE
    WHEN jsonb_typeof(i.items) = 'array' THEN jsonb_array_length(i.items)
    ELSE 0
  END <> COUNT(ii.id);
~~~

Lakukan sampling manual untuk invoice Paid, Pending, invoice tertua, invoice terbaru, dan invoice bernilai besar. Bandingkan description, pax, currency, unitPrice, totalPrice, totalPriceIdr, dan total invoice.

### Tahap C — Decision Gate

Jika tidak ada mismatch:

1. Tandai P0-01 verified/closed.
2. Simpan query, hasil, tanggal, commit, dan migration terakhir.
3. Tambahkan migration fixture agar kasus serupa terdeteksi.
4. Jangan membuat backfill yang tidak diperlukan.

Jika ada mismatch:

1. Bekukan edit invoice terdampak pada maintenance window.
2. Buat clone production dan reproduksi mismatch.
3. Definisikan mapping JSON ke InvoiceItem, termasuk field legacy invalid/null.
4. Buat backfill idempoten; invoice yang sudah cocok tidak disentuh.
5. Tambahkan dry-run yang hanya menghasilkan daftar perubahan.
6. Jalankan pada clone dan ulangi rekonsiliasi.
7. Review hasil dengan owner Finance.
8. Jalankan production dalam transaction yang jelas.
9. Pertahankan Invoice.items minimal satu release stabil.

### Test Wajib

- Fixture sebelum migrasi dengan satu dan beberapa item.
- Invoice legacy kosong.
- Invoice yang sebagian sudah memiliki InvoiceItem.
- Backfill dua kali menghasilkan state sama.
- Decimal tidak berubah.
- GET invoice sebelum/sesudah menghasilkan item ekuivalen.

### Rollback dan Definition of Done

Backfill mencatat ID yang dibuat per run; rollback hanya menghapus record run tersebut dan tidak menyentuh Invoice.items.

P0-01 selesai ketika query mismatch nol atau exception bisnis terdokumentasi, sampling Finance disetujui, evidence tersimpan, dan regression test migration tersedia.

## 6. P0-02 — Hardening Restore Production-to-Local

### Tujuan

Command restore-local tidak boleh dapat menjatuhkan schema remote/production atau melaporkan sukses pada restore parsial.

### Perubahan Desain

1. Ganti sumber target dari DATABASE_URL menjadi LOCAL_RESTORE_DATABASE_URL.
2. Tolak host selain localhost, 127.0.0.1, atau ::1.
3. Wajibkan nama database mengandung local, dev, test, atau qa.
4. Tampilkan target tanpa password.
5. Wajibkan konfirmasi dengan mengetik nama database.
6. Validasi backup regular file, readable, dan tidak kosong.
7. Gunakan satu invocation psql dengan --dbname, ON_ERROR_STOP=1, dan --single-transaction.
8. Drop/recreate schema serta restore file harus berada pada transaction yang sama.
9. Banner sukses hanya setelah post-restore check.
10. Jangan menampilkan credential pada log/error.

### Post-restore Checks

- current_database sesuai target;
- tabel _prisma_migrations tersedia;
- migration terakhir repo ditemukan;
- AuthUser, Group, Invoice, dan InvoiceItem tersedia;
- foreign key/index utama tersedia;
- query dasar dan row count berhasil.

### Penanganan Dump

1. Gunakan folder .local-backups/ yang di-ignore.
2. Jangan simpan dump production di root repo.
3. Perlakukan dump sebagai data sensitif.
4. Hapus setelah kebutuhan selesai.
5. Gunakan enkripsi saat transit dan at rest untuk proses rutin.

### Test Matrix

| Kasus | Expected |
|---|---|
| URL remote/production | Ditolak sebelum psql |
| Localhost tetapi nama gtt_ops | Ditolak tanpa marker lokal |
| File tidak ada/kosong | Ditolak |
| psql tidak tersedia | Gagal tanpa mengubah database |
| SQL error di tengah dump | Rollback, exit non-zero |
| Credential salah | Gagal tanpa banner sukses |
| Restore valid | Post-check dan banner sukses |
| Password berkarakter khusus | Tidak rusak oleh shell quoting |

### Rollout

1. Implementasikan fake psql test harness.
2. Uji pada database disposable.
3. Uji dump kecil yang sengaja rusak.
4. Perbarui database-sync-guide.
5. Tambahkan .local-backups/ dan pola dump ke .gitignore.
6. Baru izinkan operator memakai script kembali.

Definition of Done: tidak ada code path restore yang membaca DATABASE_URL; remote selalu ditolak; partial restore rollback; dokumentasi tidak menaruh dump di root.

## 7. P1-01 — Jalur QA Manual Deterministik

### Fondasi yang Sudah Diterapkan

- test:api memakai Vitest langsung;
- test:integration memakai runner terjaga;
- tiga suite Prisma dimasukkan;
- TEST_DATABASE_URL diwajibkan;
- host remote dan nama non-test ditolak;
- lint masuk verify;
- component test masuk qa:full;
- diagnostic Playwright dipisahkan;
- build qa:quick dipakai ulang oleh Playwright.

### Pekerjaan Lanjutan

1. Jalankan qa:quick pada Windows dan Linux.
2. Buat gtt_ops_test baru dan jalankan qa:full.
3. Pastikan suite membersihkan data miliknya.
4. Tambahkan timeout/pesan error konsisten.
5. Simpan template bukti manual: commit, Node, OS, durasi, hasil.
6. Tambahkan regression test guard TEST_DATABASE_URL.
7. Pindahkan output diagnostics ke testInfo.outputPath.
8. Jaga sinkronisasi README, CONTRIBUTING, dan docs/qa.md.

### Acceptance Criteria

- qa:quick exit 0 tanpa PostgreSQL.
- qa:full exit 0 pada database QA baru.
- test:api tidak menjalankan output build.
- integration tidak memakai DATABASE_URL biasa.
- diagnostic suite tidak ada dalam qa:full.
- tidak ada build ganda dalam qa:full.

## 8. P1-02 — Semantik PATCH Invoice

### Implementasi

1. Contract: undefined berarti pertahankan; null berarti clear hanya untuk field nullable.
2. Ambil current invoice lengkap dalam transaction.
3. Bangun Prisma data hanya dari property yang hadir.
4. Jangan gunakan fallback create/default pada update.
5. Pertahankan optimistic version check.
6. Pisahkan mapper create/update.
7. Audit parity memory dan Prisma repository.

### Regression Matrix

- PATCH hanya dueDate;
- PATCH hanya notes;
- clear notes sesuai contract;
- PATCH status tidak mengubah DP;
- PATCH group tidak mengubah client;
- version conflict tidak membuat client baru;
- items tidak berubah bila tidak dikirim.

Rollout backend-first, monitor conflict, dan sampling invoice sebelum/sesudah.

## 9. P1-03 — Revokasi Session dan Invariant Super Admin

### Target Arsitektur

Tambahkan tokenVersion/sessionVersion pada AuthUser. JWT membawa user ID dan version; guard memeriksa isActive, role terkini, dan version.

### Implementasi

1. Migration additive tokenVersion default 0.
2. Sertakan version dalam JWT.
3. Verify menjadi async lookup dengan cache pendek bila perlu.
4. Tolak user hilang, nonaktif, atau version mismatch.
5. Pakai role database terkini.
6. Increment version saat password/role/status berubah atau sesi dicabut.
7. Kurangi access-token lifetime; rancang refresh session revocable bila remember-me tetap dibutuhkan.
8. Sediakan revoke-all-sessions bila diperlukan.

### Invariant Super Admin

1. Bungkus count dan demotion/delete dalam transaction serializable atau advisory lock.
2. Hitung ulang setelah lock.
3. Tolak state nol active Super Admin.
4. Tambahkan concurrent integration test dua Super Admin.

Rollout paling aman untuk internal tool adalah invalidate token lama dan menginformasikan login ulang.

## 10. P1-04 — Atomic Hotel Agreement Assignment

1. Gunakan sourceDraftId sebagai identity runtime tunggal.
2. Inventaris dan backfill assignment legacy tanpa sourceDraftId.
3. Hapus fallback agreementNumber + city dari runtime.
4. Lock per draft dalam transaction.
5. Hitung remaining pax setelah lock.
6. Create/update memakai transaction client sama.
7. Tolak total pax melebihi kapasitas.
8. Evaluasi unique constraint draft/group.
9. Update/unassign hanya berdasarkan sourceDraftId.

Test wajib: assignment paralel melebihi kapasitas, dua draft dengan natural key sama, unassign terisolasi, partial assignment, retry idempoten, parity memory/Prisma.

## 11. P1-05 — Lifecycle Auth dan Isolasi Cache Frontend

1. Persisted session hanya placeholder, bukan sumber kebenaran.
2. Selalu validasi /auth/session pada mount dan reconnect/focus relevan.
3. Tangani expiry dengan timer.
4. Saat logout/pergantian principal: cancel query, cancel mutation yang memungkinkan, hapus cache non-auth, clear storage, reset controller.
5. Pertimbangkan QueryClient baru per principal.
6. Scope query key dengan user/tenant saat portal Agent dibangun.
7. Gunakan satu logout mutation untuk semua entry point.

Regression: cookie valid tanpa storage, storage lama tanpa cookie, user A ke user B, logout endpoint gagal, session expire saat tab terbuka, dan multi-tab.

## 12. P1-06 — Profile, Password, dan Logout

Sampai endpoint tersedia, UI tidak boleh menyatakan sukses. Pilih implementasi penuh atau nonaktifkan action.

Implementasi penuh:

1. Profile membaca session/backend.
2. Update profile memvalidasi uniqueness/authorization.
3. Change password memverifikasi password lama.
4. Password change menaikkan tokenVersion.
5. Semua logout memakai flow sama.
6. Bedakan kegagalan revoke server dari local cleanup.
7. Dialog memakai focus trap dan tidak berada pada ancestor aria-hidden.

## 13. P1-07 — Domain Save Draft Invoice

### Keputusan Wajib

Pilih Draft sebagai status Invoice yang sama atau entity/endpoint terpisah. Jangan mempertahankan tombol jika backend tidak memiliki semantik draft.

### Implementasi

1. Definisikan transition Draft ke Pending/Issued.
2. Definisikan field minimum draft.
3. Tambahkan contract backend eksplisit.
4. Pisahkan validasi draft/final.
5. Draft tidak masuk outstanding/overdue.
6. Tambahkan audit publish/finalize.
7. Hilangkan globalIsDraftSubmit.

Test: save parsial, reload, edit, finalize, draft tidak masuk workflow operasional, Generate memakai validasi penuh.

## 14. P1-08 — Sequencing Mutasi Group

1. Ganti request ID global dengan key per group/operation.
2. Serialisasikan mutation aggregate sama.
3. Simpan rollback snapshot per mutation.
4. Jangan abaikan onError/onSettled request lama.
5. Selalu reconciliation/invalidation setelah selesai.
6. Tampilkan conflict backend.

Test delayed promise: A lambat sukses/B cepat gagal, A gagal/B sukses, dua group paralel, unmount saat request.

## 15. P1-09 — Trusted Proxy dan Rate-limit Identity

1. Dokumentasikan jumlah proxy hop production.
2. Untuk satu proxy, Nginx menimpa X-Forwarded-For dengan remote address.
3. Backend hanya mempercayai hop/subnet diketahui.
4. Test spoofed X-Forwarded-For.
5. Limiter login menggabungkan IP dan normalized identifier.
6. Tambahkan edge/nginx rate limit.

Acceptance: rotasi header klien tidak menghasilkan bucket baru.

## 16. P1-10 — Backup, Readiness, dan Rollback

1. Backup production terjadwal.
2. Salinan terenkripsi off-host.
3. Retention, RPO, RTO.
4. Monitoring keberhasilan backup.
5. Restore drill berkala.
6. Pisahkan liveness/readiness.
7. Readiness memverifikasi migration repo.
8. Tag release dengan commit SHA.
9. Dokumentasikan rollback dan kompatibilitas schema.
10. Gunakan expand/contract migration.

## 17. Public Readiness Gates

### PUB-01 — Tanda Tangan dan Cap

- Hapus aset autentik dari public static directory.
- Anggap file yang pernah dipublikasi telah terekspos.
- Tentukan gambar tanda tangan versus digital signature.
- Sajikan dokumen final melalui endpoint berotorisasi dan audit download.
- Rotasi desain jika risiko pemalsuan material.

### PUB-02 — TLS dan Perimeter

- Jangan buka HTTP langsung ke internet.
- TLS wajib sebelum login publik.
- Redirect HTTP ke HTTPS dan aktifkan HSTS setelah stabil.
- Cookie Secure wajib.
- Audit CSP, CORS, origin, upload/download, dan headers.
- Threat model portal Agent dan tenant isolation sebelum pilot.

## 18. Urutan Delivery

1. Batch A — P0-01, P0-02, lalu qa:quick.
2. Batch B — P1-02 dan P1-04.
3. Batch C — P1-03, P1-05, P1-06 backend-first.
4. Batch D — P1-07 dan P1-08.
5. Batch E — P1-09 dan P1-10.
6. Batch F — PUB-01, PUB-02, lalu review roadmap Agent.

## 19. Verification Matrix

| Area | Unit | Component | API | Prisma | Playwright | Production evidence |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Invoice migration | Ya | - | Ya | Wajib | Sampling | Wajib |
| Restore safety | Ya | - | - | Disposable DB | - | Tidak menyentuh prod |
| PATCH invoice | Ya | - | Ya | Wajib | Opsional | Sampling |
| Auth revocation | Ya | Ya | Ya | Wajib | Wajib | Login ulang |
| Hotel assignment | Ya | Ya | Ya | Concurrency | Opsional | Monitor kapasitas |
| Frontend cache | Ya | Wajib | Ya | - | Wajib | Internal smoke |
| Save Draft | Ya | Wajib | Ya | Wajib | Wajib | Finance approval |
| Group mutations | Ya | Wajib | Ya | Wajib | Wajib | Internal smoke |
| Proxy/rate limit | Ya | - | HTTP | Opsional | - | Nginx verify |

## 20. Template Penutupan

- ID:
- Owner:
- Reviewer:
- Commit:
- Tanggal:
- Risiko sebelum:
- Perubahan:
- Test reproduksi:
- Test sesudah:
- Hasil qa:quick:
- Hasil qa:full:
- Rollout:
- Rollback:
- Evidence production/staging:
- Dokumentasi:
- Sisa risiko:
