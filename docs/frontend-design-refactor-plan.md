# Frontend Design Refactor Plan

Dokumen ini memecah refactor konsistensi desain frontend menjadi fase-fase kecil yang aman dikerjakan bertahap.

Tujuan utamanya:

- mengurangi variasi visual yang tidak perlu
- menurunkan duplikasi class Tailwind mentah
- memperjelas primitive UI bersama
- menjaga fitur baru tetap konsisten dengan sistem `serene`

Dokumen ini melengkapi:

- `docs/frontend-design-guidelines.md`
- `docs/frontend.md`

## 1. Ringkasan Kondisi Saat Ini

Dari kode frontend sekarang, sistem desain dasarnya sudah cukup bagus karena:

- token warna dan theme sudah ada di `apps/frontend/src/styles.css`
- primitive penting seperti card, button, input, modal, dan chip sudah tersedia
- banyak halaman sudah memakai `serene-*`

Namun masih ada inkonsistensi yang cukup terasa:

1. Banyak page masih memakai shell card manual seperti `rounded-3xl border border-slate-200 bg-surface-container-lowest p-5 shadow-sm` alih-alih primitive bersama.
2. `ThemeToggleButton` dipakai berulang dengan class panjang yang hampir sama di banyak halaman.
3. Hero/header section masih bercampur antara `serene-section` dan utility manual.
4. Stat/summary card punya bentuk visual mirip tetapi belum jadi primitive bersama.
5. Table shell, filter toolbar, dan empty state masih berulang sebagai utility mentah.
6. Modal shell sudah mulai konsisten, tetapi beberapa modal lama masih memakai kombinasi radius/border/shadow manual.
7. Beberapa fitur besar seperti `visa-detail`, `group-detail-modals`, `invoice-list`, dan `raudhah-reminder` masih menyimpan banyak style inline yang sebenarnya bisa disederhanakan.

## 2. Prinsip Eksekusi

Refactor ini harus mengikuti aturan:

- tidak mengubah behavior produk
- tidak mengubah hierarchy informasi tanpa alasan kuat
- meminimalkan perubahan visual drastis dalam satu PR
- utamakan ekstraksi primitive, bukan redesign total
- setiap fase harus aman diverifikasi dengan `check`, `test`, dan build

## 3. Prioritas Refactor

Urutan prioritas yang saya rekomendasikan:

1. Primitive paling berulang dan paling murah diekstrak
2. Shell layout lintas halaman
3. Card, summary, toolbar, dan empty state
4. Modal dan dialog family
5. Form sections dan action footer
6. Refactor fitur berat yang masih paling verbose

## 4. Fase Refactor

## Fase 1: Standardisasi Primitive Yang Paling Sering Dipakai

Target:

- mengurangi duplikasi paling besar dengan risiko paling kecil

Kandidat utama:

- varian `ThemeToggleButton` wrapper
- page search bar / top toolbar
- hero/section shell
- table shell
- stat card
- empty state card

File yang paling terdampak:

- `apps/frontend/src/pages/overview-page.tsx`
- `apps/frontend/src/pages/checklist-page.tsx`
- `apps/frontend/src/pages/visa-tracking-page.tsx`
- `apps/frontend/src/pages/invoice-list-page.tsx`
- `apps/frontend/src/pages/group-detail-page.tsx`
- `apps/frontend/src/pages/manage-role-page.tsx`
- `apps/frontend/src/pages/master-data-page.tsx`
- `apps/frontend/src/pages/new-group-screen.tsx`
- `apps/frontend/src/pages/raudhah-reminder-page.tsx`
- `apps/frontend/src/pages/invoice-page.tsx`
- `apps/frontend/src/components/dashboard-workspace-shell.tsx`

Hasil yang diinginkan:

- Tambah primitive seperti:
  - `.serene-page-toolbar`
  - `.serene-search-field`
  - `.serene-stat-card`
  - `.serene-empty-state`
  - `.serene-table-shell`
- Tambah wrapper component kecil bila perlu, misalnya:
  - `PageToolbar`
  - `PageSearchField`
  - `DashboardThemeToggle`

Alasan prioritas tinggi:

- duplikasinya banyak
- perubahan visual relatif kecil
- dampaknya langsung terasa ke maintainability

## Fase 2: Satukan Hero/Header Section Lintas Page

Masalah sekarang:

- beberapa halaman sudah memakai `serene-section`
- beberapa halaman masih pakai utility manual dengan bentuk hampir sama
- struktur hero page belum sepenuhnya seragam

Kandidat halaman:

- `visa-tracking-page.tsx`
- `visa-detail-page.tsx`
- `invoice-list-page.tsx`
- `new-group-screen.tsx`
- `overview-page.tsx`
- `checklist-page.tsx`
- `raudhah-reminder-page.tsx`

Rencana:

- definisikan pola hero page bersama:
  - eyebrow opsional
  - title
  - description
  - action area kanan
- perluas atau rapikan `apps/frontend/src/components/page-hero-section.tsx`

Hasil yang diinginkan:

- header page punya struktur dan spacing yang konsisten
- title area tidak lagi dibangun ulang tiap halaman
- review visual jadi lebih mudah karena semua page header berasal dari pola yang sama

## Fase 3: Standardisasi Card Family

Masalah sekarang:

- ada card umum, card summary, card data, card empty state, dan card info yang secara visual serupa tetapi dibentuk manual

File dengan indikasi duplikasi tinggi:

- `visa-tracking-page.tsx`
- `visa-detail-page.tsx`
- `invoice-list-page.tsx`
- `group-detail-modals.tsx`
- `raudhah-reminder-page.tsx`
- `profile-page.tsx`

Rencana:

- petakan card family menjadi beberapa peran:
  - content card
  - summary card
  - info card
  - alert/warning card
  - compact card
- tambahkan primitive di `styles.css` atau komponen wrapper tipis

Hasil yang diinginkan:

- mengurangi penggunaan kombinasi seperti `rounded-2xl border border-slate-200 bg-surface-container-lowest p-4 shadow-sm`
- semua card memakai depth, border, dan radius yang lebih seragam

## Fase 4: Standardisasi Modal dan Dialog

Kondisi sekarang:

- shell modal sudah mulai konsisten lewat `.serene-modal-shell`
- tetapi masih ada modal lama/manual di beberapa file

Target file:

- `apps/frontend/src/components/group-detail-modals.tsx`
- `apps/frontend/src/components/visa-detail-modals.tsx`
- `apps/frontend/src/pages/profile-page.tsx`
- `apps/frontend/src/pages/manage-role-page.tsx`
- `apps/frontend/src/pages/raudhah-reminder-page.tsx`
- `apps/frontend/src/pages/checklist-page.tsx`

Rencana:

- bentuk family modal yang seragam:
  - header
  - body
  - footer
  - close button
  - destructive state
- buat helper class atau wrapper komponen:
  - `DialogHeader`
  - `DialogFooter`
  - `DialogBody`

Hasil yang diinginkan:

- footer aksi modal tidak lagi dirakit manual di tiap file
- spacing internal modal lebih konsisten
- destructive confirm dialog punya pola tetap

## Fase 5: Standardisasi Form Section dan Action Footer

Masalah sekarang:

- form primitive input sudah bagus
- tetapi layout section form dan footer aksi masih berbeda-beda

Fitur yang paling relevan:

- `new-group-screen.tsx`
- `add-group-workspace-page.tsx`
- `invoice-page.tsx`
- `manage-role-page.tsx`
- `master-data-page.tsx`
- `profile-page.tsx`

Rencana:

- bentuk primitive:
  - form section wrapper
  - section heading
  - inline action row
  - sticky/non-sticky action footer
- samakan pola:
  - tombol `Cancel` di kiri / tombol primary di kanan
  - full-width on mobile, auto-width on desktop

Hasil yang diinginkan:

- flow form lintas fitur terasa satu keluarga
- class tombol/action row tidak lagi verbose dan berbeda-beda

## Fase 6: Refactor Feature-Specific Heavy Files

Setelah primitive bersama cukup matang, baru masuk ke file yang paling besar dan berat.

Prioritas file:

1. `apps/frontend/src/components/group-detail-modals.tsx`
2. `apps/frontend/src/pages/visa-detail-page.tsx`
3. `apps/frontend/src/pages/invoice-page.tsx`
4. `apps/frontend/src/pages/raudhah-reminder-page.tsx`
5. `apps/frontend/src/pages/checklist-page.tsx`

Tujuan fase ini:

- mengganti utility mentah berulang dengan primitive yang sudah jadi
- memecah blok JSX yang terlalu besar
- memisahkan concern visual dari logic bila perlu

Catatan:

- fase ini lebih mahal
- jangan dikerjakan sebelum primitive dasar siap

## 5. Backlog Primitive yang Layak Dibuat

Daftar kandidat paling bernilai:

- `.serene-page-toolbar`
- `.serene-page-search`
- `.serene-page-search-input`
- `.serene-stat-card`
- `.serene-stat-card-accent`
- `.serene-empty-state`
- `.serene-table-shell`
- `.serene-table-card`
- `.serene-dialog-header`
- `.serene-dialog-footer`
- `.serene-form-section`
- `.serene-form-actions`
- `.serene-inline-icon-button`
- `.serene-theme-toggle-shell`

Jika ingin versi komponen React, kandidatnya:

- `PageToolbar`
- `PageSearchBar`
- `PageHeroSection` versi lebih lengkap
- `StatCard`
- `EmptyStateCard`
- `DialogScaffold`

## 6. Rencana Eksekusi PR

Supaya aman, saya sarankan pecah ke beberapa PR kecil:

### PR 1

- tambah primitive global baru di `styles.css`
- refactor `ThemeToggleButton` wrapper style
- refactor 1-2 halaman kecil sebagai contoh

### PR 2

- refactor page hero/header lintas halaman
- rapikan top toolbar/search pattern

### PR 3

- refactor summary/stat card dan empty state
- rapikan table shell

### PR 4

- refactor modal/dialog family

### PR 5

- refactor form section + action footer

### PR 6+

- refactor feature-heavy files satu per satu

## 7. Quick Wins Paling Direkomendasikan

Kalau ingin hasil cepat dengan effort rendah, mulai dari ini:

1. Buat primitive untuk shell `ThemeToggleButton`
2. Buat primitive untuk search bar halaman dashboard
3. Buat primitive untuk stat card
4. Buat primitive untuk empty state
5. Samakan hero shell `visa-tracking`, `invoice-list`, `overview`, dan `raudhah-reminder`

Ini akan memberi dampak visual besar tanpa menyentuh logic rumit.

## 8. Area yang Sebaiknya Ditahan Dulu

Belum perlu disentuh di fase awal:

- warna/token besar di `:root`
- struktur theme light/dark dasar
- keseluruhan visual checklist yang memang feature-specific
- redesign layout page besar
- perubahan copywriting UI

Alasannya:

- fase awal sebaiknya fokus ke konsistensi, bukan rebranding

## 9. Risk Notes

Risiko utama refactor ini:

- perubahan class kecil bisa menggeser spacing visual
- komponen yang dipakai banyak halaman bisa membuat regresi luas
- dark mode bisa paling mudah “pecah” bila primitive baru kurang diuji

Mitigasi:

- refactor bertahap
- review visual desktop + mobile
- cek light + dark
- jalankan:
  - `npm run check --workspace frontend`
  - `npm run test --workspace frontend`
  - `npm run build:frontend`

## 10. Definition of Done

Refactor dianggap berhasil jika:

- halaman baru lebih jarang memakai shell manual
- primitive `serene-*` makin jadi sumber utama
- jumlah utility mentah berulang turun nyata
- top toolbar, hero, stat card, empty state, modal, dan form action terasa seragam
- dark mode tetap stabil
- tidak ada regresi fungsional

## 11. Rekomendasi Langkah Berikutnya

Kalau mau langsung dieksekusi, urutan terbaik adalah:

1. implement Fase 1
2. lanjut Fase 2
3. baru pilih salah satu fitur besar untuk “pilot refactor”, paling cocok:
   - `visa-tracking`
   - `invoice-list`
   - `overview`

Tiga area itu cukup representatif, cukup sering dipakai, dan tidak serumit `invoice-page` atau `group-detail-modals`.
