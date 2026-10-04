# Implementasi penyelarasan Portal Agent

Tanggal: 3 Oktober 2026\
Status: implementasi lokal selesai; reviewer Impeccable memberi disposition `ship`. Belum dideploy atau diverifikasi dengan database production.\
Rencana awal: [penyelarasan fitur Admin dan Portal Agent](agent-portal-admin-feature-parity-20261002.md).

Kebijakan akses terbaru: [Agreement Inbox Agent hanya baca](agent-portal-agreement-readonly-20261003.md). Pembuatan dan revisi kini dilakukan Admin; bukti pengiriman/revisi Agent di bawah adalah riwayat implementasi awal.

Tindak lanjut: [konsistensi data Agreement Admin–Agent](agent-portal-data-consistency-20261003.md) mencatat penyelarasan Muassasah, alokasi, kapasitas per malam, serta validasi PostgreSQL lokal terpisah. Bukti di bawah tetap menjadi catatan implementasi awal.

## Perilaku yang tersedia

- Perjalanan dan Visa Tracking mengelompokkan dataset milik Agent yang lengkap sebelum pencarian dan pagination lokal. Pencarian kode/nama child menemukan keluarganya; tautan tiap anggota membuka detailnya. Total keluarga menjumlahkan pax setiap record, termasuk fixture parent 20 + child 10 = 30 jamaah.
- Child membaca itinerary, timeline, next activity, musyrif, dan checklist dari parent yang terverifikasi milik Agent yang sama. Identitas, visa, dan hotel tetap berasal dari masing-masing anggota. Relasi parent legacy lintas Agent disanitasi; parent yang tidak dapat diakses tidak menjadi sumber pewarisan.
- Dashboard menambahkan jumlah perjalanan tanpa mengubah makna jumlah seluruh group. Ringkasan H-1 menghindari penghitungan ulang transportasi bersama berdasarkan ID sumber daya.
- Agreement Inbox tersedia pada `/agent/agreement-inbox`, sebagai tujuan utama keempat di desktop dan mobile. Agent dapat mencari/filter draft sendiri, melihat approval dan alokasi secara terpisah, mengirim metadata, merevisi draft yang memenuhi kebijakan edit, serta membuka group hasil alokasi.
- Detail perjalanan menyediakan preview dan unduhan PDF itinerary melalui komponen/exporter bersama Admin dengan payload yang sudah dibatasi untuk Agent. Pilihan `transportMode` eksplisit, termasuk `none`, dipertahankan. Informasi tambahan mencakup segmen penerbangan/transit, jadwal Raudhah dan tasreh, nama/telepon/plat/verifikasi driver, serta pengecualian hotel.

## API dan kebijakan edit agreement

Endpoint khusus Agent memakai sumber `HotelAgreementDraft` yang sama dengan Admin, tanpa migration baru:

| Metode | Endpoint | Perilaku |
| --- | --- | --- |
| GET | `/api/agent/agreement-drafts` | Daftar draft sendiri dan alokasi group yang dapat dibaca Agent. |
| GET | `/api/agent/agreement-drafts/:id` | Detail draft sendiri; ID yang tidak dapat diakses menghasilkan 404. |
| POST | `/api/agent/agreement-drafts` | Membuat draft sendiri dengan approval `WAITING` dari server. |
| PATCH | `/api/agent/agreement-drafts/:id` | Mengirim revisi metadata yang sah dan mengembalikan approval ke `WAITING`. |

Kepemilikan ditentukan principal sesi. Input hanya memuat kota, nama hotel, nomor agreement, nama group referensi, pax, check-in, dan check-out. Body yang mencoba menyetel `agentId`, approval `status`, atau assignment ditolak. Draft `WAITING` atau `REJECTED` yang belum dialokasikan dapat direvisi. Draft `APPROVED` atau draft dengan alokasi menghasilkan 409 dan perlu ditangani Admin sebelum revisi. Approval, assign/unassign, dan pengelolaan relasi parent–child tetap dilakukan Admin.

Update Prisma memeriksa kepemilikan, approval, dan seluruh alokasi dalam transaksi; menggunakan advisory lock yang sama dengan assignment serta guard status/`updatedAt` untuk benturan perubahan. GET Agent pada repository memory maupun Prisma merupakan operasi baca murni: tidak memicu expiry approval 24 jam milik alur Admin. Revisi memperbarui `updatedAt` dan membuka jendela approval baru; perilaku expiry/assignment Admin tetap berlaku pada alurnya sendiri. Query cache serta invalidation dipisahkan menurut sesi Agent.

## Validasi lokal

| Pemeriksaan | Hasil |
| --- | --- |
| Unit backend penuh sebelum penambahan suite repository baru | 56 file, 339 tes lulus. |
| Unit backend terarah terakhir | 7 file, 42 tes lulus; mencakup service Agent, 8 tes repository agreement baru, 2 tes parent Prisma, dan regresi agreement Admin. |
| Backend `check:test`, build, dan lint terarah | Lulus; lint 0 error dengan 4 peringatan deklarasi tidak terpakai yang sudah ada di repository. |
| Frontend check, build terakhir, dan lint terarah | Lulus; lint 0 error/peringatan. Build terakhir mencakup pemetaan `transportMode`. |
| Tes komponen terkait dan unit Agent | 20 tes komponen dan 5 tes unit lulus. |
| E2E API Nest dengan repository memory | 1 lulus, 3 dilewati; draft sendiri/sumber bersama Admin, akses asing 404, body terlarang 400, dan revisi setelah alokasi 409. |
| Playwright dengan fixture scoped | 2 lulus pada desktop 1440×900 dan mobile 390×844; mencakup child/search/back, PDF, POST/PATCH draft, serta assertion style dark mode yang sudah stabil. |
| Finish review independen | Disposition `ship`; lima bagian kontrak diterima dan tidak ada material fix yang diminta. |

Suite unit frontend penuh menghasilkan 169 lulus dan 4 gagal pada dua file yang tidak diubah: `src/unit/app-domain.unit.test.ts` (daftar transport mode termasuk `none`, jumlah bus checklist, dan nilai awal `requiresBus`) serta `src/unit/group-itinerary-display.unit.test.ts` (ekspektasi label `Transportation`/`Bus` versus `Bus for this trip`/`1 bus`). Kegagalan baseline tersebut tetap terbuka; hasil suite penuh tidak dinyatakan lulus.

## Bukti desain dan dokumentasi

Keempat belas capture lokal berada di `apps/frontend/.impeccable/review/agent-parity/`: pasangan desktop/mobile untuk `trips`, `detail`, `visa`, `agreements`, `form`, `agreements-dark`, dan `form-dark`. Capture dark sempat diambil saat transisi 200 ms lalu diganti dengan capture yang menonaktifkan animasi; tidak ada perbaikan CSS dari kejadian tersebut. Detector dijalankan sekali dengan advisory ukuran font yang sudah ada dan tidak dijalankan ulang.

Handoff dokumentasi membandingkan source Agreement Agent, shell, token CSS, konfigurasi font, API, dan tes terkait dengan `PRODUCT.md`, `DESIGN.md`, sidecar, serta brief Agreement Admin/Agent. Capture light agreement desktop/mobile dan dark form desktop/mobile dibuka untuk memeriksa pola daftar, composer, navigasi, dan tema. Implementasi mempertahankan Manrope/Inter, Material Symbols, kontrol Serene, warna hijau light mode, dan charcoal/gold dark mode. `DESIGN.md` dan `.impeccable/design.json` dipertahankan karena tidak ada visual world atau perubahan sistem baru.

Penambahan Agreement sebagai tujuan mobile keempat membuat contoh tiga tujuan Agent pada `DESIGN.md` tidak lagi menggambarkan shell terkini; ini akibat perluasan yang diotorisasi, bukan drift lama yang diperbaiki dalam pekerjaan ini. Brief Agent mencatat perilaku empat tujuan tersebut. Tidak ada klaim bahwa seluruh drift dokumentasi lama telah diperiksa atau diperbaiki.

## Batas dan backlog

Implementasi ini hanya mengirim metadata agreement. Upload lampiran, histori revisi terpisah, serta pemisahan catatan internal/publik belum tersedia; catatan draft dan notes internal tidak disalurkan ke Agent. Invoice dan statistik Agent tetap backlog opsional. Bukti raster adalah fixture pemeriksaan, bukan aset visual yang dikirim dalam aplikasi. Tidak ada integrasi database nyata, migration, deployment, atau verifikasi production dalam pelaksanaan ini.
