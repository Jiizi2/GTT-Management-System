# 🔬 Legacy Code & Incomplete Migration Audit

> Audit mendalam terhadap kode legacy, migrasi belum tuntas, dead code, dan technical debt di GTT Management System.
> Tanggal Audit: 6 Juli 2026

---

## Executive Summary

Ditemukan **7 area utama** dengan legacy code atau migrasi belum selesai:

| # | Area | Severity | Status |
|---|---|:---:|---|
| 1 | Frontend monolith `group-detail-modals.tsx` | 🔴 Critical | Refactor selesai tapi monolith belum dihapus |
| 2 | Backend Groups: dual architecture pattern | 🔴 Critical | Repository Pattern + legacy orchestrator co-exist |
| 3 | `InvoicesService` unsafe `as any` accessor | 🟡 Medium | Workaround untuk encapsulation leak |
| 4 | Frontend re-export stub pages | 🟢 Low | Dead indirection files |
| 5 | Legacy auth storage purge code | 🟢 Low | Intentional backward compat, bisa dihapus nanti |
| 6 | Duplicate test files untuk modals | 🟡 Medium | Old + new tests co-exist |
| 7 | Frontend helper files alongside decomposed folders | 🟡 Medium | Partial decomposition pattern |

---

## 1. 🔴 Frontend Monolith: `group-detail-modals.tsx` (DEAD CODE)

### Temuan

File `group-detail-modals.tsx` (1,897 baris, 77 KB) masih ada di `apps/frontend/src/components/`, padahal refactoring ke folder `group-detail-modals/` sudah **100% selesai**.

**Bukti refactor sudah tuntas:**

Folder `group-detail-modals/` berisi 8 modal yang terdekomposisi + barrel export:
- `index.ts` — mengekspor semua 8 modal
- `DeleteConfirmModal.tsx`, `DeleteGroupModal.tsx`, `EditScheduleModal.tsx`, `GroupEditModal.tsx`, `MusyrifModal.tsx`, `NoteModal.tsx`, `ScheduleModal.tsx`, `UnlinkGroupConfirmModal.tsx`
- Plus subdirectories: `__tests__/`, `helpers/`, `schemas/`, `shared/`

**Bukti monolith sudah tidak digunakan:**

Semua consumer import dari folder (bukan file `.tsx`):
```typescript
// group-detail-page.tsx — import dari folder/index.ts
default: (await import("../components/group-detail-modals")).DeleteConfirmModal,

// visa-detail page — sama
default: (await import("../../../components/group-detail-modals")).DeleteGroupModal,
```

Tidak ada satu pun import yang mengarah ke `group-detail-modals.tsx` secara langsung.

### Action
**Hapus** `apps/frontend/src/components/group-detail-modals.tsx` — file ini **100% dead code** (77 KB).

---

## 2. 🔴 Backend Groups: Dual Architecture (Repository + Legacy Orchestrator)

### Temuan

Backend Groups punya **dua layer arsitektur yang hidup bersamaan**:

#### Layer Baru: Repository Pattern
```
GroupsService → GroupsCommandService → GroupRepository (interface)
                                         ├── MemoryGroupRepository
                                         └── PrismaGroupRepository
```

File-file baru:
- `domain/repositories/group.repository.ts` — abstract interface
- `groups-command.service.ts` — delegates ke repo
- `groups-query.service.ts` — delegates ke repo
- `memory-group.repository.ts`
- `prisma-group.repository.ts`

#### Layer Lama: Direct Orchestrator Pattern

Masih ada **4 service** yang langsung import dari `groups/infrastructure/` **bypassing** Repository Pattern:

| File | Imports dari Legacy | Ukuran |
|---|---|---:|
| `group-workflow-orchestrator.ts` | `groups.memory-store`, `groups.prisma-include`, `groups.prisma-write-builders` | 14 KB |
| `group-operational-command.service.ts` | `groups.memory-store`, `groups.prisma-include` | 11 KB |
| `group-visa-command.service.ts` | `groups.memory-store`, `groups.prisma-include` | 10 KB |
| `group-transportation-command.service.ts` | `groups.memory-store` | 12 KB |

Keempat file ini beroperasi dengan pola lama: menerima `memoryGroups: MemoryGroupRecord[]` array langsung di constructor dan melakukan branching `if (this.dataSource === "prisma")` secara manual.

#### Legacy Infrastructure Files yang Masih Digunakan

| File | Ukuran | Digunakan oleh |
|---|---:|---|
| `groups.memory-store.ts` | **28 KB** | 4 orchestrator services + MemoryGroupRepository + GroupMemoryStore |
| `groups.memory-builders.ts` | 3 KB | groups.memory-store.ts |
| `groups.memory-group-payload.ts` | 6 KB | groups.memory-store.ts + test |
| `groups.prisma-include.ts` | 4 KB | Orchestrators + PrismaGroupRepository + service-types |
| `groups.prisma-write-builders.ts` | 9 KB | WorkflowOrchestrator + PrismaGroupRepository + test |
| `groups.listing.ts` | 6 KB | MemoryGroupRepository + PrismaGroupRepository |
| `groups.audit.ts` | 2 KB | GroupsService + PrismaGroupRepository |

Total: **~58 KB** kode legacy infrastructure yang **masih aktif digunakan** karena migrasi Repository Pattern belum tuntas.

#### `GroupsService` Constructor Fallback

Di `groups.service.ts`:
```typescript
if (!this.groupRepo || typeof this.groupRepo.findAll !== "function") {
  const resolvedPrisma = this.groupRepo as any;
  if (this.dataSource === "prisma") {
    this.groupRepo = new PrismaGroupRepository(resolvedPrisma);
  } else {
    this.groupRepo = new MemoryGroupRepository(new GroupMemoryStore());
  }
}
```
Ini adalah **migration shim** — jika DI gagal, service membuat repo secara manual. Ini seharusnya tidak diperlukan jika `RepositoriesModule` bekerja dengan benar.

### Action

1. **Fase 1**: Verifikasi apakah 4 legacy orchestrators masih dipanggil dari mana pun. Jika `GroupsService` sudah 100% delegate ke `commandService`/`queryService`, maka orchestrators bisa dihapus.
2. **Fase 2**: Pindahkan logic dari `groups/infrastructure/*.ts` ke dalam repository implementations di `infrastructure/repositories/`. Ini memungkinkan penghapusan seluruh folder `groups/infrastructure/`.
3. **Fase 3**: Hapus constructor fallback di `GroupsService`.

---

## 3. 🟡 `InvoicesService` Unsafe Accessor Pattern

### Temuan

`invoices.service.ts` menggunakan `as any` untuk mengakses internal state dari sub-services:

```typescript
get memoryInvoiceClients() {
  return (this.commandService as any).memoryStore.clients;
}
get memoryInvoices() {
  return (this.commandService as any).memoryStore.invoices;
}
get prismaInvoiceDownPaymentColumnState() {
  return (this.queryService as any).prismaInvoiceDownPaymentColumnState;
}
```

Ini adalah **encapsulation leak** — service layer seharusnya tidak perlu mengakses private state dari sub-services. Pattern ini muncul karena:
1. Test files perlu akses langsung ke memory store untuk assertions
2. Legacy column detection state perlu di-expose ke luar

### Action
- Tambahkan proper public getter/method di `InvoiceCommandService` dan `InvoiceQueryService` untuk data yang perlu diekspos
- Atau pindahkan `InvoiceMemoryStore` keluar dari command service dan inject secara terpisah (sudah dilakukan sebagian via `RepositoriesModule`)

---

## 4. 🟢 Frontend Re-export Stub Pages (Dead Indirection)

### Temuan

Dua file page yang hanya berisi 1-line re-export:

| File | Content | Digunakan? |
|---|---|---|
| `new-group-page.tsx` | `export { NewGroupScreen } from "./new-group-screen";` | ❌ Tidak ada import |
| `input-itinerary-page.tsx` | `export { InputItineraryScreen } from "./add-group-workspace-page";` | ❌ Tidak ada import |

Kedua file ini **tidak diimpor oleh siapapun** — consumer langsung import dari file aslinya (`new-group-screen.tsx` dan `add-group-workspace-page.tsx`).

### Action
Hapus kedua file stub ini. Mereka adalah artefak dari refactoring sebelumnya saat nama file berubah tapi redirect file dibiarkan.

---

## 5. 🟢 Legacy Auth Storage Purge (Intentional, Bisa Dihapus Nanti)

### Temuan

`auth-session.ts` masih punya kode untuk membersihkan 3 legacy storage keys:

```typescript
const LEGACY_AUTH_SESSION_STORAGE_KEY = "gtt-auth-session-v1";
const LEGACY_AUTH_ACCESS_TOKEN_STORAGE_KEY = "gtt-auth-access-token-v1";
const LEGACY_SESSION_ACCESS_TIER_STORAGE_KEY = "gtt-session-access-tier-v1";
```

Function `purgeLegacyAuthStorage()` dipanggil di 3 tempat saat session persist/clear. Ini **intentional backward compatibility** — memastikan user yang masih punya old tokens di localStorage dibersihkan.

Ada test coverage yang baik di `auth-session.unit.test.ts`.

### Action
**Tidak urgent**. Setelah semua user aktif sudah login ulang (estimasi 1-2 bulan setelah migrasi), kode purge ini bisa dihapus bersama test-nya.

---

## 6. 🟡 Duplicate Test Files untuk Group Detail Modals

### Temuan

Ada **dua set test files** untuk modal yang sama:

**Old (monolith test):**
- `__tests__/group-detail-modals.test.tsx` — **848 baris, 27 KB**
- Tests semua 8 modal dalam satu file
- Import dari `'../group-detail-modals'` (resolves ke folder/index.ts)

**New (decomposed tests):**
- `group-detail-modals/__tests__/` — **8 file terpisah**
- `DeleteConfirmModal.test.tsx` (5.5 KB), `DeleteGroupModal.test.tsx` (9 KB), `EditScheduleModal.test.tsx` (7.8 KB), `GroupEditModal.test.tsx` (2.1 KB), `MusyrifModal.test.tsx` (6 KB), `NoteModal.test.tsx` (4.4 KB), `ScheduleModal.test.tsx` (7.5 KB), `UnlinkGroupConfirmModal.test.tsx` (5.1 KB)
- Total: **47.5 KB** — lebih lengkap dari monolith test

Keduanya **berjalan bersamaan** saat `test:component` — yang berarti ada **duplikasi test execution**.

### Observasi Tambahan

Old test file juga punya mock yang di-duplicate:
```typescript
vi.mock('../../hooks/use-saudi-city-options', () => ({
  useSaudiCityOptions: () => ['Makkah', 'Madinah', 'Jeddah'],
}));
```

### Action
Hapus `apps/frontend/src/components/__tests__/group-detail-modals.test.tsx` — file test monolith lama. Test decomposed yang baru sudah lebih lengkap dan per-komponen.

---

## 7. 🟡 Frontend: Helper Files Alongside Decomposed Folders

### Temuan

Pattern yang konsisten di frontend: ada **helper file besar** di level page, sementara page sudah punya subfolder decomposed. Helper file masih digunakan (bukan dead code), tapi menandakan decomposition belum tuntas.

| Helper File (legacy location) | Size | Decomposed Folder | Masih Digunakan? |
|---|---:|---|---|
| `new-group-screen-helpers.ts` | 22 KB | `new-group/` | ✅ by `new-group/hooks/`, smoke test |
| `add-group-workspace-helpers.ts` | 18 KB | `add-group-workspace/` | ✅ by workspace page, components, hooks |
| `invoice-page-shared.ts` | 31 KB | `invoice/` | ✅ by invoice hooks |

Ini **bukan dead code** — file-file ini masih aktif diimpor. Tapi secara arsitektur, helper logic ini seharusnya sudah dipindahkan ke dalam subfolder masing-masing saat decomposition dilakukan.

### Action
Pindahkan helper files ke dalam subfolder yang sesuai:
- `new-group-screen-helpers.ts` → `new-group/helpers/` atau `new-group/new-group-helpers.ts`
- `add-group-workspace-helpers.ts` → `add-group-workspace/helpers/`
- `invoice-page-shared.ts` → `invoice/invoice-shared.ts`
