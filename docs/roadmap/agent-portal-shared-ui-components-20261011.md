# Portal Agent: komponen UI bersama

Tanggal: 2026-10-11. Lingkup: konsistensi komponen pada halaman portal Agent dalam sistem visual GTT yang sudah ada.

## Komponen dan penggunaan

Komponen umum berada di `apps/frontend/src/components/`; adapter state khusus Agent tetap di `src/agent/components/data-state.tsx`.

| Komponen                                   | Penggunaan                                                                                    |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `SearchField`                              | Perjalanan, Visa Tracking, H-1 Checklist, dan filter Agreement Inbox bersama Admin/Agent      |
| `ListToolbar`, `ResultSummary`             | Susunan kontrol, jumlah hasil, reset, dan aksi daftar                                         |
| `FilterField`, `SereneSelect`              | Label dan pilihan filter; field khusus agreement tetap di `AgreementInboxFilters`             |
| `PaginationControls`                       | Perjalanan dan Agreement Inbox; Agent menggunakan `locale="id"` dan `touchSafe`               |
| `PageLayout`, `PageHeader`                 | Seluruh halaman utama Agent; header daftar compact dan header detail memakai varian detail    |
| `Button`, `IconButton`, `Icon`             | Aksi umum, kontrol pencarian/pagination, disclosure, dan ikon dekoratif                       |
| `StatusBadge`, `Badge`                     | Status operasional, approval, alokasi, dokumen, dan hotel                                     |
| `LoadingState`, `ErrorState`, `EmptyState` | State data dan pemulihan pencarian; skeleton visa tetap mengikuti bentuk daftar visa          |
| `DetailItem`                               | Label–nilai profil, perjalanan, driver, visa, dan penerbangan pendukung                       |
| `ReadOnlyIndicator`                        | Profil, Detail Perjalanan, dan Detail Visa dengan label “Hanya lihat”                         |
| `GroupIdentity`                            | Identitas group pada agenda Dashboard, kartu/anggota Perjalanan, Visa Tracking, dan Checklist |
| `SectionHeader`                            | Judul bagian, informasi pendukung, dan status ringkasan                                       |
| `MetricCard`                               | Statistik Dashboard dan ringkasan Perjalanan melalui varian compact                           |
| `ExpandableSection`                        | Group terhubung, preview itinerary, dan detail driver menggunakan disclosure native           |

## Kontrak penggunaan

- `SearchField` menerima `label`, `value`, dan `onChange(value)`. `labelHidden={false}` menampilkan label; `className` mengatur wadah. Label tetap tersedia bagi pembaca layar. Clear mengirim string kosong dan mengembalikan fokus ke input; caller memperbarui URL/state menggunakan aturan halamannya.
- `ListToolbar` menerima `ariaLabel`, kontrol melalui `children`, `controlsClassName` untuk susunan filter, dan `footer` opsional. Gunakan `ResultSummary` untuk jumlah hasil, `onReset`, dan aksi seperti refresh.
- `PaginationControls` mempertahankan kontrak nomor halaman dan rentang hasil. Jangan menambah pagination pada daftar yang belum memilikinya tanpa kebutuhan produk. Ubah label Agent melalui `locale="id"`; caller tetap menghitung jumlah perjalanan/agreement dan mengatur reset halaman saat filter berubah.
- `DetailItem stacked` digunakan dalam grid detail; mode default mempertahankan daftar label–nilai. `icon` opsional tetap dekoratif. Nilai panjang dapat membungkus tanpa memotong informasi.
- `GroupIdentity` menerima `code`, `name`, `metadata`, dan `badge`. Gunakan `headingLevel` pada kartu yang membutuhkan heading. Identitas di dalam link/tombol memakai konten span; konteks perjalanan yang sudah menampilkan nama boleh hanya menampilkan kode dan metadata.
- `IconButton` membutuhkan `aria-label`; gunakan `iconClassName` untuk rotasi disclosure. `Icon` selalu dekoratif. Collector Material Symbols membaca prop `name` agar glyph dalam komponen bersama tetap disertakan.
- Warna status dipilih dari status bisnis yang tercatat oleh caller. Status family, status group, approval, dan alokasi tetap memiliki makna masing-masing.

## Perilaku yang dipertahankan

Pencarian/filter yang tersimpan di URL, navigasi kembali ke daftar berfilter, keluarga parent–child, API milik Agent, hak hanya baca, dan unduhan itinerary tetap menggunakan aturan yang sudah ada. Search/toolbar Agreement Inbox juga dipakai Admin; label khusus konteks tersebut tetap dapat dikonfigurasi. Checklist membedakan pencarian tanpa hasil dari tidak adanya jadwal.

## Verifikasi

Pemeriksaan mencakup TypeScript, manifest ikon, lint/format file yang berubah, component regression pada Agent dan filter Agreement Admin, serta browser fixture untuk search/clear/focus, parent–child, kembali ke filter, PDF, dark mode, dan layout desktop/mobile. Fixture browser memvalidasi UI dengan data terkontrol; tidak mengklaim pengujian backend live atau deployment produksi.

Hasil: build frontend, manifest 122 ikon, lint dan format file yang berubah, 93 component tests dalam 12 berkas, serta 4 skenario Playwright lulus. Capture diperiksa di `.impeccable/review/agent-parity/` untuk toolbar/identitas Perjalanan dan Visa, statistik Dashboard, detail perjalanan/visa, serta Agreement dalam dark mode mobile.
