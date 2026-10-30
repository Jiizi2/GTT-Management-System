# Update VPS: skeleton loading GTT Ops dan Portal Agent

Branch: `feat/frontend-skeleton-loading-20261030`. Target PR: `master`.
Jalankan setelah PR digabung. Gunakan direktori deployment dan file environment
production yang sudah dipakai VPS.

Rilis ini memperbarui frontend: skeleton per bagian, retensi data saat refresh,
error/retry, pembatalan request baca, dan posisi skeleton sesuai konten. Cukup
build dan recreate service `web`. Tidak ada migrasi database, seed, perubahan env
aplikasi, atau restart backend/PostgreSQL yang diperlukan oleh PR ini.

Panduan ini mengasumsikan backend/database sudah mengikuti rilis sebelumnya.
Jika checkout VPS tertinggal rilis backend atau schema lain, terapkan juga
panduan rilis tersebut sebelum menggunakan frontend terbaru.

## 1. Simpan checkpoint image yang sedang berjalan

Jalankan dalam satu sesi Bash. Ganti path repository berikut dengan lokasi VPS.

```bash
set -euo pipefail
cd /path/GTT-Management-System

if [ -n "$(git status --porcelain)" ]; then
  printf '%s\n' 'Ada perubahan lokal di VPS. Selesaikan sebelum update.' >&2
  exit 1
fi

DEPLOY_STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEPLOY_CHECKPOINT=".local-backups/skeleton-loading-$DEPLOY_STAMP"
PREVIOUS_WEB_TAG="gtt-web:rollback-skeleton-$DEPLOY_STAMP"
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

Catat path checkpoint tersebut untuk rollback.

## 2. Ambil kode yang sudah digabung

```bash
git fetch origin
git switch master
git pull --ff-only origin master
git log -5 --oneline
git rev-parse HEAD > "$DEPLOY_CHECKPOINT/release-commit.txt"
```

Pastikan commit/merge skeleton loading sudah ada pada checkout. Jika PR belum
digabung, berhenti sebelum mengganti service.

## 3. Jalankan backup predeploy

Ikuti [prosedur backup production yang terpasang](production-backup-implementation.md#backup-pertama-dan-pre-deployment).
Set `RELEASE_SHA` pada konfigurasi backup ke commit yang tercatat di
`release-commit.txt`. Untuk instalasi systemd bawaan repo, konfigurasi berada di
`/etc/gtt/backup.env`, lalu jalankan:

```bash
sudo systemctl start gtt-backup-predeploy.service
sudo systemctl show gtt-backup-predeploy.service --property=Result --property=ExecMainStatus
test "$(systemctl show gtt-backup-predeploy.service --property=Result --value)" = "success"
```

Jika VPS menggunakan mekanisme backup lain, gunakan prosedur predeploy yang
berlaku di sana. Lanjutkan hanya setelah backup berhasil; kegagalan backup
menghentikan deployment.

## 4. Build dan ganti frontend

```bash
docker compose -f docker-compose.prod.yml build web
docker compose -f docker-compose.prod.yml up -d --no-deps web
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=80 web

RELEASE_WEB_CONTAINER="$(docker compose -f docker-compose.prod.yml ps -q web)"
test -n "$RELEASE_WEB_CONTAINER"
RELEASE_WEB_IMAGE="$(docker inspect --format '{{.Image}}' "$RELEASE_WEB_CONTAINER")"
docker image tag "$RELEASE_WEB_IMAGE" "gtt-web:skeleton-$(git rev-parse --short=12 HEAD)"
```

## 5. Verifikasi

Ganti domain berikut dengan domain aplikasi yang sebenarnya:

```bash
curl --fail --show-error https://DOMAIN-APLIKASI/ > /dev/null
curl --fail --show-error https://DOMAIN-APLIKASI/api/health/live
curl --fail --show-error https://DOMAIN-APLIKASI/api/health/ready
```

Refresh penuh browser (`Ctrl+Shift+R`), lalu periksa:

- Overview, Visa Tracking, detail, Statistik, Invoice, Checklist, Master Data,
  User Management, dan halaman Portal Agent.
- Pemuatan pertama/Slow 3G: skeleton berada dalam frame konten yang sama dan
  berhenti saat respons selesai; banner/bar loading lama tidak muncul.
- Refresh dengan data lama: konten tetap terlihat dengan indikator pembaruan.
- Filter/pagination/navigasi: hasil tidak tertukar dan tombol aksi tetap bekerja.
- Error/retry, empty state, tampilan mobile, serta reduced motion.

## Rollback frontend

Gunakan checkpoint dari langkah pertama. Perintah ini juga dapat dipakai jika
build atau verifikasi rilis baru gagal.

```bash
DEPLOY_CHECKPOINT=".local-backups/skeleton-loading-TIMESTAMP-YANG-DICATAT"
test -f "$DEPLOY_CHECKPOINT/web-rollback.yml"
docker compose -f docker-compose.prod.yml -f "$DEPLOY_CHECKPOINT/web-rollback.yml" up -d --no-deps --no-build --force-recreate web
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=80 web
```

Rollback menggunakan image web sebelumnya. Checkout kode tetap di versi baru;
backend, database, dan file environment aplikasi tidak berubah. Refresh penuh
browser setelah rollback dan ulangi verifikasi.
