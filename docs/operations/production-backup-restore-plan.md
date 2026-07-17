# Production Backup dan Restore Plan

Status: otomasi repo tersedia; aktivasi production menunggu konfigurasi Operations
Tanggal: 17 Juli 2026
Scope: PostgreSQL production GTT Management System

## 1. Target layanan

| Kontrol | Baseline |
|---|---|
| RPO | Maksimal 6 jam kehilangan transaksi |
| RTO | Maksimal 4 jam sampai layanan operasional kembali |
| Backup rutin | Logical full backup setiap 6 jam |
| Backup release | Satu backup tepat sebelum migration/deployment production |
| Restore drill | Setiap kuartal dan setelah perubahan besar pada schema/backup tooling |
| Lokasi | Satu salinan lokal sementara dan minimal satu salinan off-host terenkripsi |

RPO/RTO ini adalah baseline untuk aplikasi internal. Owner bisnis dapat memperketatnya; perubahan harus dicatat pada runbook dan konfigurasi scheduler.

## 2. Retention

- Backup 6-jam: simpan 7 hari.
- Snapshot harian terakhir: simpan 30 hari.
- Snapshot bulanan terakhir: simpan 12 bulan.
- Backup pre-deployment: simpan minimal sampai dua release berikutnya stabil, paling singkat 30 hari.
- Storage off-host harus memiliki versioning atau immutable retention agar credential production yang bocor tidak dapat langsung menghapus seluruh backup.

Penghapusan dilakukan oleh lifecycle policy storage, bukan script dengan path/glob luas. Dump plaintext pada host production dihapus segera setelah checksum dan upload terenkripsi terverifikasi.

## 3. Proses backup

1. Scheduler berjalan sebagai akun service khusus dengan permission minimum.
2. Buat logical dump PostgreSQL menggunakan `pg_dump` dari container database. Password tidak boleh menjadi argument command atau log.
3. Simpan ke staging directory di luar Git dengan permission hanya untuk akun service.
4. Pastikan proses exit 0 dan file regular/non-empty.
5. Hitung SHA-256 dan simpan manifest berisi timestamp UTC, database, ukuran, checksum, commit/release SHA, dan migration terakhir.
6. Enkripsi sebelum file meninggalkan host. Gunakan KMS/object-storage encryption atau tool host yang kuncinya berasal dari secret manager, bukan `.env` project.
7. Upload ke storage off-host melalui transport TLS.
8. Verifikasi objek off-host tersedia dan checksum ciphertext/metadata sesuai.
9. Hapus dump plaintext staging.
10. Kirim status job dan umur backup terakhir ke monitoring.

Contoh dump manual terkontrol dari direktori deployment:

```bash
mkdir -p .local-backups
chmod 700 .local-backups
docker compose -f docker-compose.prod.yml exec -T postgres \
  sh -c 'pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --clean --no-owner --no-privileges' \
  > .local-backups/production-predeploy.sql
test -s .local-backups/production-predeploy.sql
sha256sum .local-backups/production-predeploy.sql
```

Command manual ini hanya menghasilkan staging dump. File belum dianggap backup valid sebelum terenkripsi, tersalin off-host, dan manifest/checksum terverifikasi.

## 4. Monitoring dan alert

Alert wajib dikirim bila salah satu kondisi berikut terjadi:

- job backup exit non-zero;
- tidak ada backup sukses selama lebih dari 7 jam;
- file kosong atau checksum gagal;
- upload off-host gagal;
- lifecycle policy atau versioning storage berubah;
- restore drill melewati jadwal kuartalan.

Operator melakukan pengecekan harian atas freshness. Review bulanan memastikan retention, kapasitas storage, akses akun service, dan alert masih bekerja.

## 5. Restore drill

Restore tidak pernah diuji ke database production. Gunakan host/clone disposable dan nama database yang mengandung `qa` atau `test`.

1. Pilih backup off-host terbaru dan catat manifest/checksum.
2. Unduh melalui kanal terenkripsi lalu verifikasi checksum sebelum dekripsi/restore.
3. Siapkan PostgreSQL disposable dengan versi mayor yang sama.
4. Isi `LOCAL_RESTORE_DATABASE_URL` hanya pada environment operator; target wajib loopback dan bernama `*_qa` atau `*_test`.
5. Jalankan:

```bash
npm run db:restore:local ./.local-backups/production_backup.sql
```

6. Jalankan migration status, readiness, query rekonsiliasi invoice, dan sampling data.
7. Catat waktu mulai/selesai. Drill lulus bila durasi tidak melebihi RTO 4 jam dan data memenuhi pemeriksaan.
8. Hapus database disposable dan dump plaintext setelah evidence non-sensitif disimpan.

## 6. Prosedur insiden dan restore production

Restore production hanya dilakukan bila rollback aplikasi tidak cukup atau database benar-benar rusak/hilang.

1. Incident commander menghentikan write atau mengaktifkan maintenance window.
2. Ambil backup keadaan rusak bila masih memungkinkan untuk forensik.
3. Pilih recovery point bersama owner bisnis berdasarkan manifest dan RPO.
4. Dua orang memverifikasi target, checksum, migration, dan estimasi kehilangan transaksi.
5. Restore ke clone lebih dulu dan jalankan readiness serta rekonsiliasi.
6. Setelah approval incident commander dan Database reviewer, lakukan restore production.
7. Deploy aplikasi yang kompatibel dengan schema hasil restore.
8. Jalankan readiness, login, invoice/group smoke test, dan sampling Finance.
9. Dokumentasikan actual data loss, actual recovery time, root cause, dan tindakan pencegahan.

## 7. Ownership dan evidence

Peran minimum:

- Operations operator: menjalankan scheduler, upload, monitoring, dan drill.
- Database reviewer: memeriksa manifest, restore, migration, dan integritas.
- Business/Finance owner: menyetujui RPO/RTO dan sampling data.

Evidence yang boleh disimpan di artefak audit: timestamp, ukuran, SHA-256, release SHA, migration terakhir, durasi, dan hasil check. Jangan menyimpan credential, encryption key, dump, atau data pribadi di repository.

## 8. Checklist implementasi pertama

- [ ] Tetapkan nama Operations operator dan Database reviewer.
- [ ] Pilih storage off-host dengan encryption, versioning, dan lifecycle policy.
- [x] Sediakan script dan unit scheduler backup setiap 6 jam di repo.
- [ ] Pasang dan aktifkan scheduler pada host production.
- [x] Sediakan health check freshness 7 jam dan webhook kegagalan di repo.
- [ ] Hubungkan webhook ke kanal alert Operations dan uji paging.
- [ ] Jalankan backup pertama dan verifikasi manifest/checksum.
- [ ] Jalankan restore drill pertama pada database disposable.
- [x] Sediakan `docs/operations/audit-evidence-template.md`.
- [ ] Catat hasil backup/drill aktual pada template atau sistem evidence eksternal.
- [ ] Jadwalkan drill berikutnya maksimal tiga bulan setelah drill pertama.

Instruksi aktivasi, dependency, storage prefix, dan command verifikasi tersedia di `docs/operations/production-backup-implementation.md`.
