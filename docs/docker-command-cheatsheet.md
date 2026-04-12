# Docker Command Cheat Sheet

Cheat sheet singkat untuk command Docker yang paling sering dipakai di repo ini.

## Bantuan Cepat

```bash
docker --help
docker compose --help
docker <command> --help
docker compose <command> --help
```

## Lihat Resource Docker

```bash
docker ps              # container yang sedang jalan
docker ps -a           # semua container
docker images          # semua image
docker volume ls       # semua volume
docker network ls      # semua network
docker compose ls      # semua project compose
```

## Container Harian

```bash
docker logs <container>
docker logs -f <container>
docker exec -it <container> sh
docker exec -it <container> bash
docker inspect <container>
docker stats
docker stop <container>
docker start <container>
docker restart <container>
docker rm <container>
```

Catatan:

- pakai `sh` jika image tidak punya `bash`
- gunakan nama container dari `docker ps`

## Image Harian

```bash
docker build -t my-app .
docker pull postgres:16-alpine
docker image rm <image>
docker image prune -f
```

## Docker Compose Lokal

File default lokal di repo ini adalah `docker-compose.yml`.

```bash
docker compose up
docker compose up -d
docker compose down
docker compose ps
docker compose logs
docker compose logs -f
docker compose logs -f postgres
docker compose restart
docker compose restart postgres
```

## Docker Compose Production

File production di repo ini adalah `docker-compose.prod.yml`.

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f web
```

## Command yang Relevan untuk Repo Ini

Naikkan database lokal:

```bash
docker compose up -d
```

Lihat service lokal:

```bash
docker compose ps
```

Lihat log database lokal:

```bash
docker compose logs -f postgres
```

Build stack production:

```bash
docker compose -f docker-compose.prod.yml build
```

Jalankan migrasi production:

```bash
docker compose -f docker-compose.prod.yml run --rm backend npm run db:deploy
```

Bootstrap super admin pertama:

```bash
docker compose -f docker-compose.prod.yml run --rm backend npm run auth:bootstrap:superadmin -- --name "Owner" --email "owner@example.com" --password "StrongPassword#2026"
```

Naikkan stack production:

```bash
docker compose -f docker-compose.prod.yml up -d
```

## Masuk ke Service Compose

```bash
docker compose exec postgres sh
docker compose exec backend sh
docker compose -f docker-compose.prod.yml exec backend sh
```

## Bersih-Bersih

```bash
docker compose down
docker compose down -v
docker container prune -f
docker image prune -f
docker volume prune -f
docker system prune -f
```

Peringatan:

- `down -v` akan menghapus volume yang terpasang pada project Compose
- `docker system prune -f` membersihkan resource yang tidak terpakai

## Cek Nama Container

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

## Troubleshooting Singkat

Port bentrok:

```bash
docker compose down
docker ps
```

Container tidak sehat:

```bash
docker compose ps
docker compose logs -f <service>
```

Build ulang tanpa cache:

```bash
docker compose build --no-cache
docker compose -f docker-compose.prod.yml build --no-cache
```
