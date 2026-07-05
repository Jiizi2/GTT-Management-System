# Panduan Evolusi Arsitektur: Modul Finance (Keuangan)

Dokumen ini menjelaskan strategi evolusi untuk modul keuangan dalam sistem GTT. Tujuannya adalah menggeser paradigma modul dari yang sebelumnya berorientasi pada dokumen tunggal (*Invoice-centric*) menjadi domain keuangan yang terintegrasi (*Finance Domain*), guna mendukung skalabilitas fitur keuangan di masa depan tanpa memerlukan perombakan arsitektur yang besar.

---

## 1. Kondisi Saat Ini (As-Is)

Saat ini, arsitektur modul keuangan terpusat pada entitas **Invoice** dengan struktur dasar sebagai berikut:

```
Invoice
└── InvoiceItem
```

Meskipun sederhana, struktur ini telah dirancang dengan baik untuk memenuhi kebutuhan saat ini dan mendukung fitur-fitur penting seperti:
* **Line Items:** Fleksibilitas dalam mendefinisikan detail komponen tagihan di dalam satu invoice.
* **Optimistic Locking:** Mencegah terjadinya konflik penulisan data finansial yang konkuren (bersamaan).
* **Multiple Payment Preparation:** Kesiapan sistem untuk menangani skema pembayaran parsial atau cicilan.
* **State Management (Invoice Status):** Transisi status pembayaran (misal: *Draft*, *Unpaid*, *Partially Paid*, *Paid*, *Cancelled*) yang terdefinisi dengan jelas.

---

## 2. Analisis Kebutuhan Masa Depan (To-Be)

Seiring dengan berkembangnya skala bisnis operasional umrah GTT, kompleksitas transaksi keuangan akan meningkat. Beberapa potensi kebutuhan bisnis yang perlu diantisipasi meliputi:

### A. Kompleksitas Transaksi & Pembayaran
* **Multi-Payment:** Kemampuan satu invoice untuk menerima beberapa kali pembayaran dari berbagai metode (misal: transfer bank, gerbang pembayaran, atau tunai).
* **Multi-Currency & Exchange Rate:** Penanganan transaksi dalam mata uang berbeda (misal: pembayaran uang muka dalam IDR, pelunasan biaya lokal di Arab Saudi menggunakan SAR atau USD) dengan perhitungan selisih kurs yang tercatat.

### B. Koreksi & Pengembalian Dana
* **Refund Management:** Alur formal untuk melakukan pengembalian dana kepada jamaah, baik secara parsial maupun penuh.
* **Credit Notes & Adjustments:** Dokumen koreksi untuk mengurangi nilai tagihan invoice jika terjadi penyesuaian paket atau diskon pasca-penerbitan invoice.

### C. Akuntabilitas & Pelaporan
* **Payment History Audit:** Pelacakan riwayat pembayaran yang tidak dapat diubah (*immutable transaction log*) untuk keperluan audit internal.
* **Double-Entry Journaling:** Sistem pencatatan jurnal akuntansi sederhana guna menghasilkan laporan arus kas (*Cash Flow*) dan laporan laba-rugi operasional.

### Rancangan Ekosistem Finance Domain
Untuk mengakomodasi kebutuhan di atas, struktur modul keuangan akan berevolusi menjadi:

```
Finance Domain
├── Invoice (Dokumen Tagihan)
│   └── InvoiceItem (Detail Tagihan)
├── Payment (Pencatatan Pembayaran & Aliran Kas Masuk)
├── Refund (Pencatatan Pengembalian Dana)
├── Adjustment (Penyesuaian Nilai Transaksi)
├── Credit Note (Koreksi Tagihan)
├── Exchange Rate (Manajemen Nilai Tukar Kurs)
└── Journal (Pencatatan Akuntansi / Ledger)
```

---

## 3. Rekomendasi Strategi Arsitektur

Untuk mengantisipasi evolusi ini, tim pengembang disarankan menerapkan prinsip-prinsip berikut:

### A. Ubah Sudut Pandang Modul
Invoice harus dipandang sebagai **salah satu jenis dokumen output** di bawah payung *Finance Domain*, bukan sebagai domain utama itu sendiri. Domain utamanya adalah *Finance*, yang bertugas mengelola siklus hidup uang masuk dan uang keluar.

### B. Isolasi Logika Perhitungan Finansial
Semua rumus perhitungan (seperti sisa tagihan, pembagian termin pembayaran, konversi mata uang, dan kalkulasi PPN/diskon) harus diisolasi di dalam *Finance Domain Service*. Modul luar (seperti `Group`, `Operational`, atau `Visa`) hanya boleh menerima hasil kalkulasi akhir atau memicu aksi keuangan melalui *event/interface* yang disediakan.

### C. Struktur Folder Modular
Mulai pisahkan kode sumber modul invoice ke dalam direktori/namespace yang lebih umum (misalnya dari `app/Modules/Invoice` menjadi `app/Modules/Finance`), sehingga komponen seperti `Payment` atau `ExchangeRate` dapat ditambahkan sebagai sub-modul yang sejajar dengan `Invoice`.
