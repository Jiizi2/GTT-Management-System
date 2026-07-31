# Invoice Module Engineering Rules

Dokumen ini mendefinisikan aturan dan guardrail teknis untuk pengembangan dan modifikasi di modul Invoice GTT. Setiap developer wajib mematuhi aturan ini untuk mencegah timbulnya kembali technical debt atau inkonsistensi sinkronisasi.

---

## 1. State Derivation & Ownership

* **Derived State Tidak Boleh Disimpan di RHF**:
  * Nilai kalkulasi turunan seperti `totalPrice`, `totalPriceIdr`, `downPaymentIdr`, `remainingBalance`, dan `invoiceStatus` **dilarang keras** didaftarkan sebagai field form RHF yang divalidasi atau disimpan dalam RHF state default values.
  * Gunakan pure function `deriveInvoiceState` pada saat rendering untuk menurunkan visual statenya.

* **Dilarang Menggunakan Global `watch()`**:
  * Jangan memanggil `watch()` global tanpa parameter di parent component (`CreateInvoiceWorkspace`) untuk menghindari re-render total seluruh halaman saat pengguna sedang mengetik.
  * Gunakan hook RHF `useWatch` yang terlokalisasi di dalam sub-komponen (seperti `<PackageItemsSection />` atau `<PaymentHistorySection />`).
  * Jika parent component membutuhkan informasi perubahan list item, gunakan **serialized string watch** (misalnya memantau `.map(item => item.currency).join(",")`) untuk membatasi re-render parent hanya pada pergantian tipe/mata uang.

* **Dilarang Membuat `useEffect` Penyalin State**:
  * Jangan pernah menyalin data input RHF ke state lokal React lain menggunakan sinkronisasi `useEffect` (misalnya menyalin total harga ke total tagihan). Segala visualisasi status dihitung langsung saat render.

---

## 2. Calculation Helpers & Payload Builders

* **Semua Helper Derivasi Wajib Pure**:
  * Fungsi penurun state (seperti `deriveItemTotals`, `deriveSubtotal`, `derivePayments`, `derivePreviewStatus`) harus bersifat murni (*pure function*): tanpa efek samping (*side-effects*), tidak memodifikasi argumen input, dan menghasilkan output identik untuk input yang sama.

* **Payload Builder Bebas dari Aturan Bisnis**:
  * `buildInvoicePayload` hanya merakit, memetakan, dan memformat payload input dari form ke format API DTO. Aturan validasi dan kalkulasi nominal akhir berada di luar tanggung jawab payload builder.

---

## 3. Backend Authority & Domain Invariants

* **Semua Invariant Wajib Berada di Backend**:
  * Aturan bisnis kritis (seperti pencegahan input nominal negatif, batas pembayaran, atau penolakan histori pembayaran baru pada invoice berstatus `CANCELLED`) wajib divalidasi dan dijalankan secara otoritatif oleh backend service (`invoices.service.ts`).
  * Backend **tidak boleh mempercayai total harga** (`totalPrice`/`totalPriceIdr`) yang dikirim langsung dari frontend. Backend wajib menghitung ulang seluruh total harga berdasarkan data dasar (`pax`, `unitPrice`, dan exchange rates yang diekstrak dari notes).

* **Validasi Tersegmentasi**:
  * Pemrosesan validasi di service layer dipisah menjadi modul kecil yang terfokus (`validateAmounts`, `validateItems`, `validatePayments`) sebelum dipanggil di bawah satu orchestrator utama.

---

## 4. Presisi Nominal (Decimal)

* **Nominal Uang Selalu 2 Desimal**:
  * Semua kolom nominal invoice bertipe `DECIMAL(12,2)`. Nominal **dilarang keras** dibulatkan ke bilangan bulat di lapisan mana pun (helper, repository, API client, formatter, maupun export). Deposit agent kerap merupakan hasil konversi USD→SAR dan bernilai seperti `468,75` atau `505,20`.
  * Gunakan `roundMoney`/`clampMoney`/`sumMoney` dari `apps/backend/src/utils/money.ts` dan `apps/frontend/src/shared/money.ts`. Pembulatan dilakukan di **setiap batas** perhitungan (per item, per subtotal, per payload), bukan hanya di akhir, agar invoice yang dibuka lalu disimpan ulang tidak berubah nilainya.
  * `Math.round` hanya boleh dipakai untuk kuantitas non-uang: `pax`, `sortOrder`, `totalPages`, dan persentase.
  * Konversi valas **dilarang menggunakan `Math.ceil`**. Membulatkan ke atas menaikkan tagihan pelanggan secara sistematis.

* **Perbandingan Nominal Wajib Bertoleransi**:
  * Penentuan status (`PAID` / `PARTIALLY_PAID`) dan sisa tagihan wajib memakai `isMoneyAtLeast`, bukan `>=` pada float mentah. Tanpa toleransi ini, invoice yang dibayar persis dapat tersangkut di `PARTIALLY_PAID` dengan sisa Rp 0,004.

* **Tag Metadata di `notes` Harus Konsisten**:
  * Exchange rate dan histori pembayaran disimpan sebagai tag di dalam kolom `notes`. Pola baca dan pola strip **wajib menerima bentuk yang sama persis** — bila keduanya berbeda, tag yang gagal diparse juga gagal disembunyikan dan akan bocor ke PDF invoice pelanggan.
  * Semua pola ini terpusat di `apps/frontend/src/shared/invoice-notes-tags.ts` (dan cerminannya di `extractExchangeRatesFromNotes` pada backend). Jangan mendeklarasikan ulang regex tag di call site.

---

## 5. Schema Evolution

* **Mengikuti Pola Expand-Contract**:
  * Setiap perubahan struktur database (seperti transisi dari JSON items ke tabel relasional) wajib menggunakan skema migrasi bertahap:
    1. **Expand**: Membuat kolom/tabel baru tanpa merusak data lama, lalu menuliskan logika *dual write* di backend.
    2. **Backfill**: Migrasi data lama dari kolom lama ke kolom/tabel baru secara aman.
    3. **Contract**: Mengubah kode untuk membaca kolom baru, mematikan penulisan kolom lama, dan menghapus (*drop*) kolom lama setelah diverifikasi aman di production.
