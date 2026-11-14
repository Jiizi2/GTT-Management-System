# Update VPS: filter Visa Only dan Visa+ pada H-1 Checklist

Branch rilis: `feat/checklist-visa-type-filter-20261114`. Target PR: `master`.
Jalankan setelah PR digabung, dari direktori deployment dan dengan file
environment production yang selama ini dipakai VPS.

Rilis ini menambahkan filter **All Visa Types**, **Visa Only**, dan **Visa+**
pada halaman H-1 Checklist (`/checklist`), lengkap dengan sinkronisasi jumlah
trip pada tombol hari/tipe visa, reset pagination saat filter tipe visa berubah,
serta pemulihan filter lewat **Reset filters**.

Perubahan hanya menyentuh frontend (`apps/frontend`). Cukup build dan recreate
service `web`. Tidak ada migrasi database, seed, perubahan environment, atau
restart backend/PostgreSQL.

## 1. Simpan checkpoint frontend

Jalankan seluruh langkah dalam satu sesi Bash. Ganti `/path/GTT-Management-System`
dengan path repository deployment sebenarnya di VPS.

```bash
set -euo pipefail
cd /path/GTT-Management-System

if [ -n "$(git status --porcelain)" ]; then
  printf '%s\n' 'Ada perubahan lokal di VPS. Selesaikan sebelum update.' >&2
  exit 1
fi

DEPLOY_STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEPLOY_CHECKPOINT=".local-backups/checklist-visa-filter-$DEPLOY_STAMP"
PREVIOUS_WEB_TAG="gtt-web:rollback-checklist-visa-$DEPLOY_STAMP"
umask 077
mkdir -p "$DEPLOY_CHECKPOINT"
git rev-parse HEAD > "$DEPLOY_CHECKPOINT/previous-commit.txt"

PREVIOUS_WEB_CONTAINER="$(docker compose -f docker-compose.prod.yml ps -q web)"
test -n "$PREVIOUS_WEB_CONTAINER"
PREVIOUS_WEB_IMAGE="$(docker inspect --format '{{.Image}}' "$PREVIOUS_WEB_CONTAINER")"
docker image tag "$PREVIOUS_WEB_IMAGE" "$PREVIOUS_WEB_TAG"
printf 'services:\n  web:\n    image: %s\n' "$PREVIOUS_WEB_TAG" > "$DEPLOY_CHECKPOINT/web-rollback.yml"
printf 'Checkpoint rollback: %s\n' "$DEPLOY_CHECKPOINT"
```

Catat path checkpoint yang dicetak untuk kebutuhan rollback.

## 2. Ambil rilis dari `master`

```bash
git fetch origin
git switch master
git pull --ff-only origin master
git log -5 --oneline
git rev-parse HEAD > "$DEPLOY_CHECKPOINT/release-commit.txt"
```

Pastikan commit merge PR filter Visa Only / Visa+ sudah masuk pada checkout. Jika
PR belum digabung ke `master`, hentikan sebelum rebuild container.

## 3. Jalankan backup predeploy

Ikuti [prosedur backup production yang terpasang](production-backup-implementation.md#backup-pertama-dan-pre-deployment).
Set `RELEASE_SHA` pada konfigurasi backup (bila menggunakan systemd unit repo,
di `/etc/gtt/backup.env`) ke commit dalam `release-commit.txt`, lalu jalankan:

```bash
sudo systemctl start gtt-backup-predeploy.service
sudo systemctl show gtt-backup-predeploy.service --property=Result --property=ExecMainStatus
test "$(systemctl show gtt-backup-predeploy.service --property=Result --value)" = "success"
```

Jika VPS memakai mekanisme backup lain, jalankan prosedur backup predeploy
yang berlaku sebelum melanjutkan.

## 4. Build dan recreate container `web`

```bash
docker compose -f docker-compose.prod.yml build web
docker compose -f docker-compose.prod.yml up -d --no-deps web
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=80 web
```

## 5. Verifikasi

Ganti `DOMAIN-APLIKASI` dengan domain production sebenarnya:

```bash
curl --fail --show-error https://DOMAIN-APLIKASI/ > /dev/null
curl --fail --show-error https://DOMAIN-APLIKASI/api/health/live
curl --fail --show-error https://DOMAIN-APLIKASI/api/health/ready
```

Lakukan hard refresh browser (`Ctrl+Shift+R`), buka `/checklist`, lalu cek:

- Tombol **All Visa Types**, **Visa Only**, dan **Visa+** tampil di area filter
  dengan jumlah trip masing-masing.
- Memilih **Visa Only** atau **Visa+** menyaring kartu di **Need Attention**
  dan **Completed**, sekaligus memperbarui jumlah pada tombol filter hari dan
  mengembalikan halaman ke halaman 1.
- Menggabungkan filter hari, tipe visa, agent, dan pencarian bekerja sesuai
  ekspektasi, dan **Reset filters** mengembalikan tipe visa ke **All Visa Types**.

## Rollback frontend

Jika perlu mengembalikan frontend ke versi sebelum update, gunakan path
checkpoint dari langkah 1:

```bash
DEPLOY_CHECKPOINT=".local-backups/checklist-visa-filter-TIMESTAMP-YANG-DICATAT"
test -f "$DEPLOY_CHECKPOINT/web-rollback.yml"
docker compose -f docker-compose.prod.yml -f "$DEPLOY_CHECKPOINT/web-rollback.yml" up -d --no-deps --no-build --force-recreate web
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=80 web
```
