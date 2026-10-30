# Skeleton loading GTT Ops dan Portal Agent

Implementasi dan validasi lokal: 30 Oktober 2026.

## Cakupan halaman

| Area | Bagian yang memiliki skeleton |
| --- | --- |
| Overview Admin | Metrik ringkasan dan kartu group; pencarian memakai state query kata kunci saat ini. |
| Dashboard Agent | Ringkasan, kalender, agenda, perhatian visa/hotel, dan checklist dimuat per sumber data. |
| Perjalanan Agent | Ringkasan dan kartu perjalanan, termasuk bentuk keluarga parent–child. |
| Visa Tracking Admin dan Agent | Ringkasan dan daftar group/visa, dengan kontrol filter tetap tersedia. |
| Detail Group Admin dan Agent | Identitas, itinerary, informasi operasional, visa/hotel, penerbangan, dan Raudhah. |
| Detail Visa Admin dan Agent | Identitas, progres, dokumen, penerbangan, hotel, dan informasi jadwal; pemilih agreement Admin juga memakai skeleton daftar. |
| Statistik & Performa | Metrik, grafik vertikal/horizontal, dan tabel performa Agent; query per bagian. |
| Invoice | Nominal dan daftar invoice; pilihan client tidak menahan pemuatan daftar. |
| H-1 Checklist Admin dan Agent | Aktivitas, driver, dan armada. |
| Agreement Inbox Admin dan Agent | Skeleton daftar bersama; filter dan aksi tetap menggunakan kontrol asli. |
| Master Data | Kategori, opsi, Agent, Muassasah, supir, dan kendaraan. |
| User Management | Jumlah akun, status password, role aktif, direktori akun, dan katalog role. |
| Profil Agent | Nama pengguna, kode Partner, dan nama Partner. |

## Komponen bersama

- `apps/frontend/src/components/skeleton.tsx`: `PageSkeleton`, `Skeleton`, `SkeletonRegion`, `MetricSkeleton`, `MetricsSkeleton`, `ListSkeleton`, `CardsSkeleton`, `DetailSkeleton`, `CalendarSkeleton`, `ChartSkeleton`, dan `ChecklistSkeleton`.
- `apps/frontend/src/components/data-boundary.tsx`: `DataBoundary`, `DataStatus`, dan `combineQueryStates` untuk state React Query maupun controller Admin.
- `apps/frontend/src/components/detail-data-state.tsx`: judul, navigasi kembali, loading, error/retry, dan not-found untuk detail yang identitasnya belum tersedia.
- `apps/frontend/src/styles.css`: warna dari token tema, animasi opacity ringan, grid responsif, dan penghormatan `prefers-reduced-motion`.

## Mekanisme state

Skeleton muncul saat query masih pending dan belum memiliki data. Data kosong yang sudah berhasil dimuat memakai empty state. Error awal menghentikan skeleton dan menyediakan retry; refresh tetap menampilkan snapshot terakhir dengan indikator pembaruan kecil. Kegagalan refresh tidak menghapus data atau menulis hasil kosong palsu ke cache.

Query identitas, visa, hotel, dan transport pada detail perjalanan Agent dipisahkan. Data yang siap langsung tampil, sedangkan unduhan PDF menunggu kelengkapan data yang dibutuhkannya. Pada Invoice, pilihan client memiliki query sendiri. Request baca menerima `AbortSignal`, dan hasil filter/identitas disimpan pada query key masing-masing sehingga respons lama tidak menjadi hasil konteks baru.

Tidak ada artificial delay atau dependency baru. Kontrak API, authorization, dan operasi tulis backend tidak diubah. Indikator Save/Delete/Submit tetap berada pada kontrol aksi.

Fallback pemuatan modul halaman Admin, Agent, dan workspace Invoice juga menggunakan skeleton. Banner loading serta CSS bar progres lama dihapus agar tidak muncul berurutan sebelum skeleton data. Penyempurnaan ini lolos build, 16 tes komponen terkait, dan dua tes browser yang menahan pemuatan modul serta data secara terpisah.

Frame skeleton mengikuti lebar maksimum, posisi tengah, header, dan ruang filter halaman tujuan. Tiga tes browser pada desktop 1920px membandingkan posisi atas, kiri, serta lebar frame dan area data sebelum/sesudah modul selesai dimuat pada Checklist Admin, Dashboard Agent, dan Perjalanan Agent; selisih maksimal yang diizinkan adalah 1px.

## Validasi

- TypeScript dan build frontend berhasil.
- Suite komponen lengkap: 679 tes lulus (64 file). Tes unit: 193 lulus. Smoke frontend: 15 lulus. Pemeriksaan fokus terakhir untuk detail perjalanan dan ekspor PDF: 19 lulus.
- Tes lifecycle khusus mencakup initial load tertahan, empty, timeout/error, retry, refresh berhasil/gagal dengan cache, respons independen, pergantian query key, respons terlambat, pembatalan saat unmount, dan retensi cache group/invoice.
- Tes regresi existing mencakup pencarian, pagination, parent–child, detail, agreement, dan Master Data.
- Sembilan tes browser di `e2e/skeleton-loading.spec.ts` lulus. Tes ini memeriksa 17 route pada viewport 1440px dan 390px, serta alignment pada desktop 1920px, dengan API/modul halaman yang ditahan sampai state loading dapat diperiksa. Pemeriksaan mencakup judul/kontrol yang terlihat, skeleton berhenti setelah respons, overflow horizontal, grid metrik, reduced motion, tema gelap, retensi data saat refresh gagal, navigasi saat request masih pending, dan retry setelah error awal.
- Lint selesai tanpa error; 55 warning existing tetap ada.

Run tes desktop/mobile menghasilkan capture di `apps/frontend/test-results/skeleton-loading/` (artefak pengujian yang diabaikan Git dan dapat dibersihkan oleh run Playwright berikutnya).

## Batas validasi

Validasi memakai lingkungan lokal dan respons API terkontrol. Tidak ada deployment atau pengujian terhadap data produksi. Tidak ada halaman pada daftar prioritas yang ditunda; perilaku pada browser/perangkat fisik lain belum diperiksa.
