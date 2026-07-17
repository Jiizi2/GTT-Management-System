# Panduan Sinkronisasi Database (Production ke Lokal)

Dokumen ini menjelaskan langkah demi langkah untuk menyelaraskan data di komputer lokal Anda agar sama dengan data yang ada di server production VPS secara aman.

---

## Langkah 1: Buat Backup di VPS (Production)

1. Masuk ke VPS Anda menggunakan SSH:
   ```bash
   ssh username@ip_address_vps
   ```
2. Arahkan terminal VPS ke direktori tempat proyek Anda berada (tempat file `docker-compose.prod.yml` disimpan):
   ```bash
   cd /path/to/your/project
   ```
3. Jalankan perintah `pg_dump` dari kontainer Docker Postgres untuk menghasilkan file backup SQL. 
   *(Sesuaikan `<username>` dengan nilai `POSTGRES_USER` yang ada di file `.env` VPS Anda, biasanya `gtt_app` atau `postgres`)*:
   ```bash
   mkdir -p .local-backups
   docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U <username> -d gtt_ops --clean --no-owner --no-privileges > .local-backups/production_backup.sql
   ```
   > [!NOTE]
   > Perintah ini **100% aman** karena hanya membaca data (*Read-Only*) dan tidak akan mengunci tabel atau mengganggu jalannya aplikasi production.

---

## Langkah 2: Unduh File Backup ke Laptop (Lokal)

Unduh file `production_backup.sql` dari VPS ke folder proyek di laptop lokal Anda menggunakan perintah `scp` di terminal laptop Anda:

```bash
# Jalankan perintah ini dari terminal laptop lokal Anda (bukan di dalam VPS)
mkdir -p .local-backups
scp username@ip_address_vps:/path/to/your/project/.local-backups/production_backup.sql ./.local-backups/production_backup.sql
```
*Atau Anda juga bisa menggunakan aplikasi grafis SFTP seperti **FileZilla** atau **WinSCP** untuk mengunduhnya secara manual.*

---

## Langkah 3: Impor (Restore) Data ke Database Lokal

Setelah file ada di folder `.local-backups/` yang di-ignore Git:

1. Pastikan database lokal Anda aktif (jika menggunakan standalone PostgreSQL atau Docker).
2. Isi `LOCAL_RESTORE_DATABASE_URL` di `apps/backend/.env`. Host wajib localhost dan nama database wajib memuat marker `local`, `dev`, `test`, atau `qa`. Script tidak pernah membaca `DATABASE_URL`.
3. Jalankan perintah restore otomatis yang telah disediakan:
   ```powershell
   npm run db:restore:local ./.local-backups/production_backup.sql
   ```

Script menampilkan target tanpa credential dan meminta Anda mengetik nama database. Drop schema, restore, serta pemeriksaan migration/tabel/FK/index dijalankan oleh satu proses `psql` dengan `ON_ERROR_STOP` dalam satu transaction. Error SQL membatalkan seluruh restore dan tidak menampilkan banner sukses.

---

## Langkah 4: Bersihkan File Backup (Opsional)

Setelah proses impor sukses, Anda bisa menghapus file backup untuk menjaga keamanan data:
- Di lokal: hapus `.local-backups/production_backup.sql` setelah kebutuhan selesai.
- Di VPS: hapus `.local-backups/production_backup.sql` setelah transfer terverifikasi.

Dump production adalah data sensitif. Gunakan kanal terenkripsi (SSH/SCP), storage terenkripsi, batasi permission file, dan jangan pernah mengunggahnya ke Git atau membagikannya melalui kanal chat.
