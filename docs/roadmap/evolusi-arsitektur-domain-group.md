# Panduan Evolusi Arsitektur Domain: Mengurangi Fat Aggregate `Group`

Dokumen ini berfungsi sebagai cetak biru (*blueprint*) dan acuan jangka panjang untuk evolusi arsitektur sistem GTT. Fokus utamanya adalah memecah tanggung jawab bisnis dari entitas `Group` agar tidak berkembang menjadi **Fat Aggregate** yang kompleks, sulit dipelihara, dan memiliki tingkat ketergantungan (*coupling*) yang tinggi.

---

## 1. Latar Belakang & Masalah

### Kondisi Saat Ini
Saat ini, hampir seluruh alur bisnis operasional umrah dalam sistem GTT mengacu pada entitas `Group` (Rombongan). Struktur agregat saat ini dirancang secara sederhana seperti berikut:

```
Group (Aggregate Root)
├── Musyrif
├── Timeline
├── Itinerary
├── Notes
├── Visa
├── Checklist
├── Invoice
└── Audit Log
```

Desain awal ini terbukti efektif untuk kebutuhan awal sistem karena memudahkan pemahaman alur kerja operasional.

### Ancaman "Fat Aggregate"
Seiring bertambahnya fitur operasional, jika semua domain bisnis baru disematkan langsung di dalam lingkup `Group`, maka domain ini akan membengkak menjadi **Fat Aggregate**:

```
Group (Fat Aggregate)
├── Visa               ├── Operational Journey  ├── Catering
├── Hotel              ├── Flight               ├── Rooming
├── Driver & Syarikah  ├── Insurance            ├── Finance (Invoice, Payment, Refund)
├── Passport           ├── Notification         ├── CRM
├── Jamaah             ├── Reporting            └── ...
```

**Dampak Negatif Fat Aggregate:**
* **Degradasi Pemeliharaan (Maintenance):** `GroupService` menjadi terlalu besar (*god class*) dengan ribuan baris kode yang sulit dibaca.
* **Ketergantungan Tinggi (High Coupling):** Perubahan kecil pada modul keuangan atau visa dapat merusak aliran data utama pada group.
* **Kesulitan Pengujian (Testing):** Unit testing untuk `Group` membutuhkan mock object yang sangat banyak karena keterkaitan dengan terlalu banyak sub-sistem.
* **Kaburnya Batasan Bisnis (Bounded Context):** Batas tanggung jawab antar modul menjadi tidak jelas.

---

## 2. Tujuan & Prinsip Desain

Tujuan dari rancangan evolusi ini **bukan untuk memecah tabel/database `Group`**, melainkan mendistribusikan tanggung jawab logika bisnis ke dalam sub-domain yang terisolasi secara logis (*Modular Monolith*).

### Prinsip Utama
1. **Group sebagai Poros Utama (Core Aggregate):** `Group` tetap dipertahankan sebagai poros data operasional (*Anchor*). Semua relasi bisnis merujuk ke ID Group, tetapi logika pemrosesan internalnya dipisahkan.
2. **Pemisahan Aturan Bisnis (Separation of Business Rules):** Setiap domain memiliki domain service sendiri yang menyimpan aturan validasi internalnya masing-masing.
3. **Interaksi Minim & Terarah:** Domain-domain pendukung dilarang saling memanggil secara melingkar (*circular dependency*). Komunikasi dilakukan melalui orkestrasi alur kerja (*Workflow Layer*) atau melalui referensi ID Group.

---

## 3. Peta Jalan Arsitektur Domain (Architecture Roadmap)

Visualisasi struktur logis domain pasca-refaktorisasi:

```
🏗️ Domain Architecture Roadmap
│
├── Group (Core Aggregate Root)
│
├── Operational Domain (Timeline, Itinerary, Checklist, Journey)
│
├── Visa Domain (Visa Setup, Passport, Raudhah/Nusuk Approval)
│
├── Finance Domain (Invoice, Payment, Refund, Credit Note, Exchange Rate)
│
├── Transportation Domain (Syarikah, Driver, Vehicle, Assignment)
│
├── Agent Domain (B2B Agent, Group Ownership, Agent Portal)
│
├── Customer Domain (Jamaah, Manifest, Profiling)
│
├── Notification Domain (In-app, WhatsApp, Email Dispatcher)
│
└── Workflow Layer (Orchestrator lintas sub-domain)
```

---

## 4. Spesifikasi Sub-Domain (Bounded Context)

Setiap sub-domain dirancang dengan batasan tanggung jawab yang ketat (*Strict Bounded Context*):

### A. Operational Domain
Mengelola seluruh aktivitas teknis perjalanan di lapangan.
* **Tanggung Jawab:** Menyediakan status timeline, detail itinerary, daftar checklist kesiapan, serta melacak tahapan perjalanan rombongan (*Operational Journey*).
* **Komponen Utama:** `TimelineService`, `ItineraryService`, `ChecklistService`.

### B. Visa Domain
Mengelola aspek administratif legalitas keberangkatan jamaah.
* **Tanggung Jawab:** Mengelola kebutuhan visa setup per group, verifikasi paspor, slot pengajuan Raudhah/Nusuk, serta persetujuan (*approval*) dokumen visa.
* **Komponen Utama:** `VisaService`, `PassportValidator`.

### C. Finance Domain
Mengelola siklus keuangan dan transaksi yang berkaitan dengan pemesanan group.
* **Evolusi Desain:** Mengubah pola pikir dari *Invoice-centric* menjadi *Finance-centric*. Invoice tidak berdiri sebagai domain sendiri, melainkan salah satu dokumen output keuangan bersama dengan komponen lainnya.
* **Tanggung Jawab:** Validasi pembuatan invoice, pencatatan pembayaran (*Payment*), proses pengembalian dana (*Refund*), pengelolaan nota kredit (*Credit Note*), penanganan selisih kurs (*Exchange Rate*), dan penyusunan laporan keuangan (*Financial Report*).
* **Batasan Penting:** Domain lain (seperti Visa atau Operational) dilarang menghitung komponen biaya atau memproses logika pembayaran secara langsung. Perhitungan finansial harus didelegasikan penuh ke `FinanceService`.

### D. Transportation Domain
Mengelola pemesanan dan koordinasi logistik transportasi darat (bus/kendaraan operasional).
* **Logika Bisnis Lapangan:** Sistem GTT tidak memesan driver secara langsung, melainkan bermitra dengan perusahaan penyedia transportasi (**Syarikah**). Syarikah kemudian menugaskan driver dan kendaraan tertentu ke perjalanan tersebut.
* **Evolusi Bertahap:**
  1. **Fase Temp (Input Manual):** Driver dan Syarikah diisi sebagai string teks biasa di dalam checklist. Sistem di latar belakang mulai mengumpulkan data unik ini untuk membangun Master Data awal secara otomatis.
  2. **Fase Semi-Automated (Autocomplete & Lookup):** UI menyediakan pilihan dari data Syarikah dan Driver yang pernah terdaftar untuk mengurangi typo, namun tetap mengizinkan input manual jika ada resource baru.
  3. **Fase Master Data Penuh (Managed Master Data):** Penugasan driver dan bus divalidasi berdasarkan ketersediaan armada aktif di bawah manajemen master data `Syarikah`, `Driver`, dan `Vehicle`.

### E. Agent Domain
Mengelola relasi kemitraan bisnis B2B.
* **Tanggung Jawab:** Mengelola kepemilikan group oleh agen tertentu, kuota pendaftaran, portal login agen, serta statistik performa penjualan agen.

### F. Customer Domain
Pusat manajemen data pelanggan (*Jamaah*).
* **Tanggung Jawab:** Mengelola profil jamaah, pengelompokan manifest keberangkatan, rekam medis ringkas, dan kebutuhan personal jamaah selama perjalanan.

### G. Notification Domain
Layanan terpusat untuk komunikasi keluar.
* **Tanggung Jawab:** Menangani pengiriman pesan WhatsApp, email, atau notifikasi aplikasi berdasarkan pemicu kejadian (*event*) dari domain lain.

### H. Workflow Layer (Orchestration)
Lapisan atas yang tidak menyimpan state database, melainkan mengoordinasikan interaksi antar domain.
* **Contoh Kasus:** Menentukan status kesiapan keberangkatan group dengan memeriksa data dari berbagai sub-domain:
  ```
  Workflow: Cek Kesiapan Keberangkatan Group
  ├── Cek Visa Domain (Apakah semua passport & visa sudah approved?)
  ├── Cek Finance Domain (Apakah sisa pelunasan invoice = 0?)
  └── Cek Operational Domain (Apakah checklist logistik sudah 100%?)
  ```

---

## 5. Strategi Implementasi Bertahap

Untuk meminimalisir risiko kegagalan sistem operasional yang sedang berjalan, pemisahan dilakukan melalui tiga fase:

### Fase 1: Restrukturisasi Kode (Logical Separation)
* Membagi service monolith yang besar menjadi service-service kecil (misal: `GroupService` didekomposisi menjadi `OperationalService`, `VisaService`, `FinanceService`).
* Struktur database dan tabel SQL tetap sama (belum ada pemisahan tabel). Pengurangan *coupling* dilakukan di tingkat aplikasi terlebih dahulu.

### Fase 2: Isolasi Aturan Bisnis (Encapsulation of Business Rules)
* Menegakkan aturan bahwa suatu domain hanya boleh memanipulasi data miliknya sendiri. 
* Operasi lintas domain tidak lagi dilakukan dengan menulis query SQL gabungan (*cross-join* yang kompleks pada domain service), melainkan melalui pemanggilan metode antar Service resmi.

### Fase 3: Orkestrasi Alur Kerja (Workflow Integration)
* Memperkenalkan modul orkestrator khusus untuk alur kerja yang melibatkan banyak domain.
* Logika orkestrasi ditarik keluar dari entitas domain individual ke lapisan `Workflow Layer`.
