# Konsistensi data Agreement Admin–Agent

Tanggal: 3 Oktober 2026. Status: implementasi dan validasi lokal selesai. Tidak ada deployment ke staging atau production.

Kebijakan akses terbaru: [Agreement Inbox Agent hanya baca](agent-portal-agreement-readonly-20261003.md). Agent tidak lagi mengirim atau merevisi draft; uraian revisi di bawah mencatat perilaku saat tahap konsistensi ini selesai. Data Muassasah, approval, alokasi, kapasitas, dan batas kepemilikan tetap digunakan.

Tahap ini melanjutkan [implementasi Portal Agent](agent-portal-parity-implementation-20261003.md) dan memakai penambahan Muassasah yang sudah berjalan di Admin. Perubahan tampilan dibatasi pada informasi Muassasah di Agreement Inbox Agent; pengembangan tampilan portal yang sedang berlangsung dipertahankan.

## Perilaku yang diselaraskan

| Data | Perilaku |
| --- | --- |
| Muassasah | Kedua portal membaca ID draft dan nama terbaru dari direktori yang sama. Agent melihat pilihan Admin, termasuk referensi yang kemudian dinonaktifkan. Referensi yang dihapus tampil sebagai belum dipilih. |
| Revisi Agent | Hanya metadata hotel yang diizinkan masuk ke payload tulis. Muassasah dan catatan internal Admin dipertahankan; approval kembali menjadi `WAITING`. |
| Approval dan assignment | Status approval tetap terpisah dari alokasi. Label alokasi kedua portal menggunakan `Assigned` atau `Unassigned`, termasuk alokasi parsial; sisa kapasitas tetap ditampilkan. Approval dan assign/unassign tetap oleh Admin. |
| Kapasitas | Repository memory dan Prisma menghitung kapasitas tersisa dari pemakaian tertinggi per malam, dengan check-out tidak ikut sebagai malam inap. |
| Identitas agreement | `sourceDraftId` yang tersedia menjadi acuan utama. Nomor agreement yang sama pada draft berbeda tidak mencampur alokasi atau cascade revisi di memory. Fallback nomor/kota dipertahankan hanya untuk record memory legacy tanpa ID sumber. |
| Alokasi legacy lintas Agent | Kapasitas total dan larangan edit tetap konsisten dengan Admin. Daftar penerima hanya memuat group milik Agent; identitas group asing dan penanda internal `hasAllocations` tidak dikirim. Filter alokasi Agent mengikuti status yang diberikan server. |

Contoh kapasitas: agreement 10 pax dengan alokasi 6 pax pada 5–7 Oktober dan 6 pax pada 7–10 Oktober menyisakan 4 pax. Alokasi tanggal terpisah tidak dijumlahkan menjadi 12 pax pada malam yang sama.

Pencarian Agent dapat memakai nama Muassasah yang terhubung ke draft miliknya. Tidak ada pemilih Muassasah atau akses katalog Master Data baru untuk Agent. Payload API yang mencoba mengubah `muassasahId`, `muassasahName`, catatan, kepemilikan, approval, atau assignment ditolak. Proyeksi baca tetap menyaring field internal dan membatasi referensi direktori pada draft milik principal sesi.

Nama direktori diselesaikan ulang setiap respons API. UI menggunakan cache query yang sudah ada; perubahan Admin terlihat setelah refetch/Muat ulang, tanpa penambahan push real-time. GET Agent tetap merupakan operasi baca dan tidak memicu expiry approval 24 jam milik alur Admin.

## Bukti validasi

| Pemeriksaan | Hasil |
| --- | --- |
| Backend `check` dan `check:test` | Lulus. |
| Unit backend penuh | 59 file, 362 tes lulus. |
| Unit backend terkait agreement dan direktori | 4 file, 33 tes lulus; meliputi nama terkini/inaktif/dihapus, pelestarian metadata Admin, isolasi Agent, kapasitas per malam, ID sumber, dan alokasi legacy. |
| API Nest/memory | 1 alur otentikasi dan agreement lulus; 3 alur lain tidak dijalankan pada pemeriksaan terarah ini. Meliputi field terlarang, revisi, data privat, foreign ID, dan kesamaan respons setelah assignment. |
| Integrasi PostgreSQL | Seluruh 3 suite, 12 tes lulus di database lokal terpisah `gtt_ops_agent_consistency_20261003_test`. Seluruh 51 migrasi repository, termasuk Muassasah, berhasil diterapkan. |
| Frontend `check`, build, dan unit kontrak Admin | Lulus; 3 tes unit kontrak lulus. |
| Komponen Agreement Inbox Agent | 7 tes lulus: pengiriman/revisi, Muassasah, pencarian, draft lama, readonly, filter alokasi, dan kegagalan simpan. |
| Browser terarah | 1 tes Edge desktop lulus pada halaman agreement; nama Muassasah panjang terlihat, pencarian bekerja, tidak ada overflow horizontal atau error runtime, dan form tidak menyediakan input Muassasah. |
| Lint terarah | Frontend 0 error/peringatan; backend 0 error, 7 peringatan deklarasi tidak terpakai pada file service/repository yang sudah ada. |

Database `gtt_ops_test` yang sebelumnya dikonfigurasi memiliki migrasi penerbangan gagal karena tabel legacy `FlightLeg` memakai struktur berbeda. Database tersebut tidak direset atau diperbaiki dalam tahap ini. Validasi menggunakan database baru yang terisolasi dan pengaman target loopback/nama test dari runner resmi.

Pembuatan ulang Prisma Client tertahan oleh DLL yang dipakai proses pengembangan aktif. Client yang tersedia telah diverifikasi memiliki field `HotelAgreementDraft.muassasahId`; runner sementara mempertahankan pengaman resmi serta langkah migrasi dan seluruh suite, memakai client tersebut, lalu dihapus setelah selesai. `.env` dan proses pengembangan tidak diubah. Untuk mengulang runner resmi, arahkan `TEST_DATABASE_URL` proses ke database uji terpisah dan jalankan saat file engine Prisma tidak terkunci.

Bukti tampilan lokal: `apps/frontend/.impeccable/review/agent-parity/agreement-muassasah-desktop.png`. Gambar ini merupakan fixture pengujian, bukan aset aplikasi. Tidak ada workflow redesign, reviewer/documenter tambahan, atau perubahan sistem desain pada tahap ini.

Upload lampiran, histori revisi terpisah, invoice/statistik tambahan, dan deployment tetap di luar tahap konsistensi data ini.
