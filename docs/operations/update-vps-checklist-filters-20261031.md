# Update VPS: filter hari dan pengelompokan H-1 Checklist

Branch: `feat/checklist-day-filters-20261031`. Target PR: `master`.
Jalankan setelah PR digabung, dari direktori deployment dan dengan file
environment production yang selama ini dipakai VPS.

Rilis ini menambahkan filter All Days, Today, Tomorrow, dan In 2 Days; pencarian
nomor/nama grup termasuk grup terkait; serta panel trip per grup di bagian Need
Attention dan Completed. Pagination mengikuti jumlah grup. Draft driver tetap
tersimpan selama pengguna mengganti filter.

Cukup build dan recreate service `web`. PR ini tidak memerlukan migrasi database,
seed, perubahan environment, atau restart backend/PostgreSQL. Panduan ini
mengasumsikan VPS sudah mengikuti rilis sebelumnya, termasuk skeleton loading
PR #136. Jika VPS tertinggal rilis lain, periksa juga perubahan dan panduan
deployment rilis tersebut sebelum melanjutkan.

## 1. Simpan checkpoint frontend

Jalankan seluruh langkah dalam satu sesi Bash. Ganti path repository berikut
dengan direktori deployment sebenarnya.

```bash
set -euo pipefail
cd /path/GTT-Management-System

if [ -n "$(git status --porcelain)" ]; then
  printf '%s\n' 'Ada perubahan lokal di VPS. Selesaikan sebelum update.' >&2
  exit 1
fi

DEPLOY_STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DEPLOY_CHECKPOINT=".local-backups/checklist-filters-$DEPLOY_STAMP"
PREVIOUS_WEB_TAG="gtt-web:rollback-checklist-$DEPLOY_STAMP"
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

Catat path checkpoint yang dicetak untuk rollback.

## 2. Ambil rilis yang sudah digabung

```bash
git fetch origin
git switch master
git pull --ff-only origin master
git log -5 --oneline
git rev-parse HEAD > "$DEPLOY_CHECKPOINT/release-commit.txt"
```

Pastikan commit/merge PR filter checklist ada pada checkout. Jika PR belum
digabung, berhenti sebelum mengganti service.

## 3. Jalankan backup predeploy

Ikuti [prosedur backup production yang terpasang](production-backup-implementation.md#backup-pertama-dan-pre-deployment).
Set `RELEASE_SHA` pada konfigurasi backup ke commit dalam `release-commit.txt`.
Untuk instalasi systemd bawaan repo, konfigurasi berada di `/etc/gtt/backup.env`:

```bash
sudo systemctl start gtt-backup-predeploy.service
sudo systemctl show gtt-backup-predeploy.service --property=Result --property=ExecMainStatus
test "$(systemctl show gtt-backup-predeploy.service --property=Result --value)" = "success"
```

Jika VPS memakai mekanisme backup lain, jalankan prosedur predeploy yang berlaku
di sana. Lanjutkan setelah backup berhasil.

## 4. Build dan ganti frontend

```bash
docker compose -f docker-compose.prod.yml build web
docker compose -f docker-compose.prod.yml up -d --no-deps web
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=80 web
```

## 5. Verifikasi

Ganti domain berikut dengan domain aplikasi sebenarnya:

```bash
curl --fail --show-error https://DOMAIN-APLIKASI/ > /dev/null
curl --fail --show-error https://DOMAIN-APLIKASI/api/health/live
curl --fail --show-error https://DOMAIN-APLIKASI/api/health/ready
```

Refresh penuh browser (`Ctrl+Shift+R`), lalu buka H-1 Checklist:

- Pilih Today, Tomorrow, dan In 2 Days. Trip yang tampil mengikuti hari pilihan;
  jumlah pada tombol mengikuti pencarian dan filter agent.
- Cari nomor atau nama grup, termasuk nomor/nama grup terkait. Panel grup terbuka
  saat pencarian dan menampilkan trip yang sesuai.
- Buka panel grup di Need Attention dan Completed. Periksa detail trip, jumlah
  grup/trip, serta pagination. Mengganti filter mengembalikan halaman ke awal.
- Coba pencarian tanpa hasil, lalu Reset filters. Hasil kosong tidak menampilkan
  status Clear; reset mengembalikan semua hari, agent, dan pencarian.
- Isi draft driver tanpa menekan Confirm, ganti filter hari, lalu kembali.
  Draft tetap ada. Gunakan data uji untuk memverifikasi penyimpanan assignment.
- Periksa skeleton saat pemuatan dan pesan retry jika request gagal.

## Rollback frontend

Gunakan path checkpoint yang dicatat pada langkah pertama:

```bash
DEPLOY_CHECKPOINT=".local-backups/checklist-filters-TIMESTAMP-YANG-DICATAT"
test -f "$DEPLOY_CHECKPOINT/web-rollback.yml"
docker compose -f docker-compose.prod.yml -f "$DEPLOY_CHECKPOINT/web-rollback.yml" up -d --no-deps --no-build --force-recreate web
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=80 web
```

Rollback memakai image frontend sebelumnya; checkout kode tetap di versi baru.
Refresh penuh browser dan ulangi verifikasi endpoint serta checklist.
