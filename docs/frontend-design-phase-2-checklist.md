# Frontend Design Phase 2 Execution Checklist

Dokumen ini adalah checklist eksekusi untuk fase lanjutan setelah fondasi Phase 1 mulai stabil.

Fokus Phase 2:

- standardisasi family modal dan dialog
- kurangi duplikasi class header, close button, body spacing, dan footer action row
- siapkan pola yang bisa dipakai ulang sebelum masuk ke refactor form section yang lebih luas

Dokumen ini melanjutkan:

- `docs/frontend-design-refactor-plan.md`
- `docs/frontend-design-phase-1-checklist.md`
- `docs/frontend-design-guidelines.md`

## 1. Outcome Phase 2

Hasil minimum yang diharapkan:

- family `serene-dialog-*` cukup lengkap untuk dipakai lintas fitur
- modal besar tidak lagi merakit close button dan footer action row secara manual berulang-ulang
- destructive dialog, confirm dialog, dan editor dialog punya struktur yang lebih seragam
- minimal 3 area modal penting sudah memakai pola yang sama

## 2. Scope File

File utama yang hampir pasti disentuh:

- `apps/frontend/src/styles.css`
- `apps/frontend/src/components/group-detail-modals.tsx`
- `apps/frontend/src/components/visa-detail-modals.tsx`

File kandidat adopsi awal:

- `apps/frontend/src/pages/profile-page.tsx`
- `apps/frontend/src/pages/manage-role-page.tsx`
- `apps/frontend/src/pages/checklist-page.tsx`

File kandidat batch lanjutan:

- `apps/frontend/src/pages/raudhah-reminder-page.tsx`
- `apps/frontend/src/pages/visa-detail-page.tsx`
- `apps/frontend/src/pages/invoice-page.tsx`

## 3. Primitive Yang Harus Dilengkapi

Checklist:

- [ ] Audit ulang keluarga `.serene-dialog-*` yang sudah ada
- [ ] Lengkapi primitive header modal
- [ ] Lengkapi primitive close button shell
- [ ] Lengkapi primitive footer action bar
- [ ] Tambah primitive body section jika duplikasi spacing tinggi
- [ ] Tambah varian untuk destructive/info/accent icon shell bila memang sering berulang

Kandidat nama:

- [ ] `.serene-dialog-body`
- [ ] `.serene-dialog-section`
- [ ] `.serene-dialog-actions-stacked`
- [ ] `.serene-dialog-close-shell`
- [ ] `.serene-dialog-footer-bar`

Catatan:

- Phase 2 tetap mengutamakan primitive CSS lebih dulu
- wrapper React baru dibuat bila pola JSX berulang dan benar-benar mengurangi kebisingan

## 4. Batch Kerja Yang Direkomendasikan

## Batch 1: Audit Modal Inventory

Tujuan:

- memetakan pola modal yang sekarang paling sering diulang

Checklist:

- [ ] Catat modal yang bersifat confirm, destructive, editor, dan info-only
- [ ] Tandai duplikasi terbesar di `group-detail-modals.tsx`
- [ ] Tandai pola serupa di `visa-detail-modals.tsx`
- [ ] Cocokkan mana yang sudah bisa memakai primitive Phase 1 dan mana yang masih manual

Acceptance criteria:

- ada daftar jelas pola mana yang akan disatukan
- perubahan tidak dimulai dari redesign visual, tetapi dari penyamaan struktur

## Batch 2: Lengkapi Primitive Global Dialog

Tujuan:

- membuat fondasi CSS yang cukup untuk sapuan file-file besar

Checklist:

- [ ] Tambah atau rapikan primitive dialog di `styles.css`
- [ ] Pastikan light mode dan dark mode tetap aman
- [ ] Pastikan primitive tetap cocok untuk mobile modal layout
- [ ] Hindari hardcoded color baru jika token semantik sudah cukup

Acceptance criteria:

- primitive baru tidak terlalu spesifik ke satu fitur
- close button, icon shell, dan footer action punya bentuk konsisten

## Batch 3: Quick Adoption di Modal Kecil

Tujuan:

- uji primitive baru di area yang relatif aman

Checklist:

- [ ] Rapikan `profile-page.tsx`
- [ ] Rapikan `manage-role-page.tsx`
- [ ] Rapikan confirm dialog di `checklist-page.tsx`

Acceptance criteria:

- modal kecil lintas fitur terasa satu keluarga
- behavior fokus, scroll, dan close state tidak berubah

## Batch 4: Heavy Sweep `group-detail-modals`

Tujuan:

- mengurangi duplikasi terbesar di file modal paling verbose

Checklist:

- [ ] Samakan header action shell
- [ ] Samakan close button shell
- [ ] Samakan footer action row
- [ ] Rapikan card atau section dalam modal bila ada utility mentah yang berulang
- [ ] Hindari mencampur refactor visual dengan perubahan logic domain

Acceptance criteria:

- baris action bawah tidak lagi dibangun manual di banyak blok
- jumlah utility panjang yang berulang turun nyata
- file lebih mudah dipindai saat review

## Batch 5: Sweep `visa-detail-modals`

Tujuan:

- menerapkan pola yang sama ke keluarga modal kedua yang besar

Checklist:

- [ ] Samakan struktur header
- [ ] Samakan icon shell dan close affordance
- [ ] Samakan footer action bar
- [ ] Audit empty/info state di dalam modal bila ada

Acceptance criteria:

- `visa-detail-modals` mengikuti pola yang sama dengan `group-detail-modals`
- tidak ada regresi pada flow detail visa

## Batch 6: Follow-up Form Action Prep

Tujuan:

- menyiapkan transisi ke fase form section dan action footer berikutnya

Checklist:

- [ ] Identifikasi modal atau page editor yang masih merakit footer form manual
- [ ] Catat pola tombol primary/secondary/cancel yang paling sering
- [ ] Tentukan kandidat awal untuk `.serene-form-section` dan `.serene-form-actions`

Acceptance criteria:

- fase berikutnya sudah punya daftar target yang konkret
- tidak perlu audit ulang dari nol saat masuk refactor form

## 5. Urutan Eksekusi Paling Aman

Urutan yang saya rekomendasikan:

1. `styles.css`
2. `profile-page.tsx`
3. `manage-role-page.tsx`
4. `checklist-page.tsx`
5. `group-detail-modals.tsx`
6. `visa-detail-modals.tsx`
7. baru file editor/form yang lebih kompleks

Alasan urutan ini:

- mulai dari primitive ke adopsi
- uji dulu pada modal kecil
- file paling besar baru disapu setelah pattern-nya stabil

## 6. File-by-File Checklist

## `apps/frontend/src/styles.css`

- [ ] Lengkapi family `.serene-dialog-*`
- [ ] Tambah primitive body/section jika memang ada duplikasi tinggi
- [ ] Pastikan spacing, radius, border, dan shadow tetap konsisten dengan sistem `serene`

## `apps/frontend/src/pages/profile-page.tsx`

- [ ] Pastikan modal edit profile dan change password memakai primitive dialog yang sama
- [ ] Hilangkan utility close button atau footer yang masih manual
- [ ] Jaga visual tetap ringan karena ini modal sederhana

## `apps/frontend/src/pages/manage-role-page.tsx`

- [ ] Samakan modal create/edit/delete role family
- [ ] Pastikan destructive dialog tetap punya emphasis yang jelas
- [ ] Kurangi variasi footer action row

## `apps/frontend/src/pages/checklist-page.tsx`

- [ ] Rapikan confirm dialog checklist
- [ ] Pastikan icon warning/error/info mengikuti shell yang konsisten
- [ ] Verifikasi state loading tombol dan dismiss state tetap jelas

## `apps/frontend/src/components/group-detail-modals.tsx`

- [ ] Sapu semua close button shell yang masih tidak seragam
- [ ] Sapu semua footer action row yang masih dirakit manual
- [ ] Samakan rhythm antar modal tanpa memecah behavior
- [ ] Catat jika ada subkomponen yang layak diekstrak setelah refactor visual selesai

## `apps/frontend/src/components/visa-detail-modals.tsx`

- [ ] Audit pola modal yang paralel dengan group detail
- [ ] Terapkan family dialog yang sama
- [ ] Pastikan dark mode dan mobile layout tetap aman

## 7. Definition of Done untuk Phase 2

Phase 2 dianggap selesai jika:

- [ ] family `.serene-dialog-*` cukup lengkap dan dipakai nyata
- [ ] minimal 3 fitur modal sudah mengikuti pola yang sama
- [ ] `group-detail-modals` dan `visa-detail-modals` mengalami pengurangan duplikasi yang jelas
- [ ] destructive dialog dan confirm dialog terasa konsisten
- [ ] tidak ada regresi fungsi modal

## 8. Verification Checklist

Setelah tiap batch:

- [ ] `npm run check --workspace frontend`
- [ ] `npm run test --workspace frontend`
- [ ] `npm run build:frontend`

Review manual:

- [ ] light mode desktop
- [ ] dark mode desktop
- [ ] mobile viewport utama
- [ ] focus trap dan tab order
- [ ] overlay click / close button behavior
- [ ] loading state tombol
- [ ] destructive dialog emphasis

## 9. Out of Scope untuk Phase 2

Jangan dimasukkan ke Phase 2:

- redesign total modal content
- pemecahan logic domain besar di modal-heavy files
- refactor form section besar-besaran
- perubahan copy UI
- perubahan token warna global

## 10. Recommended Next Move

Kalau mau langsung dieksekusi setelah dokumen ini:

1. lengkapi dulu primitive dialog di `styles.css`
2. jadikan `profile` dan `manage-role` sebagai pilot aman
3. lanjut sapuan `group-detail-modals`
4. tutup dengan `visa-detail-modals`

Jalur ini memberi hasil yang terasa sekaligus tetap aman untuk direview dan diuji bertahap.
