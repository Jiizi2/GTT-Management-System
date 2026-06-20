# Backbone Audit Report — GTT Management System

> Audit dilakukan pada branch `audit/backbone-review` pada 2026-06-18.
> Cakupan: Database Schema (Prisma) → Backend (NestJS) → Frontend (React).

---

## Ringkasan Temuan

| Lapisan | Temuan Kritis | Perlu Diperbaiki | Baik |
|---|---|---|---|
| Database | 3 | 4 | 3 |
| Backend | 4 | 3 | 4 |
| Frontend | 3 | 4 | 3 |

---

## 1. DATABASE — Schema Prisma

### ✅ Yang sudah baik
- Relasi antar tabel jelas menggunakan `@relation` dengan cascade yang tepat (`Cascade`, `SetNull`, `Restrict`).
- Index sudah ada di kolom yang sering diquery (e.g., `[groupId, createdAt]`, `[groupId, sortOrder]`).
- Penggunaan PostgreSQL advisory lock (`pg_advisory_xact_lock`) di checklist transaction menunjukkan awareness terhadap concurrency. Bagus.

---

### 🔴 KRITIS 1 — `Group.status` adalah `String` tanpa Enum

**File:** [schema.prisma](file:///c:/vibe%20coding/apps/backend/prisma/schema.prisma#L124)

```prisma
// SEKARANG — berbahaya
status  String

// SEHARUSNYA — aman
enum GroupStatus {
  ENTRY_ONLY
  ACTIVE
  INACTIVE
  COMPLETED
}
status GroupStatus
```

**Dampak:** Tidak ada constraint di database level. Value bisa bebas: `"Active"`, `"active"`, `"ACTIVE"`, `"In Active"` — semuanya masuk tanpa error. Ini sudah terbukti bermasalah: di `app-domain.ts` frontend ada `"In Active"` (dengan spasi), dan di `groups.service.ts` ada hardcoded `"Entry Only"`.

Jika di database ada 5 variasi case yang berbeda untuk hal yang sama, query `filter=active` akan miss beberapa record.

---

### 🔴 KRITIS 2 — `InvoiceClient.sortOrder` dengan `@unique` — Desain Salah

**File:** [schema.prisma](file:///c:/vibe%20coding/apps/backend/prisma/schema.prisma#L177)

```prisma
model InvoiceClient {
  sortOrder   Int
  @@unique([sortOrder])  // ← SALAH
}
```

**Dampak:** `sortOrder` yang `@unique` berarti hanya satu client yang bisa punya sortOrder = 1, satu yang punya sortOrder = 2, dst — **secara global di seluruh tabel**. Ini seharusnya `@@unique([groupId, sortOrder])` agar urutan unik per-group. Ini adalah bug desain yang akan menyebabkan `P2002 Unique constraint failed` saat ada dua group punya InvoiceClient dengan sortOrder yang sama.

---

### 🔴 KRITIS 3 — Child Group menyimpan data visa yang di-*copy*, bukan di-*referensi*

**File:** [groups-command.service.ts](file:///c:/vibe%20coding/apps/backend/src/groups/application/groups-command.service.ts#L1373-L1439) — `syncParentSharedDataToChildrenWithPrisma`

```typescript
// Setiap kali parent diupdate, child group DIDELETE dan DICREATE ulang
await tx.visaSetup.deleteMany({ where: { groupId: child.id } });
await tx.visaSetup.create({ data: { ...parentData } });
```

**Dampak:** Data visa di-*clone* (duplikat fisik), bukan direferensikan ke parent. Ini berarti:
1. **Data tidak konsisten**: Jika ada bug di sync, child punya data visa berbeda dari parent — tanpa ada cara untuk mendeteksinya.
2. **Skalabilitas buruk**: N child groups = N database operation per update.
3. **ID hotel agreement berbeda**: ID hotel di child bukan ID yang sama dengan parent, sehingga relasi `sourceDraftId` tidak bisa dilacak secara konsisten.

**Solusi yang benar:** Tambahkan `parentGroupId` FK di `VisaSetup`, lalu query selalu ambil dari parent jika ada. Atau minimal tambahkan `isClonedFromParent` flag.

---

### ⚠️ Perlu Diperbaiki 1 — `Group.searchDocument` diisi manual, bukan computed

**File:** [schema.prisma](file:///c:/vibe%20coding/apps/backend/prisma/schema.prisma#L125)

Kolom `searchDocument` harus selalu disync manual setiap kali `code`, `name`, `status`, atau `packageName` berubah. Jika ada path code yang lupa memanggil `buildGroupSearchDocument()`, data searchnya akan stale. Ini sudah terjadi: `update()` memanggil `buildGroupSearchDocument` tapi `replace()` mendelegasikan ke `buildGroupReplaceData()` di file terpisah.

**Solusi:** Gunakan PostgreSQL computed/generated column, atau pindahkan ke trigger, atau minimal buat unit test yang memastikan semua write path memperbarui `searchDocument`.

---

### ⚠️ Perlu Diperbaiki 2 — Tidak ada index di `Group.tone`

Setiap query dengan `activeOnly=true` filter by `tone = ACTIVE`. Tapi tidak ada `@@index([tone])` di schema. Dengan banyak group, ini akan full table scan setiap `GET /groups?activeOnly=true`.

---

### ⚠️ Perlu Diperbaiki 3 — `outstandingAmount` di `VisaSetup` hardcoded `0` saat create

**File:** [groups-command.service.ts](file:///c:/vibe%20coding/apps/backend/src/groups/application/groups-command.service.ts#L560-L561)

```typescript
outstandingAmount: new Prisma.Decimal(0),
```

Dan di frontend:

```typescript
outstandingAmount: 0,  // use-app-controller-backend.ts L444
```

`outstandingAmount` selalu di-set `0` ketika VisaSetup di-create, tapi tidak ada endpoint untuk memperbarui nilai ini. Data di `VisaTrackingRow` frontend punya field `outstandingAmount: number` tapi tidak pernah diisi dari API dengan nilai yang benar. Ini data yang tampil di UI tapi isinya salah.

---

## 2. BACKEND — NestJS

### ✅ Yang sudah baik
- Pemisahan `GroupsCommandService` dan `GroupsQueryService` — CQRS-lite yang benar.
- Penggunaan `pg_advisory_xact_lock` untuk prevent race condition di checklist.
- `groupDetailSelection` dan `groupSummarySelection` di-define terpisah — mencegah over-fetching.
- Audit log tersentralisasi dan konsisten.

---

### 🔴 KRITIS 4 — Dual Data Source (`memory` | `prisma`) ada di production code

**File:** [groups.service.ts](file:///c:/vibe%20coding/apps/backend/src/groups/application/groups.service.ts#L36-L48)

```typescript
private readonly dataSource: "memory" | "prisma";
private readonly memoryGroups: MemoryGroupRecord[] = createDefaultMemoryGroups();
```

**Dampak:** Seluruh aplikasi memiliki dua path eksekusi yang BERBEDA untuk setiap operasi. Memory store **tidak setara** dengan Prisma store:

- Memory: tidak ada pagination index, sort hanya di JS
- Prisma: menggunakan DB index yang proper

Jika ada bug di memory path, itu bisa dianggap "fitur" karena behavior-nya berbeda. Unit test yang berjalan di memory tidak bisa menjamin Prisma path berjalan benar. **Ini adalah technical debt terbesar di backend.**

**Rekomendasi:** Setelah fully beralih ke Prisma, hapus seluruh memory path. Atau minimal buat flag yang hanya aktif di `NODE_ENV=development|test`.

---

### 🔴 KRITIS 5 — Return type semua service method adalah `Promise<unknown>`

**File:** [groups.service.ts](file:///c:/vibe%20coding/apps/backend/src/groups/application/groups.service.ts#L62-L65)

```typescript
async findAll(...): Promise<unknown[] | PaginatedGroupList<unknown>> { ... }
async findOneByIdOrCode(...): Promise<unknown> { ... }
async create(...): Promise<unknown> { ... }
```

**Dampak:** Tidak ada type safety di layer controller. Swagger response type-nya pun hanya berupa `GroupDetailResponseDto` yang dideclare manual tapi tidak di-enforce oleh TypeScript. Jika schema Prisma berubah, TypeScript tidak akan warning di controller.

**Rekomendasi:** Buat return type yang konkret dari Prisma's inferred types menggunakan `Prisma.GroupGetPayload<{ select: typeof groupDetailSelection }>`.

---

### 🔴 KRITIS 6 — `findOneWithPrisma` di CommandService menggunakan `idOrCode` untuk lookup setelah mutation

**File:** [groups-command.service.ts](file:///c:/vibe%20coding/apps/backend/src/groups/application/groups-command.service.ts#L1031-L1044)

```typescript
private async findOneWithPrisma(idOrCode: string) {
  const group = await this.prisma.group.findFirst({
    where: {
      OR: [{ id: idOrCode }, { code: idOrCode.trim().toUpperCase() }],
    },
    ...
  });
}
```

Setelah `addItineraryItemWithPrisma()`, dipanggil `return this.findOneWithPrisma(group.id)` — ini adalah query tambahan (N+1 query tambahan). Setiap mutation melakukan **2 DB round trips**: satu untuk mutasi, satu untuk fetch hasil. Ini unnecessary. Seharusnya gunakan Prisma's `include`/`select` di query mutasi itu sendiri.

---

### ⚠️ Perlu Diperbaiki 4 — Tidak ada `@UseGuards(AuthGuard)` di Controller

**File:** [groups.controller.ts](file:///c:/vibe%20coding/apps/backend/src/groups/http/groups.controller.ts#L66-L80)

Controller hanya punya `@ApiBearerAuth("access-token")` dan `@ApiCookieAuth("auth-cookie")` untuk **dokumentasi Swagger** saja. Guard actual (`@UseGuards`) tidak tampak di file ini. Perlu dicek apakah guard dipasang secara global di `app.module.ts`. Jika hanya global, ada risiko jika suatu endpoint butuh pengecualian — tidak ada mekanisme eksplisit.

---

### ⚠️ Perlu Diperbaiki 5 — `ensureNotChildGroup` melakukan DB query terpisah

**File:** [groups-command.service.ts](file:///c:/vibe%20coding/apps/backend/src/groups/application/groups-command.service.ts#L1342-L1372)

Setiap operasi mutation (addItineraryItem, addVisaHotel, dll) memanggil `ensureNotChildGroup()` yang melakukan `findFirst` ke DB. Kemudian `resolvePrismaGroupIdentity()` juga melakukan `findFirst` lagi. Ini **2 query untuk tujuan yang sama**: mendapatkan data group. Bisa digabung menjadi 1 query.

---

## 3. FRONTEND — React

### ✅ Yang sudah baik
- Penggunaan React Query (`useQuery`/`useMutation`) konsisten — tidak ada `useEffect` untuk fetching.
- `query-keys.ts` tersentralisasi dengan baik.
- Pemisahan `BackendGroupRecord` (raw API) dan `GroupData` (domain) sudah benar.

---

### 🔴 KRITIS 7 — Type mapping enum antara backend dan frontend adalah string literal manual

**File:** [use-app-controller-backend.ts](file:///c:/vibe%20coding/apps/backend/src/groups/application/groups-command.service.ts) — banyak fungsi seperti:

```typescript
function mapVisaStatusToBackend(status: VisaStatus): "DRAFT" | "PENDING" | "ISSUED"
function mapBackendVisaStatus(value: string | undefined): GroupVisaSetup["visaStatus"]
```

**Dampak:** Ada **12+ fungsi mapping** yang harus dijaga manual agar konsisten dengan backend enum. Jika backend enum berubah (misal `ISSUED` → `VISA_ISSUED`), frontend tidak akan error di compile time — hanya runtime. Ini adalah titik failure yang paling sering luput saat development.

**Solusi:** Generate shared types dari Prisma schema atau OpenAPI spec. Atau minimal buat single source of truth constants yang di-import oleh kedua sisi.

---

### 🔴 KRITIS 8 — `BackendGroupRecord` semua field adalah `optional`

**File:** [use-app-controller-backend.ts](file:///c:/vibe%20coding/apps/backend/src/groups/application/groups-command.service.ts#L146-L250)

```typescript
type BackendGroupRecord = {
  id?: string;
  code?: string;
  name?: string;
  status?: string;
  // ... semua optional
};
```

**Dampak:** TypeScript tidak bisa detect jika API response berubah. Setiap field harus punya defensive fallback:

```typescript
readString(record.code, "UNKNOWN")
readNumber(record.pax, 0)
```

Ini menyembunyikan API contract yang sebenarnya. Jika backend mengirim `null` untuk field yang seharusnya required, UI akan silently render dengan nilai kosong/default — bukan error.

**Solusi:** Gunakan `zod` (yang sudah diinstall di frontend) untuk parse dan validate API response. Jika response tidak sesuai schema, throw error yang jelas.

---

### 🔴 KRITIS 9 — `app-domain.ts` berisi 2784 baris — satu file untuk semua

**File:** [app-domain.ts](file:///c:/vibe%20coding/apps/frontend/src/shared/app-domain.ts) — 2784 baris

File ini berisi: types, utility functions, hardcoded mock data (`baseGroups`), business logic functions, dan constants. Ini adalah God File.

**Dampak:** Setiap developer yang menambah feature pasti akan menambah ke file ini karena "sudah ada disini". Ini membuat file semakin besar dan coupling semakin tinggi.

**Rekomendasi:** Pecah menjadi:
- `src/shared/types/group.types.ts`
- `src/shared/types/visa.types.ts`
- `src/shared/types/checklist.types.ts`
- `src/shared/domain/group-completeness.ts`
- `src/shared/domain/visa-rules.ts`
- `src/shared/fixtures/mock-groups.ts` (mock data)

---

### ⚠️ Perlu Diperbaiki 6 — `useGroupsQuery` tidak punya `queryKey` untuk group by ID

**File:** [query-keys.ts](file:///c:/vibe%20coding/apps/frontend/src/shared/query-keys.ts)

```typescript
export const groupQueryKeys = {
  all: ["groups"] as const,
  list: (...) => [...],
  search: (...) => [...],
  // ← Tidak ada: detail(id: string) => [...]
};
```

Tidak ada query key untuk single group detail. Artinya setelah mutation (misalnya `addItineraryItem`), tidak ada cara untuk invalidate cache group spesifik — harus invalidate seluruh list. Ini menyebabkan **unnecessary refetch seluruh grup list** setiap ada perubahan pada satu grup.

---

### ⚠️ Perlu Diperbaiki 7 — `busStatus` disimpan sebagai text di dalam `notes`, bukan sebagai field sendiri

**File:** [use-app-controller-backend.ts](file:///c:/vibe%20coding/apps/backend/src/groups/application/groups-command.service.ts#L760-L776)

```typescript
function resolveBusStatusFromNotes(notes: string[]): GroupVisaSetup["busStatus"] {
  const marker = notes.find((note) => /^bus status\s*:/i.test(note));
  // Backward compatibility: legacy notes used "Bus Internal/Bus Luar".
  if (/bus\s*(internal|luar)/i.test(marker)) { return "Visa+"; }
}
```

`busStatus` disimpan sebagai text di dalam array `notes` (format: `"Bus status: Visa+"`). Ini adalah anti-pattern karena:
1. Data bisnis penting tersembunyi di dalam field teks bebas.
2. Parsing bergantung pada regex yang bisa salah jika ada typo.
3. Comment "Backward compatibility" menunjukkan ini sudah pernah berubah format sekali.

**Rekomendasi:** Tambahkan field `busStatus` yang proper di tabel `VisaSetup` (atau `Group`).

---

### ⚠️ Perlu Diperbaiki 8 — `staleTime: 30_000` di groups query terlalu singkat untuk data yang jarang berubah

**File:** [use-groups-query.ts](file:///c:/vibe%20coding/apps/frontend/src/hooks/use-groups-query.ts#L10-L11)

30 detik stale time berarti setiap 30 detik React Query akan refetch semua groups jika window di-focus. Dengan response yang mungkin besar (seluruh list groups dengan itinerary), ini adalah unnecessary network load.

---

## 4. Prioritas Perbaikan

| Prioritas | Issue | Effort | Impact |
|---|---|---|---|
| 🔴 P0 | `InvoiceClient.sortOrder @unique` — bug aktif | Rendah | Tinggi |
| 🔴 P0 | `Group.status` bukan enum | Sedang | Tinggi |
| 🔴 P1 | Return type `Promise<unknown>` di services | Sedang | Tinggi |
| 🔴 P1 | Child group clone visa data, bukan referensi | Tinggi | Tinggi |
| 🔴 P1 | `BackendGroupRecord` semua optional, tanpa zod | Sedang | Sedang |
| ⚠️ P2 | `app-domain.ts` 2784 baris, God File | Tinggi | Sedang |
| ⚠️ P2 | `busStatus` tersembunyi di notes text | Sedang | Sedang |
| ⚠️ P2 | N+1 query di setiap mutation (findOne setelah write) | Sedang | Sedang |
| ⚠️ P2 | Tidak ada index di `Group.tone` | Rendah | Sedang |
| ⚠️ P3 | Hapus memory data source dari production path | Tinggi | Rendah |
| ⚠️ P3 | `queryKey` untuk single group detail | Rendah | Rendah |
| ⚠️ P3 | `outstandingAmount` selalu 0 | Sedang | Rendah |

---

## 5. Rekomendasi Sebelum Development Selanjutnya

1. **Wajib sebelum feature baru apapun:**
   - Fix `InvoiceClient.sortOrder` unique constraint (5 menit, buat migration).
   - Tambahkan `@@index([tone])` di `Group` (2 menit, buat migration).

2. **Wajib dalam sprint berikutnya:**
   - Ubah `Group.status` ke enum — ini akan membutuhkan data migration.
   - Validasi API response menggunakan `zod` di frontend.

3. **Technical debt yang harus dijadwalkan:**
   - Pecah `app-domain.ts` ke file-file yang lebih kecil.
   - Hapus memory data source dari production path, buat hanya untuk `NODE_ENV=test`.
   - Refaktor child group untuk referensi data visa dari parent, bukan clone.
