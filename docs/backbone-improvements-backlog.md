# Backbone Improvements Backlog

Items di sini **TIDAK kritikal** — tidak ada data loss risk. Bisa dikerjakan kapan saja, secara independen, sesuai prioritas tim.

---

## Database Improvements

### DB-1: Tambah Index `Group.tone + createdAt`
- **Kenapa:** Query `GET /groups?activeOnly=true` filter by `tone = ACTIVE` tanpa index
- **File:** `schema.prisma` → tambah `@@index([tone, createdAt])`
- **Risk:** Rendah

### DB-2: Tambah Index `Group.parentGroupId`
- **Kenapa:** Child group lookup tanpa index
- **File:** `schema.prisma` → tambah `@@index([parentGroupId])`
- **Risk:** Rendah

### DB-3: Migrasi `Group.status` ke Enum
- **Kenapa:** Saat ini string bebas (`"Active"`, `"In Active"`, dll). Seharusnya enum: `ACTIVE`, `INACTIVE`, `COMPLETE`, `INCOMPLETE`
- **Catatan:** Perlu data migration. Lakukan 2-phase deploy (tambah kolom baru dulu, baru switch)
- **Risk:** Sedang (data migration)

### DB-4: Pindahkan `busStatus` ke Field Proper di VisaSetup
- **Kenapa:** Saat ini disimpan sebagai string di dalam array `notes[]` — anti-pattern
- **Enum:** `VISA_ONLY` | `VISA_PLUS`
- **Risk:** Sedang (koordinasi frontend-backend)

---

## Backend Improvements

### BE-1: Konkretkan Return Type dari `Promise<unknown>`
- **Kenapa:** Semua method di `GroupsService`, `GroupsCommandService`, `GroupsQueryService`, `HotelAgreementDraftsService` return `Promise<unknown>`
- **Fix:** Buat centralized Prisma inferred types dan ganti semua return type
- **Risk:** Rendah

### BE-2: Eliminasi Extra DB Round-Trip Setelah Mutation
- **Kenapa:** Setiap mutation (add/update/remove itinerary, agreement, dll) memanggil `this.findOneWithPrisma(group.id)` setelah write — ini extra query yang tidak perlu
- **Fix:** Gunakan `select`/`include` langsung di query mutasi, atau return group via `findUniqueOrThrow` sekali saja
- **Risk:** Rendah

### BE-3: Gabungkan `ensureNotChildGroup` + `resolvePrismaGroupIdentity`
- **Kenapa:** 2 query terpisah yang bisa digabung jadi 1
- **Fix:** Buat `resolveGroupAndAssertNotChild()` yang return `{ id, code }` dalam 1 query
- **Risk:** Rendah

### BE-4: Isolasi Memory Data Source ke Non-Production
- **Kenapa:** Memory store bisa aktif di production — ini berbahaya karena data hilang saat restart
- **Fix:** Force `prisma` di `NODE_ENV=production`, ignore config
- **Risk:** Rendah (tapi perlu pastikan DB production sudah ready)

### BE-5: Buat Semua Validasi Agreement Menjadi Soft Rule
- **Kenapa:** Kasus agreement di lapangan sangat beragam. Logic validasi yang terlalu ketat bisa menolak data valid. Validasi seharusnya hanya warning di frontend, bukan blocking di backend.
- **File:** `groups.hotel-validation.ts` — sudah sebagian soft (komentar "Do not throw"), tapi masih ada blok yang throw `BadRequestException`
- **Fix:** Ganti semua throw menjadi warning/log, atau return validation result yang bisa ditampilkan frontend
- **Risk:** Rendah

---

## Frontend Improvements

### FE-1: Validasi API Response dengan Zod
- **Kenapa:** Tidak ada validasi response dari backend. `BackendGroupRecord` semua field-nya optional, menggunakan `readString`/`readNumber` fallback yang menyembunyikan bug
- **Fix:** Buat Zod schema untuk response backend, validate di fetch layer
- **Risk:** Sedang

### FE-2: Tambah `queryKey` untuk Single Group Detail
- **Kenapa:** Saat ini semua fetch group pakai key yang sama, tidak bisa invalidate per group
- **Fix:** Tambah `detail: (idOrCode) => ["groups", "detail", idOrCode]`
- **Risk:** Rendah

### FE-3: Pecah `app-domain.ts` (2784 baris) — Bertahap
- **Kenapa:** God file yang berisi types, logic, mock data, dan navigation constants
- **Strategi:** Pecah per domain (group types, visa types, checklist types, dll), sisakan `app-domain.ts` sebagai barrel re-export agar import existing tidak break
- **Urutan:** types dulu → domain logic → fixtures → constants
- **Risk:** Sedang-Tinggi (banyak import yang perlu diupdate jika tidak pakai barrel)

### FE-4: Accordion UI Parent-Child di Visa Tracking
- **Kenapa:** Saat ini child group langsung tampil di bawah parent. Lebih bersih jika bisa collapse/expand
- **Fix:** Tambah state `expandedGroupIds`, render followerRows hanya jika expanded
- **Risk:** Rendah (UI only)

### FE-5: Fix `outstandingAmount` Hardcoded
- **Kenapa:** `pax × 280` untuk Unpaid, `pax × 120` untuk Partial — hardcoded di `buildVisaTrackingRowsFromGroups`
- **Status:** User konfirmasi field ini tidak diperlukan di UI saat ini
- **Fix:** Hapus kalkulasi hardcoded, tampilkan "-" atau hilangkan kolom
- **Risk:** Rendah

### FE-6: Naikkan `staleTime` Groups Query
- **Kenapa:** Saat ini 30 detik, terlalu agresif untuk data group yang jarang berubah
- **Fix:** Naikkan ke 2 menit
- **Risk:** Rendah

### FE-7: Perbaiki `as any` Cast di Query Service
- **File:** `groups-query.service.ts` line ~186
- **Fix:** Ganti `as any` dengan proper type assertion
- **Risk:** Rendah
