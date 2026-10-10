# Update VPS: penerbangan, itinerary, dan hotel agreement

Rilis ini membawa pilihan bandara Saudi dan input IATA manual, sinkronisasi kota
bandara dari Visa Tracking ke itinerary dan salinan WhatsApp, assignment hotel
agreement ke beberapa grup selama sisa pax mencukupi, serta warna status detail
visa Portal Agent. Perubahan nomor agreement yang sudah masuk `master` ikut
dipertahankan.

Branch rilis: `fix/visa-flight-agreement-sync-20261011`.
Rilis ini tidak menambahkan migrasi database. Langkah migrasi di bawah memastikan
migrasi dari rilis sebelumnya juga sudah terpasang jika VPS tertinggal.
Ops dan Portal Agent tetap dibangun dalam satu container `web`.

Jalankan dengan Bash dari direktori repository yang sudah dipakai deployment.
Ganti `/path/GTT-Management-System` dengan path VPS yang sebenarnya dan gunakan
file `.env` serta `apps/backend/.env` production yang sudah ada.

## 1. Ambil kode

```bash
set -euo pipefail
cd /path/GTT-Management-System

if [ -n "$(git status --porcelain)" ]; then
  printf '%s\n' 'Ada perubahan lokal di VPS. Selesaikan sebelum update.' >&2
  exit 1
fi

git rev-parse HEAD > "$(git rev-parse --git-dir)/vps-before-update-20261011"
git fetch origin
git switch fix/visa-flight-agreement-sync-20261011
git pull --ff-only origin fix/visa-flight-agreement-sync-20261011
```

Jika PR rilis ini sudah digabung, `master` dapat dipakai sebagai pengganti nama
branch pada kedua perintah Git terakhir.

## 2. Backup dan build

Jika backup production sudah dipasang, jalankan
`sudo systemctl start gtt-backup-predeploy.service` dan pastikan perintah berhasil.
Jika belum, gunakan backup manual berikut saat container PostgreSQL masih berjalan:

```bash
umask 077
mkdir -p .local-backups
DB_DUMP=".local-backups/pre-update-$(date -u +%Y%m%dT%H%M%SZ).dump"
docker compose -f docker-compose.prod.yml exec -T postgres sh -c 'exec pg_dump --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" --format=custom' > "$DB_DUMP"
test -s "$DB_DUMP"
docker compose -f docker-compose.prod.yml exec -T postgres pg_restore --list < "$DB_DUMP" > /dev/null
```

Simpan salinan backup di luar VPS. Lanjutkan setelah backup berhasil:

```bash
docker compose -f docker-compose.prod.yml build backend web
docker compose -f docker-compose.prod.yml run --rm backend npm run db:deploy
docker compose -f docker-compose.prod.yml up -d --no-deps backend web
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=80 backend web
```

`db:deploy` menerapkan migrasi yang belum terpasang. Jangan menjalankan seed utama,
`db:migrate`, atau `docker compose down -v` untuk update ini.

## 3. Verifikasi

Ganti `DOMAIN-APLIKASI` dengan domain deployment:

```bash
curl --fail --show-error https://DOMAIN-APLIKASI/api/health/live
curl --fail --show-error https://DOMAIN-APLIKASI/api/health/ready
```

Buka aplikasi dan refresh browser. Pastikan bandara Saudi dan IATA transit bisa
disimpan, kota bandara itinerary mengikuti detail penerbangan, salinan WhatsApp
menggunakan penerbangan grup yang dipilih, dan agreement yang sudah di-assign
masih tersedia untuk grup lain jika sisa pax cukup. Periksa juga detail visa di
`/agent` dengan akun Agent yang sudah ada.

## Rollback kode

Jika update perlu dibatalkan, jalankan dari repository yang sama:

```bash
PREVIOUS_COMMIT="$(cat "$(git rev-parse --git-dir)/vps-before-update-20261011")"
git switch --detach "$PREVIOUS_COMMIT"
docker compose -f docker-compose.prod.yml build backend web
docker compose -f docker-compose.prod.yml up -d --no-deps backend web
```

Rollback ini mengembalikan kode aplikasi. Jika VPS sebelumnya tertinggal migrasi
dan langkah update menerapkan migrasi lama, perubahan schema tersebut tetap ada;
pemulihan database perlu ditangani sesuai
[panduan backup dan restore](production-backup-implementation.md).
