# Update VPS: performa animasi, modal, dan dropdown

Rilis ini memperpendek transisi halaman, menampilkan daftar dan metrik tanpa jeda,
memperbaiki fokus modal dan pencarian Agent, serta mengurangi render saat mengetik
di form penerbangan/jadwal dan menggunakan dropdown panjang. Animasi ringan tetap
dipertahankan.

Branch PR: `fix/frontend-motion-modal-performance-20261030`, dengan target `master`.
Jalankan panduan ini **setelah PR digabung ke `master`**. Perubahan rilis ini hanya
menyentuh frontend; cukup membangun dan mengganti service `web`. Gunakan direktori
deployment serta file environment production yang sudah ada.

## 1. Simpan titik rollback

Jalankan dalam satu sesi Bash di VPS. Ganti path repository berikut sesuai lokasi
deployment yang sebenarnya.

```bash
set -euo pipefail
cd /path/GTT-Management-System

if [ -n "$(git status --porcelain)" ]; then
  printf '%s\n' 'Ada perubahan lokal di VPS. Selesaikan sebelum update.' >&2
  exit 1
fi

DEPLOY_CHECKPOINT=".local-backups/frontend-performance-$(date -u +%Y%m%dT%H%M%SZ)"
PREVIOUS_WEB_TAG="gtt-web:rollback-frontend-$(date -u +%Y%m%dT%H%M%SZ)"
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

Simpan path checkpoint yang ditampilkan. Tag tersebut mempertahankan image web
yang sedang berjalan. Jika VPS menggunakan prosedur backup predeploy, tetap ikuti
[prosedur backup production yang sudah dipasang](production-backup-implementation.md#backup-pertama-dan-pre-deployment)
sebelum mengganti service; jangan lanjut bila backup yang diwajibkan gagal.

## 2. Ambil kode dan ganti web

```bash
git fetch origin
git switch master
git pull --ff-only origin master

docker compose -f docker-compose.prod.yml build web
docker compose -f docker-compose.prod.yml up -d --no-deps web
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=80 web
```

Langkah ini mengasumsikan backend dan database VPS sudah menjalankan rilis
sebelumnya. Rilis ini tidak memerlukan migrasi, seed, perubahan `.env`, maupun
restart backend/database. Jika VPS tertinggal rilis lain yang memiliki perubahan
backend atau schema, ikuti juga panduan deployment rilis tersebut.

## 3. Verifikasi

Ganti `DOMAIN-APLIKASI` dengan domain yang digunakan:

```bash
curl --fail --show-error https://DOMAIN-APLIKASI/ > /dev/null
curl --fail --show-error https://DOMAIN-APLIKASI/api/health/live
curl --fail --show-error https://DOMAIN-APLIKASI/api/health/ready
```

Refresh penuh browser (`Ctrl+Shift+R`) untuk mengambil entry bundle terbaru.
Periksa:

- perpindahan halaman dan pencarian/filter Agent, termasuk fokus setelah pencarian dibersihkan;
- buka/tutup modal dengan tombol, Escape, dan Tab;
- ketik di Edit Group, jadwal, dan detail penerbangan; data tetap benar saat disimpan;
- dropdown panjang: gulir sampai akhir, cari jika pencarian tersedia, dan pilih dengan keyboard;
- tema terang/gelap serta pengaturan perangkat untuk mengurangi gerakan.

## Rollback web

Gunakan path checkpoint yang dicatat pada langkah pertama. Jika membuka sesi Bash
baru, isi kembali `DEPLOY_CHECKPOINT` dengan path tersebut dari root repository.

```bash
DEPLOY_CHECKPOINT=".local-backups/frontend-performance-TIMESTAMP-YANG-DICATAT"
test -f "$DEPLOY_CHECKPOINT/web-rollback.yml"
docker compose -f docker-compose.prod.yml -f "$DEPLOY_CHECKPOINT/web-rollback.yml" up -d --no-deps --no-build --force-recreate web
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=80 web
```

Rollback ini menyajikan kembali image web sebelumnya. Kode checkout tetap berada
di versi terbaru; backend, database, dan file environment tidak berubah. Refresh
penuh browser setelah rollback dan ulangi pemeriksaan aplikasi.
