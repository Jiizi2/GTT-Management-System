# Agreement Inbox Agent hanya baca

Tanggal: 3 Oktober 2026. Status: perubahan dan validasi lokal selesai; tanpa deployment ke staging atau production.

Pengguna mengganti kebijakan sebelumnya: Agent tidak membuat agreement dan hanya melihat/memantau; revisi juga oleh Admin. Kebijakan ini menggantikan alur kirim/revisi Agent pada [implementasi awal](agent-portal-parity-implementation-20261003.md), [tahap konsistensi data](agent-portal-data-consistency-20261003.md), dan usulan alur histori/revisi berikutnya.

## Perilaku saat ini

- Agent melihat agreement miliknya yang dikelola Admin, termasuk data lama yang sudah ada. Tidak ada penghapusan data atau perubahan kepemilikan.
- Pencarian, filter approval/alokasi, pagination, Muassasah, periode, kapasitas, dan detail group penerima tetap tersedia. Group asing dan catatan internal tetap disaring.
- Tombol kirim/revisi dan seluruh composer/form input dihapus. Petunjuk saat inbox kosong menyebut agreement dari Admin; perubahan diarahkan ke Admin.
- Semua respons agreement Agent memakai `editable: false`, untuk setiap status approval dan kondisi alokasi. UI juga mengabaikan flag editable dari server/cache lama.
- Permission `agreements.write` hanya diberikan kepada principal internal; Agent tetap memiliki `agreements.read`.
- Jalur repository `updateForAgent` dan DTO input Agent yang tidak lagi dipakai telah dihapus. CRUD dan assignment Admin tetap tersedia.
- Tidak ada perubahan schema/migrasi pada tahap ini. Tampilan mengikuti pembaruan UI yang sedang berjalan, tanpa penggantian sistem desain.

| Endpoint Agent | Kebijakan |
| --- | --- |
| GET `/api/agent/agreement-drafts` | Daftar milik principal sesi. |
| GET `/api/agent/agreement-drafts/:id` | Detail milik principal sesi; ID asing menghasilkan 404. |
| POST `/api/agent/agreement-drafts` | Ditolak 403: pembuatan dilakukan Admin. |
| PATCH `/api/agent/agreement-drafts/:id` | Ditolak 403: perubahan dilakukan Admin, tanpa pemeriksaan yang mengungkap keberadaan ID. |

POST/PATCH ditolak di service sebelum repository dipanggil, termasuk payload biasa, field Admin, tanggal tidak valid, dan ID asing. Akun Agent tetap tidak dapat memakai endpoint internal Admin. Pengujian membuktikan permintaan yang ditolak tidak membuat atau mengubah record, sementara perubahan Admin muncul pada daftar/detail Agent setelah refetch.

## Validasi terarah

| Pemeriksaan | Hasil |
| --- | --- |
| Backend `check` dan `check:test` | Lulus. |
| Unit backend agreement dan regresi Admin | 4 file, 22 tes lulus. |
| API Nest/memory | 1 alur otentikasi/isolasi/read-only lulus; 3 alur lain tidak dijalankan pada pemeriksaan terarah ini. |
| Integrasi PostgreSQL | Seluruh 3 suite, 12 tes lulus pada database lokal terpisah `gtt_ops_agent_consistency_20261003_test`. |
| Komponen Agreement Inbox Agent | 11 tes lulus, termasuk flag editable lama, seluruh status approval, empty state, pembaruan Admin, pencarian, dan disclosure/filter alokasi. |
| Unit permission | 2 tes lulus: Agent hanya baca, internal tetap memiliki izin tulis. |
| Frontend check dan build terakhir | Lulus. |
| Browser Edge terarah | 1 tes desktop lulus: Muassasah/pencarian, tidak ada aksi kirim/revisi, detail tetap tersedia, tanpa overflow horizontal atau error runtime. |
| Lint terarah | Frontend 0 error/peringatan; backend 0 error, 4 peringatan deklarasi tidak terpakai pada repository yang sudah ada. |

Database QA terpisah dan Prisma Client yang sudah diverifikasi dari tahap konsistensi data digunakan kembali. Tidak ada regenerasi engine, migrasi baru, perubahan `.env`, penghentian proses pengembangan, atau reset database. Log pengujian tersimpan lokal pada direktori TEMP, dengan nama `gtt-agent-agreement-readonly-api.log` dan `gtt-agent-agreement-readonly-prisma.log`.

Bukti tampilan terarah: `apps/frontend/.impeccable/review/agent-parity/agreement-readonly-desktop.png`. Ini fixture pengujian dan bukan aset aplikasi. Tidak ada workflow redesign, reviewer/documenter baru, atau review semua viewport dalam tahap perubahan akses ini; catatan review tampilan dari pekerjaan lain tetap terpisah.
