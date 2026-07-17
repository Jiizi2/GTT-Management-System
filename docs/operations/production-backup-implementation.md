# Implementasi Backup Production

Dokumen ini mengaktifkan baseline di `production-backup-restore-plan.md`. Semua command dijalankan pada host deployment Linux oleh Operations. Jangan menjalankan contoh ini dari laptop ke database production.

## Prasyarat dan keputusan wajib

Isi owner berikut di sistem Operations/evidence, bukan dengan credential di Git:

- Operations operator: belum ditetapkan.
- Database reviewer: belum ditetapkan.
- Business/Finance owner: belum ditetapkan.
- Provider/bucket off-host: belum dipilih.

Host membutuhkan Node.js 20+, Docker Compose, `age`, dan `rclone`. Buat age identity pada workstation/secret manager yang terpisah. Host backup hanya menerima public recipient dalam `/run/secrets/gtt-backup-recipients.txt`; private identity untuk dekripsi tidak boleh berada di project atau host production.

Konfigurasikan remote `rclone` memakai credential service account write/read pada satu bucket/prefix backup. Karena akses Docker daemon setara akses host yang tinggi, batasi akun `gtt-backup` dari login interaktif dan dari service lain; jangan gunakan credential database terpisah sebagai argument command.

## Kontrol storage off-host

Sebelum timer diaktifkan, Operations wajib mengaktifkan encryption-at-rest, TLS, versioning, dan immutable/object-lock retention. Terapkan lifecycle per prefix:

| Prefix | Retention minimum |
|---|---:|
| `six-hour/` | 7 hari |
| `daily/` | 30 hari |
| `monthly/` | 12 bulan |
| `predeploy/` | 30 hari dan sampai dua release berikutnya stabil |

Job slot 00:00 UTC juga menyalin objek ke `daily/`; job slot pertama pada tanggal 1 UTC juga menyalin ke `monthly/`. Lifecycle harus menghapus lewat storage policy, bukan script host. Uji bahwa service account host tidak dapat mematikan versioning/object lock atau menghapus versi immutable.

## Instalasi scheduler

1. Buat akun service dan direktori staging/state dengan mode minimum:

   ```bash
   sudo useradd --system --home /var/lib/gtt-backup --shell /usr/sbin/nologin gtt-backup
   sudo usermod --append --groups docker gtt-backup
   sudo install -d -o gtt-backup -g gtt-backup -m 0700 /var/lib/gtt-backup/staging
   sudo install -d -o root -g gtt-backup -m 0750 /etc/gtt /run/secrets
   ```

2. Salin `deploy/backup.example.env` ke `/etc/gtt/backup.env`, isi remote, release SHA, dan webhook monitoring, lalu set owner `root:gtt-backup` dan mode `0640`. Simpan konfigurasi rclone sebagai `/etc/gtt/rclone.conf` dengan owner `root:gtt-backup` dan mode `0640`. Jangan menaruh secret di repo.
3. Salin public age recipient ke `/run/secrets/gtt-backup-recipients.txt` dengan mode `0640` dan owner `root:gtt-backup`.
4. Instal unit dari `deploy/systemd/` ke `/etc/systemd/system/`, lalu jalankan:

   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now gtt-backup.timer gtt-backup-freshness.timer
   systemctl list-timers 'gtt-backup*'
   ```

5. Hubungkan kegagalan unit `gtt-backup.service` dan `gtt-backup-freshness.service` ke monitoring. Unit `gtt-backup-alert@.service` mengirim JSON generik ke `BACKUP_ALERT_WEBHOOK_URL`. Monitoring wajib melakukan paging bila webhook tidak diterima, job gagal, atau freshness lebih dari 7 jam.

## Backup pertama dan pre-deployment

Jalankan backup pertama melalui unit yang sama dengan scheduler:

```bash
sudo systemctl start gtt-backup.service
sudo systemctl status gtt-backup.service
sudo -u gtt-backup node /opt/gtt/scripts/backup-freshness.mjs
```

Job tidak pernah menganggap upload sukses hanya dari exit upload: ciphertext dan manifest diunduh kembali lalu SHA-256 dibandingkan. Dump plaintext, ciphertext staging, dan manifest staging dihapus pada sukses maupun gagal. Metadata sukses terakhir tersimpan dengan mode `0600` pada `BACKUP_STATE_FILE`.

Tepat sebelum migration/deployment, set `RELEASE_SHA` ke commit yang akan dirilis dan jalankan unit pre-deployment. Unit scheduled dan pre-deployment memakai lock yang sama sehingga dua dump tidak berjalan bersamaan:

```bash
sudo systemctl start gtt-backup-predeploy.service
sudo systemctl status gtt-backup-predeploy.service
```

Deployment tidak boleh dilanjutkan bila command exit non-zero.

## Restore drill pertama

1. Pilih ciphertext terbaru dari off-host dan manifest pasangannya. Download keduanya lewat TLS, cocokkan SHA-256 ciphertext, lalu decrypt dengan age identity dari secret manager ke `.local-backups/production_backup.sql` pada host disposable.
2. Gunakan PostgreSQL major 16 dan database loopback bernama `gtt_restore_qa` atau `gtt_restore_test`. Set `LOCAL_RESTORE_DATABASE_URL` hanya pada environment operator.
3. Jalankan `npm run db:restore:local ./.local-backups/production_backup.sql`, readiness, migration status, `scripts/audit-invoice-item-integrity.sql`, dan sampling Finance.
4. Catat hasil menggunakan `audit-evidence-template.md`. Drill lulus jika selesai paling lama empat jam dan seluruh check lulus.
5. Hapus target disposable dan dump plaintext setelah evidence non-sensitif tersimpan. Jadwalkan drill berikutnya maksimal tiga bulan.

Aktivasi production belum selesai sampai owner, provider, lifecycle/object lock, webhook, backup pertama, dan restore drill diisi dan dibuktikan oleh Operations.
