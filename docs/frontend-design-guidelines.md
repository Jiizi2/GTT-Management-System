# Frontend Design Consistency Guide

Dokumen ini adalah pedoman desain frontend berdasarkan implementasi UI yang sudah ada saat ini di `apps/frontend`.

Tujuannya bukan mengganti visual yang sekarang, tetapi menjaga agar fitur baru tetap terasa satu produk: konsisten, rapi, mudah dirawat, dan tidak bercampur gaya.

## 1. Arah Visual Saat Ini

Frontend saat ini sudah punya identitas yang cukup jelas:

- Tema utama: `serene`
- Karakter visual light mode: bersih, lembut, hijau natural, surface terang, shadow halus
- Karakter visual dark mode: hangat, emas-gelap, kontras lembut, gradient lebih terasa
- Bahasa bentuk: rounded, lembut, banyak radius besar
- Bahasa elevasi: kartu/sheet/modal memakai shadow ringan sampai floating
- Bahasa teks: heading tegas, body ringan, label cukup halus

Kesimpulan penting:

- Jangan membuat halaman baru dengan gaya “Tailwind default” yang lepas dari sistem ini.
- Jangan campur tema baru yang tidak memakai token warna existing.
- Kalau perlu gaya baru, turunkan dari token dan komponen `serene`, bukan membuat pola visual baru dari nol.

## 2. Sumber Kebenaran Visual

Sumber utama style saat ini:

- `apps/frontend/src/styles.css`
- token warna dan shadow di `:root` dan `:root[data-theme="dark"]`
- komponen utility bersama seperti:
  - `.serene-section`
  - `.serene-card`
  - `.serene-card-interactive`
  - `.serene-btn-primary`
  - `.serene-btn-secondary`
  - `.serene-btn-tertiary`
  - `.serene-input`
  - `.serene-select`
  - `.serene-textarea`
  - `.serene-modal-overlay`
  - `.serene-modal-shell`

Aturan:

- Utamakan token CSS dan class `serene-*` yang sudah ada.
- Hindari menulis warna hardcoded langsung di JSX kalau sudah ada token setara.
- Jika pola baru mulai dipakai di 2 tempat atau lebih, pindahkan ke `styles.css` sebagai primitive baru.

## 3. Prinsip Dasar Konsistensi

### 3.1 Pakai token, bukan warna mentah

Prioritas pemakaian:

1. class/token semantik seperti `bg-surface-container-lowest`, `text-on-surface`, `border-outline-variant`
2. class `serene-*`
3. utility Tailwind mentah hanya jika belum ada primitive yang cocok

Hindari:

- `text-green-600`, `bg-white`, `border-gray-200` untuk UI utama bila sudah ada token semantik
- warna acak per halaman

### 3.2 Pakai surface hierarchy yang sama

Urutan surface yang sekarang konsisten:

- page background: `bg-surface` atau `bg-surface-container-low`
- main card: `bg-surface-container-lowest`
- nested container: `bg-surface-container-low` atau `bg-surface-container-high`
- floating layer: `serene-modal-shell` atau surface floating lain

Aturan:

- Jangan melompati hierarchy tanpa alasan.
- Jangan membuat semua blok putih polos jika halaman sudah memakai depth bertingkat.

### 3.3 Radius harus terasa satu keluarga

Pola radius yang paling sering dipakai:

- page hero / section besar: `rounded-3xl`
- card umum: `rounded-2xl`
- input / button / select: `rounded-md`, `rounded-lg`, `rounded-xl`
- chip / badge: `rounded-full` atau `rounded-lg`

Aturan:

- Gunakan radius besar untuk container besar, radius lebih kecil untuk elemen interaktif kecil.
- Hindari campuran ekstrem dalam satu area, misalnya card `rounded-sm` berdampingan dengan komponen `rounded-3xl`.

### 3.4 Shadow dipakai sebagai hirarki, bukan dekorasi

Shadow yang ada sekarang:

- `shadow-ambient`: kartu normal
- `shadow-float`: modal, sheet, floating picker
- `shadow-cta-soft`: tombol primary tertentu

Aturan:

- Maksimal satu level elevasi dominan per blok.
- Jangan menambahkan shadow keras yang berbeda karakter.
- Untuk komponen biasa, lebih baik pakai border + surface daripada shadow tebal.

## 4. Typography Rules

## 4.1 Font role

Yang terlihat di kode sekarang:

- body font mengikuti `--serene-font-family`
- heading global memakai `"Manrope", sans-serif`
- brand tertentu memakai `"Noto Naskh Arabic", serif`

Aturan:

- Heading layar, judul section, dan title dialog tetap memakai gaya heading yang tegas
- Body text, label, helper text, dan input text tetap mengikuti font utama tema
- Font dekoratif seperti Naskh hanya untuk branding, bukan untuk isi UI umum

## 4.2 Hierarki teks

Pola umum yang sudah bagus dan sebaiknya dipertahankan:

- page title: `text-2xl` sampai `text-5xl`, `font-bold` atau `font-extrabold`
- section title: `text-lg` sampai `text-2xl`, `font-bold`
- body utama: `text-sm` atau `text-base`
- helper text: `text-xs` atau `text-sm`
- micro label: uppercase kecil dengan tracking yang rapat

Aturan:

- Satu halaman idealnya punya 1 hero title utama.
- Jangan terlalu banyak memakai uppercase besar untuk body text.
- Jangan campur terlalu banyak ukuran heading dalam satu layar.

## 5. Layout Rules

## 5.1 Struktur halaman

Pola halaman yang paling sering muncul:

- wrapper utama: `mx-auto`
- max width: `max-w-7xl` atau varian lebih lebar untuk tabel
- vertical spacing: `space-y-6`
- padding responsif: `px-4 sm:px-6 lg:px-8`

Aturan:

- Gunakan wrapper halaman yang konsisten.
- Halaman dashboard sebaiknya mulai dari struktur:
  - search / top action
  - hero / intro
  - summary / filters
  - content utama

## 5.2 Spacing scale

Pola yang sering dipakai:

- container padding: `p-4`, `p-5`, `p-6`
- page gap: `gap-3`, `gap-4`, `gap-6`
- micro spacing: `mt-1`, `mt-2`, `gap-1.5`, `gap-2`

Aturan:

- Pilih 1 skala utama per section, jangan terlalu banyak angka acak.
- Untuk section besar, utamakan `4`, `5`, `6`.
- Untuk elemen kecil, utamakan `1`, `1.5`, `2`, `3`.

## 6. Komponen yang Harus Distandardisasi

## 6.1 Card

Gunakan:

- `.serene-card` untuk card default
- `.serene-card-interactive` untuk card yang bisa diklik
- `.serene-section` untuk container section besar

Jangan:

- membuat card baru dengan kombinasi utility panjang jika style dasarnya sama

## 6.2 Form

Gunakan:

- `.serene-field`
- `.serene-input`
- `.serene-select`
- `.serene-textarea`
- `.serene-select-pill` untuk filter/select kecil

Aturan:

- Label form selalu hadir dan konsisten
- Error, helper, placeholder, dan disabled state harus mengikuti sistem yang sama
- Jangan membuat input “spesial” dengan border/ring berbeda tanpa kebutuhan jelas

## 6.3 Button

Gunakan:

- `.serene-btn-primary` untuk aksi utama
- `.serene-btn-secondary` untuk aksi pendamping
- `.serene-btn-tertiary` untuk aksi ringan

Aturan:

- Satu area sebaiknya hanya punya satu primary action dominan
- Jangan membuat lebih dari satu tombol primary yang saling bersaing dalam satu grup kecil
- Untuk destructive action, boleh extend dari secondary atau pattern existing yang jelas

## 6.4 Modal dan sheet

Gunakan:

- `.serene-modal-overlay`
- `.serene-modal-shell`

Aturan:

- Focus trap, close action, dan keyboard behavior harus seragam
- Padding internal modal sebaiknya konsisten dengan halaman form kecil
- Jika butuh variasi, variasikan isi modal, bukan shell modalnya

## 6.5 Badge, chip, status

Gunakan:

- `.serene-chip`
- `.serene-chip-complete`
- `.serene-chip-warning`
- `.serene-chip-alert`

Aturan:

- Status harus punya arti semantik yang sama lintas modul
- Jangan pakai warna berbeda untuk arti yang sama di halaman berbeda

## 7. Kapan Membuat Primitive Baru

Buat primitive baru di `styles.css` jika:

- pattern muncul di minimal 2 komponen/halaman
- utility class sudah terlalu panjang dan sulit dibaca
- style punya state yang konsisten
- visual itu bagian dari bahasa produk, bukan kasus unik

Contoh kandidat bagus:

- hero panel dashboard
- stat card
- filter toolbar
- table shell
- form section header

Jangan buat primitive baru jika:

- hanya dipakai sekali
- masih terlalu spesifik ke satu fitur
- namanya berdasarkan isi bisnis, bukan peran UI

## 8. Naming Convention Untuk Style Baru

Gunakan nama berdasarkan peran UI, bukan nama halaman.

Lebih baik:

- `.serene-stat-card`
- `.serene-toolbar`
- `.serene-panel-header`

Kurang baik:

- `.visa-blue-card`
- `.checklist-box-2`
- `.new-group-top-section-final`

Jika memang sangat feature-specific, pakai prefix feature yang jelas hanya untuk area unik:

- `.checklist-*`
- `.invoice-*`
- `.visa-*`

## 9. Anti-Pattern Yang Sebaiknya Dihindari

- Menulis kombinasi utility panjang yang mengulang primitive `serene-*`
- Menambah warna baru langsung di JSX
- Memakai `border-slate-*` atau `bg-white` secara acak untuk UI utama
- Membuat halaman baru dengan jarak, radius, dan shadow berbeda total
- Mencampur dua gaya komponen dalam satu form
- Menggunakan banyak ukuran teks kecil berbeda tanpa alasan
- Membuat satu fitur terasa seperti produk lain

## 10. Rekomendasi Refactor Bertahap

Dari kondisi kode sekarang, area yang paling layak dirapikan bertahap:

1. Samakan card shell lintas page ke primitive yang lebih sedikit
2. Samakan top search bar / toolbar pattern
3. Samakan summary stat card pattern
4. Samakan dialog footer action layout
5. Kurangi utility mentah berulang pada page yang sudah punya style mirip

Refactor ini tidak perlu sekaligus. Yang penting, fitur baru jangan menambah variasi baru yang tidak perlu.

## 11. Checklist Saat Menambah UI Baru

Sebelum merge perubahan frontend visual, cek:

- Apakah warna memakai token yang sudah ada?
- Apakah card/container bisa memakai `serene-*` existing?
- Apakah radius dan shadow sejalan dengan halaman lain?
- Apakah button hierarchy jelas?
- Apakah spacing mengikuti skala yang umum dipakai?
- Apakah dark mode tetap masuk akal?
- Apakah fokus, hover, disabled, dan empty state konsisten?
- Apakah saya baru saja membuat pattern baru yang seharusnya dijadikan primitive bersama?

## 12. Usulan Workflow Tim

Untuk menjaga konsistensi ke depan:

1. Saat membuat halaman baru, mulai dari primitive `serene-*` dulu
2. Jika butuh style baru, cek dulu apakah sudah ada pola setara di halaman lain
3. Jika pola baru akan dipakai ulang, pindahkan ke `styles.css`
4. Review frontend tidak hanya cek fungsi, tetapi juga:
   - konsistensi visual
   - konsistensi spacing
   - konsistensi hierarchy
   - dark mode
   - accessibility state

## 13. Ringkasan Praktis

Kalimat sederhananya:

- pakai token yang ada
- pakai primitive `serene-*`
- jangan hardcode visual baru tanpa alasan
- kalau pattern mulai berulang, jadikan style bersama
- halaman baru harus terasa seperti kelanjutan produk yang sama
