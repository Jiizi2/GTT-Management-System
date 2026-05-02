# Frontend Design Phase 1 Implementation Checklist

Dokumen ini adalah checklist eksekusi untuk Phase 1 dari `docs/frontend-design-refactor-plan.md`.

Fokus Phase 1:

- standardisasi primitive yang paling sering berulang
- kurangi utility Tailwind mentah yang verbose
- rapikan fondasi visual tanpa mengubah behavior fitur

## 1. Target Phase 1

Hasil minimum yang diharapkan:

- ada primitive global baru untuk pola UI yang paling sering dipakai
- `ThemeToggleButton` tidak lagi diulang dengan class panjang di banyak halaman
- top toolbar / search bar dashboard mulai konsisten
- stat card dan empty state punya primitive dasar
- minimal 2-3 halaman representative sudah memakai primitive baru

## 2. Scope File

File utama yang hampir pasti disentuh:

- `apps/frontend/src/styles.css`
- `apps/frontend/src/components/theme-toggle-button.tsx`
- `apps/frontend/src/components/page-hero-section.tsx`

File kandidat refactor batch awal:

- `apps/frontend/src/pages/overview-page.tsx`
- `apps/frontend/src/pages/visa-tracking-page.tsx`
- `apps/frontend/src/pages/invoice-list-page.tsx`
- `apps/frontend/src/pages/raudhah-reminder-page.tsx`
- `apps/frontend/src/components/dashboard-workspace-shell.tsx`

File kandidat batch lanjutan dalam Phase 1:

- `apps/frontend/src/pages/checklist-page.tsx`
- `apps/frontend/src/pages/group-detail-page.tsx`
- `apps/frontend/src/pages/manage-role-page.tsx`
- `apps/frontend/src/pages/master-data-page.tsx`
- `apps/frontend/src/pages/new-group-screen.tsx`
- `apps/frontend/src/pages/invoice-page.tsx`

## 3. Primitive Yang Harus Dibuat Dulu

Checklist:

- [ ] Tambah `.serene-theme-toggle-shell`
- [ ] Tambah `.serene-page-toolbar`
- [ ] Tambah `.serene-page-search`
- [ ] Tambah `.serene-page-search-input`
- [ ] Tambah `.serene-stat-card`
- [ ] Tambah `.serene-empty-state`
- [ ] Tambah `.serene-table-shell`

Kalau ternyata perlu versi komponen:

- [ ] Pertimbangkan `DashboardThemeToggle`
- [ ] Pertimbangkan `PageSearchBar`
- [ ] Pertimbangkan `StatCard`

Catatan:

- Phase 1 sebaiknya mulai dari CSS primitive dulu
- komponen wrapper hanya dibuat jika benar-benar membantu mengurangi duplikasi

## 4. Batch Kerja Yang Direkomendasikan

## Batch 1: Primitive Global

Tujuan:

- menyiapkan pondasi di `styles.css`

Checklist:

- [ ] Audit ulang class yang berulang untuk toggle, toolbar, search, stat card, empty state, table shell
- [ ] Tambah primitive baru ke `styles.css`
- [ ] Pastikan primitive memakai token semantik existing, bukan warna hardcoded baru
- [ ] Pastikan light mode dan dark mode tetap terbaca dengan baik

Acceptance criteria:

- primitive baru cukup generik
- nama primitive berdasarkan peran UI, bukan nama halaman
- tidak ada perubahan visual liar di luar target

## Batch 2: Theme Toggle Standardization

Tujuan:

- menghapus class toggle yang berulang di banyak file

Checklist:

- [ ] Rapikan `ThemeToggleButton` agar punya varian default/shell yang cocok untuk dashboard
- [ ] Ganti pemakaian toggle yang masih memakai class panjang berulang
- [ ] Samakan ukuran, border, background, shadow, dan hover state

File target awal:

- [ ] `apps/frontend/src/components/dashboard-workspace-shell.tsx`
- [ ] `apps/frontend/src/pages/overview-page.tsx`
- [ ] `apps/frontend/src/pages/visa-tracking-page.tsx`
- [ ] `apps/frontend/src/pages/invoice-list-page.tsx`
- [ ] `apps/frontend/src/pages/raudhah-reminder-page.tsx`

Acceptance criteria:

- class toggle yang sama tidak lagi di-copy paste
- semua toggle dashboard terasa satu keluarga

## Batch 3: Search Bar dan Toolbar Standardization

Tujuan:

- menyatukan pola search/top bar yang sekarang berulang

Checklist:

- [ ] Bentuk pola toolbar halaman dashboard yang konsisten
- [ ] Bentuk pola search input yang konsisten
- [ ] Samakan icon placement, height, radius, shadow, dan text style

File target awal:

- [ ] `apps/frontend/src/pages/checklist-page.tsx`
- [ ] `apps/frontend/src/pages/visa-tracking-page.tsx`
- [ ] `apps/frontend/src/pages/invoice-list-page.tsx`
- [ ] `apps/frontend/src/pages/overview-page.tsx`

Acceptance criteria:

- search bar lintas halaman terasa satu sistem
- spacing kanan-kiri dan tinggi field seragam
- search wrappers tidak lagi dibentuk manual penuh di tiap page

## Batch 4: Hero / Section Shell Pilot

Tujuan:

- mulai menyatukan hero shell tanpa refactor besar

Checklist:

- [ ] Audit halaman yang sudah cocok memakai `PageHeroSection`
- [ ] Rapikan `PageHeroSection` bila perlu agar cukup fleksibel
- [ ] Terapkan pada 2-3 halaman pilot

File target paling cocok:

- [ ] `apps/frontend/src/pages/overview-page.tsx`
- [ ] `apps/frontend/src/pages/visa-tracking-page.tsx`
- [ ] `apps/frontend/src/pages/raudhah-reminder-page.tsx`

Acceptance criteria:

- title, description, dan action area lebih seragam
- tidak ada penurunan hierarchy informasi

## Batch 5: Stat Card dan Empty State Pilot

Tujuan:

- menyatukan komponen visual yang paling sering terlihat user

Checklist:

- [ ] Tambah primitive stat card
- [ ] Tambah primitive empty state
- [ ] Terapkan ke halaman yang punya summary dan empty state paling jelas

File target awal:

- [ ] `apps/frontend/src/pages/visa-tracking-page.tsx`
- [ ] `apps/frontend/src/pages/invoice-list-page.tsx`
- [ ] `apps/frontend/src/pages/overview-page.tsx`

Acceptance criteria:

- summary card punya tinggi, padding, border, dan icon rhythm yang lebih konsisten
- empty state card tidak lagi dibuat dengan utility mentah berbeda-beda

## Batch 6: Table Shell Pilot

Tujuan:

- menyatukan shell tabel desktop dan card list shell

Checklist:

- [ ] Tambah primitive table shell
- [ ] Terapkan pada page list yang paling jelas

File target:

- [ ] `apps/frontend/src/pages/visa-tracking-page.tsx`
- [ ] `apps/frontend/src/pages/invoice-list-page.tsx`

Acceptance criteria:

- container tabel desktop punya border/radius/shadow yang konsisten
- pola wrapper tabel tidak lagi verbose

## 5. Urutan Eksekusi Paling Aman

Urutan yang saya rekomendasikan:

1. `styles.css`
2. `theme-toggle-button.tsx`
3. `dashboard-workspace-shell.tsx`
4. `overview-page.tsx`
5. `visa-tracking-page.tsx`
6. `invoice-list-page.tsx`
7. `raudhah-reminder-page.tsx`
8. baru halaman lain yang lebih kompleks

Alasan urutan ini:

- dari primitive ke pemakaian
- dari halaman ringan ke halaman kompleks
- dari duplikasi tinggi ke duplikasi sedang

## 6. File-by-File Checklist

## `apps/frontend/src/styles.css`

- [ ] Tambah primitive baru untuk toggle shell
- [ ] Tambah primitive toolbar
- [ ] Tambah primitive search field
- [ ] Tambah primitive stat card
- [ ] Tambah primitive empty state
- [ ] Tambah primitive table shell
- [ ] Pastikan tidak menambah token warna baru tanpa kebutuhan jelas

## `apps/frontend/src/components/theme-toggle-button.tsx`

- [ ] Putuskan apakah style default dipindah ke primitive global
- [ ] Tambah opsi class/variant yang lebih reusable jika perlu
- [ ] Hindari class default yang terlalu spesifik ke satu halaman

## `apps/frontend/src/components/page-hero-section.tsx`

- [ ] Audit apakah struktur sekarang cukup untuk hero page umum
- [ ] Jika perlu, tambah fleksibilitas ringan tanpa membuat API komponen terlalu rumit
- [ ] Pastikan class shell tetap mengacu ke `serene-section`

## `apps/frontend/src/components/dashboard-workspace-shell.tsx`

- [ ] Ganti shell toggle yang masih manual ke primitive baru
- [ ] Pastikan visual floating action tetap sama atau lebih rapi

## `apps/frontend/src/pages/overview-page.tsx`

- [ ] Jadikan halaman pilot untuk hero/header
- [ ] Standardisasi toggle
- [ ] Standardisasi summary/stat card jika ada duplikasi
- [ ] Standardisasi empty state bila ada

## `apps/frontend/src/pages/visa-tracking-page.tsx`

- [ ] Standardisasi search bar
- [ ] Standardisasi toggle
- [ ] Standardisasi hero shell
- [ ] Standardisasi stat cards
- [ ] Standardisasi empty state
- [ ] Standardisasi table shell

## `apps/frontend/src/pages/invoice-list-page.tsx`

- [ ] Standardisasi toggle
- [ ] Standardisasi table shell
- [ ] Standardisasi summary/empty state bila cocok
- [ ] Kurangi card utility mentah berulang

## `apps/frontend/src/pages/raudhah-reminder-page.tsx`

- [ ] Standardisasi toggle
- [ ] Standardisasi hero shell
- [ ] Standardisasi section wrapper yang masih manual

## 7. Definition of Done untuk Phase 1

Phase 1 dianggap selesai jika:

- [ ] primitive global Phase 1 sudah ada
- [ ] toggle dashboard sudah konsisten
- [ ] minimal 3 halaman representative sudah memakai primitive baru
- [ ] search bar dashboard utama sudah seragam
- [ ] minimal satu pola stat card sudah distandardisasi
- [ ] minimal satu pola empty state sudah distandardisasi
- [ ] minimal satu pola table shell sudah distandardisasi

## 8. Verification Checklist

Setelah tiap batch:

- [ ] `npm run check --workspace frontend`
- [ ] `npm run test --workspace frontend`
- [ ] `npm run build:frontend`

Review manual:

- [ ] light mode desktop
- [ ] dark mode desktop
- [ ] mobile viewport utama
- [ ] hover state
- [ ] focus state
- [ ] disabled state
- [ ] empty state

## 9. Out of Scope untuk Phase 1

Jangan dimasukkan ke Phase 1:

- redesign besar halaman
- perubahan copy UI
- refactor modal family besar-besaran
- perubahan form section kompleks
- perubahan feature-specific checklist visuals
- pemecahan file JSX besar menjadi banyak subkomponen jika tidak terkait primitive dasar

## 10. Recommended Next Move

Kalau mau langsung eksekusi coding setelah dokumen ini:

1. mulai dari Batch 1 dan Batch 2
2. pilih `overview-page` dan `visa-tracking-page` sebagai pilot
3. setelah stabil, lanjut `invoice-list-page`

Itu jalur paling aman dan paling cepat memberi hasil visual yang terasa.
