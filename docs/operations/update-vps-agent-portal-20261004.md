# Update VPS dan akun percobaan Portal Agent

PR rilis ini mengirim seluruh perubahan Portal Agent, Agreement Inbox, visa,
ekspor, serta migrasi `20261003090000_add_agreement_draft_muassasah`.
Frontend Ops dan Portal Agent dibangun bersama; tidak ada deployment frontend
Agent terpisah. Jalankan dari direktori repository di VPS memakai Bash.

## 1. Ambil rilis setelah PR digabung

Ganti `/path/GTT-Management-System` dengan direktori aplikasi yang sudah ada.
Jika working tree VPS memiliki perubahan kode lokal, selesaikan dahulu sebelum
pull. Pertahankan file `.env` dan `apps/backend/.env` production yang sudah ada.

```bash
set -euo pipefail
cd /path/GTT-Management-System
git status --short
git fetch origin
git switch master
git pull --ff-only origin master
docker compose -f docker-compose.prod.yml build backend web
```

Untuk mencoba PR sebelum merge, gunakan branch
`feat/agent-portal-parity-20261004` sebagai pengganti `master` pada kedua perintah
Git terakhir. Setelah merge, kembalikan checkout VPS ke `master`.

## 2. Backup sebelum migrasi

Jika layanan backup production sudah dipasang sesuai
[panduan backup](production-backup-implementation.md), jalankan:

```bash
sudo systemctl start gtt-backup-predeploy.service
sudo systemctl status gtt-backup-predeploy.service --no-pager
```

Jika belum dipasang, buat backup manual dengan user yang mempunyai akses Docker
dan hak tulis ke `/var/backups/gtt`. Simpan juga salinannya di luar VPS sebelum
melanjutkan.

```bash
umask 077
mkdir -p /var/backups/gtt
DB_DUMP="/var/backups/gtt/pre-agent-portal-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose -f docker-compose.prod.yml exec -T postgres sh -c 'exec pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom' > "$DB_DUMP"
test -s "$DB_DUMP"
docker compose -f docker-compose.prod.yml exec -T postgres pg_restore --list < "$DB_DUMP" > /dev/null
```

## 3. Migrasi dan jalankan versi baru

```bash
docker compose -f docker-compose.prod.yml run --rm backend npm run db:deploy
docker compose -f docker-compose.prod.yml up -d --no-deps backend web
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=80 backend web
```

Gunakan `db:deploy`, bukan `db:migrate` atau seed utama, di production.
Migrasi baru menambahkan relasi Muassasah opsional pada draft agreement.
Backend production membutuhkan `AGENT_AUTH_SECRET` minimal 32 karakter dan
`AGENT_AUTH_COOKIE_SECURE=true` untuk domain HTTPS. Pertahankan secret yang sudah
digunakan; bila secret belum dikonfigurasi, tambahkan nilai acak tersendiri pada
`apps/backend/.env` sebelum menjalankan backend. Jangan masukkan secret ke Git.

## 4. Buat tepat satu akun percobaan

```bash
docker compose -f docker-compose.prod.yml run --rm backend npm run db:seed:agent-trial
```

Seed ini memilih **Partner Agent aktif dengan jumlah seluruh grup terbanyak di
database VPS**, termasuk grup selesai dan grup turunan. Jika jumlah sama,
kode Agent menentukan urutan. Agent `DIRECT`, Agent nonaktif, dan Agent tanpa
grup tidak dipilih. Data lokal tidak digunakan untuk menentukan Agent VPS.

Output menampilkan nama Agent, jumlah grup, email `portal.trial@ghaniya.local`,
dan password acak yang hanya tampil saat akun pertama kali dibuat. Simpan output
password secara privat dan berikan ke pengguna yang akan mencoba portal. Email
tersebut adalah identifier login; pembuatan akun tidak mengirim email.

Untuk memakai email lain, tentukan **pada pembuatan pertama**:

```bash
docker compose -f docker-compose.prod.yml run --rm backend npm run db:seed:agent-trial -- --email trial@example.com
```

Menjalankan ulang dengan email yang sama mempertahankan akun, password, dan
Agent yang sudah dipilih. Akun nonaktif tidak diaktifkan otomatis. Menggunakan
email berbeda membuat akun berbeda, sehingga gunakan satu email yang sama
selama percobaan. Pembuatan akun dan audit `CREATED` berjalan dalam satu
transaksi; audit CLI tidak mengatasnamakan operator internal.

Seed ini tidak menghapus grup, invoice, user internal, atau akun Agent lain.
Jangan gunakan `npm run db:seed` untuk keperluan ini karena seed utama ditujukan
untuk development dan dapat mereset data.

## 5. Verifikasi melalui domain

```bash
curl --fail --show-error https://DOMAIN-APLIKASI/api/health/live
curl --fail --show-error https://DOMAIN-APLIKASI/api/health/ready
```

Buka `https://DOMAIN-APLIKASI/agent/login` lalu login dengan email dan password
dari output seed. Pastikan nama Agent sesuai, Dashboard dan daftar perjalanan
memuat grup miliknya, detail visa bisa dibuka, dan Agreement Inbox hanya baca.
Jumlah perjalanan pada tampilan dapat lebih sedikit dari jumlah grup karena
grup turunan digabung dalam satu keluarga perjalanan atau filter periode aktif.

Setelah percobaan selesai, nonaktifkan akun melalui pengelolaan akun Portal
Agent dengan Super Admin. Jika password hilang, reset melalui pengelolaan akun
tersebut; menjalankan seed ulang tidak mereset password. Flag
`mustChangePassword` dicatat mengikuti akun portal biasa; pergantian password
tetap mengikuti kemampuan pengelolaan akun yang tersedia.

## Rollback aplikasi

Jika perlu, checkout commit rilis sebelumnya, build ulang `backend web`, lalu
jalankan `up -d --no-deps backend web`. Migrasi Muassasah bersifat penambahan
sehingga kolomnya dapat dibiarkan saat rollback kode. Akun uji tetap persisten
dan dapat dinonaktifkan melalui Super Admin. Jangan jalankan `down -v` karena
perintah itu menghapus volume database.
