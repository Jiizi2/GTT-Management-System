# Usulan desain Visa Tracking Portal Agent — 3 Oktober 2026

Status: komposisi A dengan palet netral C sudah diimplementasikan di Portal Agent setelah instruksi “oke eksekusi”. Review akhir independen pada 3 Oktober 2026 memberi disposition **ship**, tanpa koreksi material.

## Tujuan dan konteks

Agent memantau pengajuan visa miliknya, menemukan group yang perlu perhatian, dan membaca status tiap tahap. Mode: Operate. Prioritas penggunaan belum dipilih oleh pengguna; alternatif sengaja membandingkan tiga cara bekerja. Pengguna meminta mockup desktop dan mobile beserta penjelasan singkat.

Sumber konteks: PRODUCT.md, DESIGN.md, kode terbaru pada src/agent/pages/visa-tracking-page.tsx, src/agent/pages/visa-detail-page.tsx, src/agent/data/visa-process.ts, contracts.ts, agent-shell.tsx, agent-calendar.css, dan brief dashboard. Screenshot dashboard agent-calendar-alignment.png menjadi referensi visual. Screenshot agent-parity/visa-desktop.png dan visa-mobile.png mendokumentasikan komposisi visa sebelumnya, tetapi navigasi di dalamnya lebih lama daripada kode shell saat ini. Kode dan referensi dashboard terbaru menentukan navigasi horizontal desktop serta empat tujuan mobile.

## Tiga alternatif

| Alternatif | Komposisi desktop | Adaptasi mobile | Kegunaan dan tradeoff |
| --- | --- | --- | --- |
| A — Progres per perjalanan | Satu blok per keluarga perjalanan, status empat tahap terpisah pada parent dan tiap child. | Kartu perjalanan bertumpuk; sebagian child dapat dibuka dengan disclosure. | Membaca konteks perjalanan dan progres dengan cepat; keluarga besar membutuhkan buka-tutup. |
| B — Daftar dan panel detail | Daftar group di kiri; proses dan catatan dokumen group terpilih di kanan. | Daftar dan detail menjadi dua layar; kembali mempertahankan pencarian, filter, dan posisi daftar. | Membantu memeriksa revisi satu group; membandingkan beberapa group membutuhkan perpindahan pilihan. |
| C — Tabel empat tahap | Group menjadi baris; Dokumen, Agreement, Nusuk, dan Visa menjadi kolom. | Setiap baris berubah menjadi kartu dengan empat pasangan nama/status. | Perbandingan antar-group paling langsung; desktop lebih padat dan membutuhkan ruang kolom. |

Rekomendasi sementara: A. Portal sudah mengelompokkan parent–child menjadi satu perjalanan, sedangkan visa dan hotel tetap milik masing-masing group. Komposisi A menampilkan kedua fakta tersebut langsung, mengurangi ruang panduan/filter, dan membawa daftar group lebih dekat ke bagian atas layar. Ini rekomendasi berdasarkan kode dan konteks produk, bukan hasil riset pengguna atau pengukuran produktivitas.

Keempat filter menjadi ringkasan yang sekaligus dapat dipilih. Panduan alur tersedia sebagai tautan atau disclosure ringkas. Mengubah filter tetap menyimpan q dan status pada URL. Group yang cocok dalam keluarga harus terlihat; saat child yang cocok berbeda dari parent, tampilkan konteks parent secara netral dan buka child yang cocok.

## Data dan batasan

- Empat tahap tetap: Pengiriman dokumen, Agreement hotel, Upload paspor ke Nusuk, Visa issued. Status mengikuti helper dan API yang ada, termasuk fallback group.
- Status child tidak diwariskan dari parent. Ringkasan status keluarga pada A adalah indikator navigasi berdasarkan anggota, bukan perubahan status visa parent.
- Hitungan filter memakai jumlah group/pengajuan, sedangkan jumlah perjalanan memakai keluarga. Pax keluarga dijumlahkan dari anggota yang terlihat dan dimiliki akun. Pengajuan tanpa group tetap punya identitas dan akses detail sendiri.
- Visa terbit tidak membuktikan tiga tahap lain selesai. Informasi yang tidak tersedia ditampilkan sebagai Belum tercatat, terpisah dari Belum dimulai. Jangan memakai persentase atau indikator yang menyatakan empat tahap selesai hanya karena visa terbit.
- Tanggal harus diberi label sesuai sumbernya: tanggal keberangkatan pengajuan bila tercatat; awal perjalanan bila hanya arrivalDate yang tersedia. Jangan menampilkan tanggal kedatangan seolah tanggal penerbangan.
- Monitoring Agent tetap hanya baca. Tindakan utama membuka detail. Nomor group Nusuk, nama dokumen, dan catatan pemeriksaan hanya muncul bila tersedia dan diizinkan. Nama berkas pada B adalah metadata; gaya tautan mockup tidak mengotorisasi penambahan unduhan berkas.
- Warna, Manrope/Inter, ikon, navigasi horizontal desktop, menu akun, dan empat tujuan navigasi mobile mengikuti sistem GTT yang sudah dipakai. Implementasi eventual perlu mendukung mapping dark charcoal/gold yang ada; mockup ini menampilkan light mode.
- Semua nama, tanggal, file, catatan, dan angka dalam mockup adalah data ilustrasi. Copy kecil hasil generasi perlu disesuaikan dengan copy faktual sumber sebelum implementasi; khususnya penjelasan Agreement hotel pada B harus berbunyi persetujuan hotel, bukan konfirmasi visa oleh hotel.

## State dan interaksi yang perlu dipertahankan

Loading mempertahankan ruang daftar melalui skeleton; error menyediakan coba lagi; daftar kosong menjelaskan bahwa group/pengajuan milik akun belum tercatat; pencarian kosong menyediakan reset filter. Nama/kode panjang dapat membungkus tanpa memotong identitas penting. Uji jumlah child yang besar, pengajuan tanpa group, data tahap sebagian, hak akses, keyboard, dan focus saat kembali dari detail. Mobile tidak memakai tabel horizontal dan menyediakan jarak aman di atas bottom navigation. Status menyertakan teks dan ikon selain warna; target sentuh minimal 44px. Disclosure memakai kontrol semantik dengan state expanded.

## Artefak dan prompt

Semua path relatif terhadap apps/frontend:

- A: .impeccable/mocks/decision/agent-visa-20261003-a.png
- B: .impeccable/mocks/decision/agent-visa-20261003-b.png
- C: .impeccable/mocks/decision/agent-visa-20261003-c.png
- Prompt persis yang dikirim ke tool disimpan dalam sidecar .json bernama sama untuk A/B/C; approved: false. Prompt juga tertanam di setiap PNG.
- Halaman perbandingan sesi awal: http://127.0.0.1:53295/ (sesi sudah berakhir; tinjau revisi melalui PNG tersimpan).
- Tool pembuat mockup: built-in image_gen.imagegen, dengan screenshot dashboard sebagai referensi. Tiap board memuat satu alternatif pada desktop dan mobile.

Tahap usulan awal menghasilkan mockup dan halaman perbandingan. Implementasi yang dijalankan setelah persetujuan pengguna dicatat di bagian berikut.

## Revisi A: pengurangan warna

Komposisi yang dipilih tetap A: blok perjalanan, parent dan child terpisah, progres empat tahap, pencarian/filter ringkas, serta navigasi yang sama pada desktop dan mobile. Pengguna menilai pemilihan warna A terlalu banyak dan memilih C sebagai acuan warna. Revisi memakai filter putih/netral dengan hanya pilihan aktif beraksen hijau, ikon group yang umumnya abu-abu, check hijau lembut, clock proses teal dalam penanda kecil, dan revisi dokumen amber lembut menggantikan merah/pink. Hierarki, konten, posisi, dan ukuran komponen mengikuti A.

Artefak revisi: .impeccable/mocks/decision/agent-visa-20261003-a-palette-c.png dan sidecar .json bernama sama. Tool: built-in image_gen.imagegen, dengan A sebagai target edit dan C sebagai referensi warna saja. Prompt persis tersimpan dalam JSON dan tertanam dalam PNG. Pada tahap revisi mockup ini, pemeriksaan visual terfokus memastikan kedua viewport tetap memakai komposisi A dan penanda status berteks, sebelum implementasi kode UI dimulai.

Kebutuhan monitoring menjelang keberangkatan tetap bisa dievaluasi terpisah; jangan menambahkan deadline atau prediksi penerbitan tanpa aturan dan sumber data yang jelas.

## Implementasi yang selesai

Halaman `src/agent/pages/visa-tracking-page.tsx` menampilkan satu blok per keluarga perjalanan. Parent dan child memiliki empat status masing-masing, filter dengan jumlah pengajuan, pencarian, panduan proses yang dapat dibuka, serta akses ke detail yang mempertahankan filter saat kembali. Gaya khusus halaman berada di `src/agent/agent-visa-tracking.css`, diimpor melalui `src/styles.css`.

Desktop menyelaraskan identitas group, empat tahap, dan tombol detail dalam baris. Mobile memakai filter 2×2 dan empat tahap yang tetap terlihat bersamaan; parent serta child pertama ditampilkan, sedangkan child tambahan dapat dibuka melalui disclosure. Palet memakai token tema GTT: permukaan netral, aksen hijau untuk tindakan, serta warna semantik kecil pada status. Mode gelap mengikuti tema aplikasi.

Perbedaan dari teks mockup menjaga kebenaran data: tanggal keberangkatan aplikasi diberi label “Keberangkatan”, fallback tanggal awal perjalanan diberi label “Awal perjalanan”; informasi yang belum tercatat tetap berbeda dari proses yang belum dimulai. Label Parent/Child dan “Konteks parent” menjaga hubungan saat filter hanya menemukan child. Visa terbit tidak menyimpulkan tahap sebelumnya selesai. Pengajuan tanpa group tetap tersedia dan membuka detail melalui ID aplikasi. Halaman tetap memakai API baca Agent yang ada.

Validasi: build produksi dan lint terfokus lulus; tujuh tes komponen, dua tes unit keluarga group, serta dua tes browser desktop/mobile lulus. Pemeriksaan browser mencakup lebar 1440, 1280, 390 dalam tema terang/gelap, dan 320 px dengan identitas panjang, filter, disclosure, kembali dari detail, keyboard, data kosong, pencarian kosong, serta error dan coba lagi. Perbandingan komposisi desktop memberi hasil 89% match tanpa wilayah yang hilang atau bertentangan.

Artefak implementasi relatif terhadap `apps/frontend`: `.impeccable/review/agent-visa/desktop.png`, `mobile.png`, `mobile-dark.png`, `checks.json`, `validation.md`, dan `finish-review.md`. Kontrak halaman berada di `.impeccable/surfaces/src-agent-pages-visa-tracking-page-tsx.md`. Screenshot pemeriksaan memakai data ilustrasi pada skrip pengujian saja. Implementasi ini tidak mencakup deployment.
