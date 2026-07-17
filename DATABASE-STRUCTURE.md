# 📊 Struktur Database

> Dokumentasi lengkap struktur database, relasi antar tabel, dan desain arsitektur data.

## Stack Teknologi

| Komponen | Teknologi |
|----------|-----------|
| Database | PostgreSQL |
| ORM | Prisma |
| Primary Key | CUID (collision-resistant unique ID) |
| Schema | `apps/backend/prisma/schema.prisma` |
| Migrations | `apps/backend/prisma/migrations/` (lihat direktori migration sebagai sumber terkini) |

---

## 🗂️ Daftar Tabel

Total: **21 tabel**

| No | Tabel | Fungsi |
|----|-------|--------|
| 1 | `Group` | Entitas inti — rombongan haji/umrah |
| 2 | `Musyrif` | Pimpinan/pembimbing rombongan |
| 3 | `NextActivity` | Aktivitas terdekat grup |
| 4 | `GroupTimelineItem` | Timeline event grup |9ROUTE
| 5 | `ItineraryItem` | Detail itinerary per hari |
| 6 | `GroupNote` | Catatan untuk grup |
| 7 | `VisaSetup` | Konfigurasi visa grup |
| 8 | `VisaHotelAgreement` | Kesepakatan hotel untuk visa |
| 9 | `HotelAgreementDraft` | Draft kesepakatan hotel |
| 10 | `RaudhahAppointment` | Jadwal kunjungan Raudhah |
| 11 | `ChecklistAssignment` | Checklist perjalanan |
| 12 | `ChecklistDriver` | Sopir yang ditugaskan |
| 13 | `InvoiceClient` | Klien faktur |
| 14 | `Invoice` | Faktur/invoice |
| 15 | `InvoiceItem` | Line items per invoice |
| 16 | `AuthUser` | User autentikasi |
| 17 | `AuthLoginRateLimitBucket` | Rate limiting login |
| 18 | `AppThrottleBucket` | Throttling API umum |
| 19 | `GroupAuditLog` | Log audit perubahan grup |
| 20 | `MasterDataOption` | Master data lookup |
| 21 | `Agent` | Pemilik bisnis Group (GTT Direct atau agen mitra) |

---

## 📋 Detail Tabel

### `Agent` — Pemilik Bisnis Operasional

| Kolom | Tipe | Constraints | Keterangan |
|-------|------|-------------|------------|
| `id` | TEXT | PK, DEFAULT `cuid()` | Identitas stabil Agent |
| `code` | TEXT | UNIQUE, NOT NULL | Kode bisnis Agent |
| `name` | TEXT | NOT NULL | Nama Agent |
| `type` | Enum | NOT NULL | `DIRECT` atau `PARTNER` |
| `status` | Enum | NOT NULL | `ACTIVE` atau `INACTIVE` |
| `picName`, `phone`, `email`, `address`, `notes` | TEXT | Nullable | Profil dan kontak internal |

Agent yang sudah digunakan tidak dihapus. Statusnya diubah menjadi `INACTIVE` agar histori tetap utuh.

---

### 1. `Group` — Entitas Inti

Tabel pusat yang menjadi referensi hampir semua tabel lain.

| Kolom | Tipe | Constraints | Keterangan |
|-------|------|-------------|------------|
| `id` | TEXT | PK, DEFAULT `cuid()` | ID unik |
| `code` | TEXT | UNIQUE | Kode grup |
| `name` | TEXT | NOT NULL | Nama grup |
| `status` | TEXT | NOT NULL | Status bebas (teks) |
| `lifecycleStatus` | Enum | NOT NULL, DEFAULT `ACTIVE` | `ENTRY_ONLY`, `ACTIVE`, `INACTIVE`, `COMPLETED`, `ARCHIVED` |
| `searchDocument` | TEXT | NOT NULL, DEFAULT `''` | Index pencarian trigram (fuzzy search) |
| `tone` | Enum | NOT NULL, DEFAULT `ACTIVE` | `ACTIVE`, `INACTIVE` |
| `arrivalDate` | TIMESTAMP | NOT NULL | Tanggal kedatangan |
| `returnDate` | TIMESTAMP | NOT NULL | Tanggal kepulangan |
| `pax` | INTEGER | NOT NULL | Jumlah jamaah |
| `totalBuses` | INTEGER | Nullable | Total bus yang dibutuhkan |
| `packageName` | TEXT | NOT NULL | Nama paket perjalanan |
| `durationDays` | INTEGER | NOT NULL | Durasi perjalanan (hari) |
| `agentId` | TEXT | NOT NULL, FK → `Agent.id` (RESTRICT) | Pemilik bisnis Group |
| `parentGroupId` | TEXT | Nullable, FK → `Group.id` (SET NULL) | Self-reference untuk parent group |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT `now()` | Waktu pembuatan |
| `updatedAt` | TIMESTAMP | NOT NULL | Waktu update terakhir |

**Indexes:** `createdAt`, `lifecycleStatus`, `searchDocument` (GIN trigram)

---

### 2. `Musyrif` — Pimpinan Rombongan

| Kolom | Tipe | Constraints | Keterangan |
|-------|------|-------------|------------|
| `id` | TEXT | PK, DEFAULT `cuid()` | ID unik |
| `groupId` | TEXT | UNIQUE, FK → `Group.id` (CASCADE) | Satu musyrif per grup |
| `name` | TEXT | NOT NULL | Nama musyrif |
| `phone` | TEXT | NOT NULL | Nomor telepon |
| `avatar` | TEXT | NOT NULL | URL/path avatar |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT `now()` | Waktu pembuatan |
| `updatedAt` | TIMESTAMP | NOT NULL | Waktu update terakhir |

---

### 3. `NextActivity` — Aktivitas Terdekat

| Kolom | Tipe | Constraints | Keterangan |
|-------|------|-------------|------------|
| `id` | TEXT | PK, DEFAULT `cuid()` | ID unik |
| `groupId` | TEXT | UNIQUE, FK → `Group.id` (CASCADE) | Satu aktivitas per grup |
| `title` | TEXT | NOT NULL | Judul aktivitas |
| `dateLabel` | TEXT | NOT NULL | Label tanggal |
| `timeLabel` | TEXT | NOT NULL | Label waktu |
| `icon` | TEXT | NOT NULL | Ikon aktivitas |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT `now()` | Waktu pembuatan |
| `updatedAt` | TIMESTAMP | NOT NULL | Waktu update terakhir |

---

### 4. `GroupTimelineItem` — Timeline Event

| Kolom | Tipe | Constraints | Keterangan |
|-------|------|-------------|------------|
| `id` | TEXT | PK, DEFAULT `cuid()` | ID unik |
| `groupId` | TEXT | FK → `Group.id` (CASCADE) | Grup terkait |
| `sortOrder` | INTEGER | NOT NULL | Urutan tampilan |
| `dateLabel` | TEXT | NOT NULL | Label tanggal |
| `title` | TEXT | NOT NULL | Judul event |
| `isCurrent` | BOOLEAN | NOT NULL, DEFAULT `false` | Apakah event saat ini |
| `nextActivity` | TEXT | Nullable | Aktivitas selanjutnya |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT `now()` | Waktu pembuatan |
| `updatedAt` | TIMESTAMP | NOT NULL | Waktu update terakhir |

**Indexes:** `(groupId, sortOrder)` UNIQUE

---

### 5. `ItineraryItem` — Detail Itinerary

| Kolom | Tipe | Constraints | Keterangan |
|-------|------|-------------|------------|
| `id` | TEXT | PK, DEFAULT `cuid()` | ID unik |
| `groupId` | TEXT | FK → `Group.id` (CASCADE) | Grup terkait |
| `sortOrder` | INTEGER | NOT NULL | Urutan tampilan |
| `dateLabel` | TEXT | NOT NULL | Label tanggal |
| `yearLabel` | TEXT | NOT NULL | Label tahun |
| `category` | TEXT | NOT NULL | Kategori itinerary |
| `categoryKey` | TEXT | Nullable | Key kategori (misal `arrival`, `departure`) |
| `title` | TEXT | NOT NULL | Judul |
| `meta` | TEXT | NOT NULL | Metadata |
| `icon` | TEXT | NOT NULL | Ikon |
| `highlighted` | BOOLEAN | NOT NULL, DEFAULT `false` | Apakah di-highlight |
| `isoDate` | TIMESTAMP | Nullable | Tanggal ISO |
| `time` | TEXT | Nullable | Waktu |
| `flightNumber` | TEXT | Nullable | Nomor penerbangan |
| `hotelName` | TEXT | Nullable | Nama hotel |
| `fromHotelName` | TEXT | Nullable | Hotel asal |
| `fromLocation` | TEXT | Nullable | Lokasi asal |
| `toLocation` | TEXT | Nullable | Lokasi tujuan |
| `cityTourCity` | TEXT | Nullable | Kota untuk city tour |
| `requiresBus` | BOOLEAN | NOT NULL, DEFAULT `false` | Apakah butuh bus |
| `notes` | TEXT | Nullable | Catatan |
| `transferByTrain` | BOOLEAN | NOT NULL, DEFAULT `false` | Transfer dengan kereta |
| `trainDepartureTime` | TEXT | Nullable | Waktu keberangkatan kereta |
| `destinationPickupTime` | TEXT | Nullable | Waktu jemput di tujuan |
| `hotelPickupRequestTime` | TEXT | Nullable | Waktu request jemput hotel |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT `now()` | Waktu pembuatan |
| `updatedAt` | TIMESTAMP | NOT NULL | Waktu update terakhir |

**Indexes:** `(groupId, sortOrder)` UNIQUE

---

### 6. `GroupNote` — Catatan Grup

| Kolom | Tipe | Constraints | Keterangan |
|-------|------|-------------|------------|
| `id` | TEXT | PK, DEFAULT `cuid()` | ID unik |
| `groupId` | TEXT | FK → `Group.id` (CASCADE) | Grup terkait |
| `sortOrder` | INTEGER | NOT NULL | Urutan tampilan |
| `text` | TEXT | NOT NULL | Isi catatan |
| `pinned` | BOOLEAN | NOT NULL, DEFAULT `false` | Apakah di-pin |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT `now()` | Waktu pembuatan |
| `updatedAt` | TIMESTAMP | NOT NULL | Waktu update terakhir |

**Indexes:** `(groupId, sortOrder)`

---

### 7. `VisaSetup` — Konfigurasi Visa

| Kolom | Tipe | Constraints | Keterangan |
|-------|------|-------------|------------|
| `id` | TEXT | PK, DEFAULT `cuid()` | ID unik |
| `groupId` | TEXT | UNIQUE, FK → `Group.id` (CASCADE) | Satu visa setup per grup |
| `visaStatus` | Enum | NOT NULL, DEFAULT `DRAFT` | `DRAFT`, `PENDING`, `ISSUED` |
| `issuedDate` | TIMESTAMP | Nullable | Tanggal penerbitan visa |
| `syarikah` | TEXT | NOT NULL | Nama syarikah |
| `busStatus` | Enum | Nullable | `VISA_ONLY`, `VISA_PLUS` |
| `paymentStatus` | Enum | NOT NULL, DEFAULT `UNPAID` | `PAID`, `UNPAID`, `PARTIAL` |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT `now()` | Waktu pembuatan |
| `updatedAt` | TIMESTAMP | NOT NULL | Waktu update terakhir |

---

### 8. `VisaHotelAgreement` — Kesepakatan Hotel (Visa)

| Kolom | Tipe | Constraints | Keterangan |
|-------|------|-------------|------------|
| `id` | TEXT | PK, DEFAULT `cuid()` | ID unik |
| `visaSetupId` | TEXT | FK → `VisaSetup.id` (CASCADE) | Visa setup terkait |
| `sourceDraftId` | TEXT | Nullable, FK → `HotelAgreementDraft.id` (SET NULL) | Draft asal |
| `city` | Enum | NOT NULL | `MAKKAH`, `MADINAH` |
| `hotelName` | TEXT | NOT NULL | Nama hotel |
| `agreementNumber` | TEXT | NOT NULL | Nomor kesepakatan |
| `pax` | INTEGER | NOT NULL | Jumlah jamaah |
| `status` | Enum | NOT NULL, DEFAULT `WAITING` | `WAITING`, `APPROVED`, `REJECTED` |
| `stayStart` | TIMESTAMP | NOT NULL | Mulai menginap |
| `stayEnd` | TIMESTAMP | NOT NULL | Akhir menginap |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT `now()` | Waktu pembuatan |
| `updatedAt` | TIMESTAMP | NOT NULL | Waktu update terakhir |

**Indexes:** `(visaSetupId, city, stayStart)`, `sourceDraftId`

---

### 9. `HotelAgreementDraft` — Draft Kesepakatan Hotel

| Kolom | Tipe | Constraints | Keterangan |
|-------|------|-------------|------------|
| `id` | TEXT | PK, DEFAULT `cuid()` | ID unik |
| `city` | Enum | NOT NULL | `MAKKAH`, `MADINAH` |
| `agentId` | TEXT | NOT NULL, FK → `Agent.id` (RESTRICT) | Agent pemilik agreement |
| `hotelName` | TEXT | NOT NULL | Nama hotel |
| `agreementNumber` | TEXT | NOT NULL | Nomor kesepakatan |
| `pax` | INTEGER | NOT NULL | Jumlah jamaah |
| `status` | Enum | NOT NULL, DEFAULT `WAITING` | `WAITING`, `APPROVED`, `REJECTED` |
| `stayStart` | TIMESTAMP | NOT NULL | Mulai menginap |
| `stayEnd` | TIMESTAMP | NOT NULL | Akhir menginap |
| `notes` | TEXT | Nullable | Catatan |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT `now()` | Waktu pembuatan |
| `updatedAt` | TIMESTAMP | NOT NULL | Waktu update terakhir |

**Indexes:** `agreementNumber`, `(city, stayStart)`

---

### 10. `RaudhahAppointment` — Jadwal Kunjungan Raudhah

| Kolom | Tipe | Constraints | Keterangan |
|-------|------|-------------|------------|
| `id` | TEXT | PK, DEFAULT `cuid()` | ID unik |
| `visaSetupId` | TEXT | FK → `VisaSetup.id` (CASCADE) | Visa setup terkait |
| `date` | TIMESTAMP | NOT NULL | Tanggal kunjungan |
| `status` | Enum | NOT NULL, DEFAULT `FREE` | `FREE`, `AFTER`, `BEFORE` |
| `tasrehPrinted` | BOOLEAN | NOT NULL, DEFAULT `false` | Apakah tasreh sudah dicetak |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT `now()` | Waktu pembuatan |
| `updatedAt` | TIMESTAMP | NOT NULL | Waktu update terakhir |

**Indexes:** `(visaSetupId, date)`

---

### 11. `ChecklistAssignment` — Checklist Perjalanan

| Kolom | Tipe | Constraints | Keterangan |
|-------|------|-------------|------------|
| `id` | TEXT | PK, DEFAULT `cuid()` | ID unik |
| `groupId` | TEXT | FK → `Group.id` (CASCADE) | Grup terkait |
| `itineraryItemId` | TEXT | Nullable, FK → `ItineraryItem.id` (SET NULL) | Itinerary terkait |
| `tripDate` | TIMESTAMP | NOT NULL | Tanggal perjalanan |
| `activity` | TEXT | NOT NULL | Aktivitas |
| `tripLabel` | TEXT | NOT NULL | Label perjalanan |
| `requiredBusCount` | INTEGER | NOT NULL, DEFAULT `1` | Jumlah bus yang dibutuhkan |
| `scheduledTime` | TEXT | NOT NULL | Waktu terjadwal |
| `transferByTrain` | BOOLEAN | NOT NULL, DEFAULT `false` | Transfer dengan kereta |
| `trainDepartureTime` | TEXT | Nullable | Waktu keberangkatan kereta |
| `stationPickupTime` | TEXT | Nullable | Waktu jemput di stasiun |
| `status` | Enum | NOT NULL, DEFAULT `NOT_COMPLETE` | `NOT_COMPLETE`, `ASSIGNED` |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT `now()` | Waktu pembuatan |
| `updatedAt` | TIMESTAMP | NOT NULL | Waktu update terakhir |

**Indexes:** `(groupId, tripDate)`

---

### 12. `ChecklistDriver` — Sopir yang Ditugaskan

| Kolom | Tipe | Constraints | Keterangan |
|-------|------|-------------|------------|
| `id` | TEXT | PK, DEFAULT `cuid()` | ID unik |
| `checklistAssignmentId` | TEXT | FK → `ChecklistAssignment.id` (CASCADE) | Checklist terkait |
| `slotNumber` | INTEGER | NOT NULL | Nomor slot |
| `name` | TEXT | NOT NULL | Nama sopir |
| `phone` | TEXT | NOT NULL | Nomor telepon |
| `plateNumber` | TEXT | NOT NULL | Nomor plat kendaraan |
| `isVerified` | BOOLEAN | NOT NULL, DEFAULT `false` | Apakah sudah diverifikasi |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT `now()` | Waktu pembuatan |
| `updatedAt` | TIMESTAMP | NOT NULL | Waktu update terakhir |

**Indexes:** `(checklistAssignmentId, slotNumber)` UNIQUE, `checklistAssignmentId`

---

### 13. `InvoiceClient` — Klien Faktur

| Kolom | Tipe | Constraints | Keterangan |
|-------|------|-------------|------------|
| `id` | TEXT | PK, DEFAULT `cuid()` | ID unik |
| `name` | TEXT | NOT NULL | Nama klien |
| `sortOrder` | INTEGER | NOT NULL | Urutan tampilan |
| `groupId` | TEXT | Nullable, FK → `Group.id` (SET NULL) | Grup terkait |
| `agentId` | TEXT | NOT NULL, FK → `Agent.id` (RESTRICT) | Agent pemilik invoice |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT `now()` | Waktu pembuatan |
| `updatedAt` | TIMESTAMP | NOT NULL | Waktu update terakhir |

**Indexes:** `sortOrder`, `name`

---

### 14. `Invoice` — Faktur/Invoice

| Kolom | Tipe | Constraints | Keterangan |
|-------|------|-------------|------------|
| `id` | TEXT | PK, DEFAULT `cuid()` | ID unik |
| `invoiceNumber` | TEXT | UNIQUE, NOT NULL | Nomor invoice |
| `clientId` | TEXT | FK → `InvoiceClient.id` (RESTRICT) | Klien terkait |
| `groupId` | TEXT | Nullable, FK → `Group.id` (SET NULL) | Grup terkait |
| `issuedDate` | TIMESTAMP | NOT NULL | Tanggal penerbitan |
| `dueDate` | TIMESTAMP | NOT NULL | Jatuh tempo |
| `amount` | DECIMAL(12,2) | NOT NULL, DEFAULT `0` | Total jumlah |
| `downPaymentIdr` | DECIMAL(12,2) | NOT NULL, DEFAULT `0` | DP dalam IDR |
| `status` | Enum | NOT NULL, DEFAULT `PENDING` | `PAID`, `PARTIALLY_PAID`, `PENDING`, `OVERDUE`, `CANCELLED` |
| `notes` | TEXT | Nullable | Catatan |
| `items` | JSONB | Nullable | Line items (legacy field) |
| `recipientName` | TEXT | Nullable | Nama penerima |
| `version` | INTEGER | NOT NULL, DEFAULT `0` | Versi invoice (optimistic locking) |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT `now()` | Waktu pembuatan |
| `updatedAt` | TIMESTAMP | NOT NULL | Waktu update terakhir |

**Indexes:** `dueDate`, `(clientId, dueDate)`, `groupId`

---

### 15. `InvoiceItem` — Line Items Invoice

| Kolom | Tipe | Constraints | Keterangan |
|-------|------|-------------|------------|
| `id` | TEXT | PK, DEFAULT `cuid()` | ID unik |
| `invoiceId` | TEXT | FK → `Invoice.id` (CASCADE) | Invoice terkait |
| `description` | TEXT | NOT NULL | Deskripsi item |
| `pax` | INTEGER | NOT NULL | Jumlah jamaah |
| `currency` | TEXT | NOT NULL | Mata uang |
| `unitPrice` | DECIMAL(12,2) | NOT NULL | Harga satuan |
| `totalPrice` | DECIMAL(12,2) | NOT NULL | Total harga |
| `totalPriceIdr` | DECIMAL(12,2) | NOT NULL | Total harga dalam IDR |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT `now()` | Waktu pembuatan |
| `updatedAt` | TIMESTAMP | NOT NULL | Waktu update terakhir |

**Indexes:** `invoiceId`

---

### 16. `AuthUser` — User Autentikasi

| Kolom | Tipe | Constraints | Keterangan |
|-------|------|-------------|------------|
| `id` | TEXT | PK, DEFAULT `cuid()` | ID unik |
| `name` | TEXT | NOT NULL | Nama user |
| `username` | TEXT | UNIQUE, NOT NULL | Username |
| `email` | TEXT | UNIQUE, NOT NULL | Email |
| `role` | Enum | NOT NULL, DEFAULT `ADMIN` | `SUPER_ADMIN`, `ADMIN`, `FINANCE_MANAGER`, `CUSTOMER_SUPPORT` |
| `passwordHash` | TEXT | Nullable | Hash password |
| `isActive` | BOOLEAN | NOT NULL, DEFAULT `true` | Apakah user aktif |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT `now()` | Waktu pembuatan |
| `updatedAt` | TIMESTAMP | NOT NULL | Waktu update terakhir |

**Indexes:** `role`, `isActive`

---

### 17. `AuthLoginRateLimitBucket` — Rate Limiting Login

| Kolom | Tipe | Constraints | Keterangan |
|-------|------|-------------|------------|
| `key` | TEXT | PK | Key (biasanya IP/username) |
| `failedAttemptEpochMs` | TEXT[] | DEFAULT `[]` | Daftar waktu percobaan gagal (epoch ms) |
| `lockedUntil` | TIMESTAMP | Nullable | Waktu unlock jika terkunci |
| `lastSeenAt` | TIMESTAMP | NOT NULL, DEFAULT `now()` | Waktu terlihat terakhir |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT `now()` | Waktu pembuatan |
| `updatedAt` | TIMESTAMP | NOT NULL | Waktu update terakhir |

**Indexes:** `lastSeenAt`, `lockedUntil`

---

### 18. `AppThrottleBucket` — Throttling API

| Kolom | Tipe | Constraints | Keterangan |
|-------|------|-------------|------------|
| `key` | TEXT | PK | Key (biasanya IP/endpoint) |
| `hitEpochMs` | TEXT[] | DEFAULT `[]` | Daftar waktu hit (epoch ms) |
| `blockedUntil` | TIMESTAMP | Nullable | Waktu unblock jika terblokir |
| `lastSeenAt` | TIMESTAMP | NOT NULL, DEFAULT `now()` | Waktu terlihat terakhir |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT `now()` | Waktu pembuatan |
| `updatedAt` | TIMESTAMP | NOT NULL | Waktu update terakhir |

**Indexes:** `lastSeenAt`, `blockedUntil`

---

### 19. `GroupAuditLog` — Log Audit Grup

| Kolom | Tipe | Constraints | Keterangan |
|-------|------|-------------|------------|
| `id` | TEXT | PK, DEFAULT `cuid()` | ID unik |
| `groupId` | TEXT | Nullable, FK → `Group.id` (SET NULL) | Grup terkait |
| `groupCode` | TEXT | Nullable | Kode grup (backup jika grup dihapus) |
| `action` | TEXT | NOT NULL | Aksi yang dilakukan |
| `entity` | TEXT | NOT NULL | Entitas yang diubah |
| `payload` | JSONB | NOT NULL | Data perubahan (before/after) |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT `now()` | Waktu aksi |

**Indexes:** `(groupId, createdAt)`, `(groupCode, createdAt)`, `createdAt`

---

### 20. `MasterDataOption` — Master Data Lookup

| Kolom | Tipe | Constraints | Keterangan |
|-------|------|-------------|------------|
| `id` | TEXT | PK, DEFAULT `cuid()` | ID unik |
| `categoryKey` | TEXT | NOT NULL | Kategori (misal `airline`, `hotel_chain`) |
| `value` | TEXT | NOT NULL | Nilai opsi |
| `label` | TEXT | NOT NULL | Label tampilan |
| `description` | TEXT | Nullable | Deskripsi |
| `metadata` | JSONB | Nullable | Metadata tambahan |
| `sortOrder` | INTEGER | NOT NULL | Urutan tampilan |
| `isActive` | BOOLEAN | NOT NULL, DEFAULT `true` | Apakah aktif |
| `createdAt` | TIMESTAMP | NOT NULL, DEFAULT `now()` | Waktu pembuatan |
| `updatedAt` | TIMESTAMP | NOT NULL | Waktu update terakhir |

**Indexes:** `(categoryKey, value)` UNIQUE, `(categoryKey, sortOrder)`, `(categoryKey, isActive)`

---

## 🔗 Relasi Antar Tabel

### Group sebagai Entitas Pusat

```
Group
├── Musyrif (1:1)              — pimpinan rombongan
├── NextActivity (1:1)         — aktivitas terdekat
├── GroupTimelineItem (1:N)    — timeline events
├── ItineraryItem (1:N)        — detail itinerary per hari
├── GroupNote (1:N)            — catatan grup
├── VisaSetup (1:1)            — konfigurasi visa
│   ├── VisaHotelAgreement (1:N) — kesepakatan hotel
│   └── RaudhahAppointment (1:N) — jadwal Raudhah
├── ChecklistAssignment (1:N)  — checklist perjalanan
│   └── ChecklistDriver (1:N)    — sopir ditugaskan
├── InvoiceClient (1:N)        — klien faktur
│   └── Invoice (1:N)          — faktur
│       └── InvoiceItem (1:N)    — line items
├── GroupAuditLog (1:N)        — log audit
└── Group (self-ref)           — parent group
```

### Relasi Lintas Tabel

```
HotelAgreementDraft → VisaHotelAgreement    (via sourceDraftId)
ChecklistAssignment → ItineraryItem         (via itineraryItemId)
InvoiceClient       → Invoice               (via clientId)
Invoice             → Group                 (via groupId, nullable)
```

### Cascade Rules

| Aksi | CASCADE | SET NULL | RESTRICT |
|------|---------|----------|----------|
| Hapus Group | Musyrif, NextActivity, Timeline, Itinerary, Note, VisaSetup, ChecklistAssignment | InvoiceClient, Invoice, AuditLog | — |
| Hapus VisaSetup | HotelAgreement, RaudhahAppt | — | — |
| Hapus Invoice | InvoiceItem | — | — |
| Hapus ChecklistAssignment | ChecklistDriver | — | — |
| Hapus ItineraryItem | — | ChecklistAssignment | — |
| Hapus HotelAgreementDraft | — | VisaHotelAgreement | — |
| Hapus InvoiceClient | — | — | Invoice (dilarang) |

---

## 📐 Diagram ERD

```
┌─────────────────────────────────────────────────────────────────────┐
│                           GROUP (Inti)                              │
│  id, code, name, status, lifecycleStatus, pax, dates, package...   │
└──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬───────────┘
       │      │      │      │      │      │      │
       │ 1:1  │ 1:1  │ 1:N  │ 1:N  │ 1:N  │ 1:1  │ 1:N  │ 1:N
       │      │      │      │      │      │      │      │
  ┌────▼──┐┌──▼───┐┌─▼────┐┌▼─────┐┌▼────┐┌▼────┐┌▼─────┐┌▼─────────┐
  │Musyrif││Next  ││Time- ││Itine-││Note ││Visa ││Check││Invoice   │
  │       ││Activ.││line  ││rary  ││     ││Setup││list ││Client    │
  └───────┘└──────┘└──────┘└──────┘└─────┘└──┬──┘└──┬──┘└──────────┘
                                              │      │
                                    ┌─────────┼──────┼──────────┐
                                    │ 1:N     │ 1:N  │ 1:N      │ 1:N
                                    │         │      │          │
                               ┌────▼───┐ ┌───▼─────┐ ┌────▼───┐ ┌▼────┐
                               │Hotel   │ │Raudhah  │ │Driver  │ │Invo-│
                               │Agree-  │ │Appt.    │ │        │ │ice  │
                               │ment    │ └─────────┘ └────────┘ └──┬──┘
                               └────┬───┘                           │
                                    │                          1:N  │
                               ┌────▼───┐                    ┌─────▼──┐
                               │Hotel   │                    │Invoice │
                               │Draft   │                    │Item    │
                               └────────┘                    └────────┘

┌─────────────────────────────────────────────────┐
│          TABEL INDEPENDEN (Sistem)              │
│                                                 │
│  AuthUser          — user autentikasi           │
│  AuthLoginRateLimit — rate limit login          │
│  AppThrottleBucket  — throttle API             │
│  MasterDataOption   — master data lookup        │
│  GroupAuditLog      — audit trail               │
└─────────────────────────────────────────────────┘
```

---

## 🎯 Kesimpulan

Sistem ini adalah **aplikasi manajemen rombongan haji/umrah** dengan arsitektur database yang berpusat pada tabel `Group`. Fitur-fitur utama:

1. **Manajemen Grup** — CRUD rombongan dengan lifecycle (ENTRY_ONLY → ACTIVE → COMPLETED → ARCHIVED)
2. **Itinerary & Timeline** — Penjadwalan detail perjalanan (penerbangan, hotel, city tour, transfer)
3. **Visa & Hotel** — Pengurusan visa, kesepakatan hotel Makkah/Madinah, dan jadwal Raudhah
4. **Checklist & Transport** — Penugasan sopir dan bus untuk setiap perjalanan
5. **Invoice & Billing** — Penagihan multi-currency dengan line items dan tracking pembayaran
6. **Auth & Security** — Autentikasi berbasis role dengan rate limiting
7. **Audit Trail** — Log semua perubahan pada grup untuk transparansi

---

*Dokumentasi ini dihasilkan dari analisis skema Prisma pada 2026-07-04.*
