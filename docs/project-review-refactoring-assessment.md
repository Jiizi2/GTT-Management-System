# Project Review & Refactoring Assessment

Tanggal audit: 2026-06-19
Branch audit: `docs/backbone-audit-plan`
Basis kode: branch baru dari `master` dengan tambahan `docs/backbone-audit-report.md` dan `docs/implementation_plan.md`.


## Stabilization Update - 2026-06-20

Assessment di bawah ini adalah baseline audit awal sebelum eksekusi refactor bertahap. Status implementasi terbaru dicatat di `docs/implementation_plan.md` dan branch `stabilization/backbone-phase-25`.

Ringkasan status setelah stabilisasi:

- Phase 0 sampai Phase 5 selesai untuk scope backbone yang disepakati: bug critical, persistent data contract, API contract hardening, modularisasi aman, dan rationalisasi awal memory mode.
- Kontrak database penting sudah diperkuat: `InvoiceClient.sortOrder` tidak lagi unique global, `VisaHotelAgreement.sourceDraftId` persisten, `Group.lifecycleStatus` tersedia, dan `VisaSetup.busStatus` eksplisit.
- Guard backend untuk parent-child flat hierarchy sudah ditambahkan dan diuji.
- Frontend sudah memakai kontrak response groups/agreement drafts dan enum mapping terpusat untuk area yang distabilisasi.
- Backend Prisma startup sekarang fail-fast jika schema belum punya kolom wajib, sehingga migration drift tidak berubah menjadi error 500 diam-diam di endpoint runtime.
- Local/development sudah diverifikasi dengan database PostgreSQL bersih `gtt_ops_refactor_20260620_132631`, `npm run qa:full`, `npm run dev:backend`, dan `npm run dev:frontend`.
- Rehearsal dengan clone DB VPS sudah selesai: `db:status` aman tanpa drift, `db:deploy` berhasil, `qa:full` berhasil, dan manual review flow bisnis sudah selesai.

Dengan status ini, temuan baseline yang menyebut `sourceDraftId` belum persisten, parent-child belum diguard, bus status masih notes-only, atau `InvoiceClient.sortOrder` masih unique global harus dibaca sebagai historical finding, bukan kondisi branch stabilisasi terbaru. Sisa pekerjaan realistis sebelum keputusan PR ke `master` adalah keputusan apakah perubahan stabilisasi ini akan dipromosikan sebagai satu PR besar atau dipilah menjadi PR lebih kecil.

## Scope dan Metode

Audit ini membaca dokumentasi project, schema Prisma, service backend, DTO, controller, hooks frontend, domain frontend, dan alur utama group, visa, agreement draft, checklist, invoice, master data, auth, serta deployment/QA.

Referensi utama:

- `docs/backbone-audit-report.md`
- `docs/implementation_plan.md`
- `docs/application-overview.md`
- `docs/codebase-walkthrough.md`
- `docs/backend.md`
- `docs/frontend.md`
- `docs/qa.md`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/src/groups/**`
- `apps/frontend/src/hooks/use-app-controller-backend.ts`
- `apps/frontend/src/shared/app-domain.ts`

Verifikasi yang dijalankan:

```bash
npm run db:generate --workspace backend
npm run check --workspace backend
npm run check --workspace frontend
```

Catatan: `npm run check --workspace backend` sempat gagal sebelum `prisma generate` karena Prisma Client lokal masih stale dari branch sebelumnya. Setelah regenerate, backend dan frontend type-check lulus.

---

## 1. Executive Summary

Project ini sudah memiliki fondasi yang cukup baik: monorepo rapi, auth global, DTO validation, Prisma migration history, TanStack Query, test suite unit/e2e, dan dokumentasi operasional yang lumayan lengkap. Namun, domain utama `Group` telah berkembang terlalu besar sehingga kontrak antar database, backend, dan frontend mulai longgar.

Risiko terbesar saat ini bukan sekadar ukuran file, melainkan inkonsistensi kontrak data:

- Database masih menyimpan `Group.status` sebagai `String`, sementara UI dan test memakai variasi seperti `Active`, `Inactive`, `In Active`, dan `Entry Only`.
- `InvoiceClient.sortOrder` masih unique global, tidak selaras dengan kebutuhan urutan per client/group.
- Relasi parent-child group belum punya guard database/backend yang memastikan hierarki tetap 1 level.
- Agreement draft sekarang dihubungkan ke group secara derivatif lewat data hotel agreement, tetapi beberapa sisa kode masih menganggap ada link eksplisit atau `sourceDraftId` yang persisten.
- Frontend melakukan banyak mapping manual dan fallback diam-diam sehingga perubahan API bisa terlihat sukses di UI tetapi gagal atau berubah setelah refresh.
- Refactor besar sebelumnya gagal karena menyentuh terlalu banyak layer sekaligus tanpa memperkeras kontrak dan test skenario bisnis parent-child/visa dulu.

Rekomendasi utama: lakukan stabilisasi bertahap. Jangan mulai dengan memecah `app-domain.ts` atau menghapus memory mode secara besar-besaran. Mulai dari perbaikan kontrak database/API yang kecil tetapi berdampak tinggi, lalu tambah test integrasi untuk skenario bisnis, baru refactor struktur file.

---

## 2. Architecture Assessment

### Database

Prisma schema cukup eksplisit untuk banyak relasi operasional: `Group`, `VisaSetup`, `VisaHotelAgreement`, `RaudhahAppointment`, `ChecklistAssignment`, `Invoice`, `MasterDataOption`, dan auth. Index dasar juga ada untuk beberapa query penting.

Masalah utama database adalah beberapa konsep domain masih belum dimodelkan sebagai constraint yang kuat:

- `Group.status` masih `String` di `apps/backend/prisma/schema.prisma:124`.
- `Group.tone` sudah enum, tetapi belum ada index di `tone` walaupun active-only/filter operasional bergantung pada tone.
- `Group.parentGroupId` self-relation ada di `apps/backend/prisma/schema.prisma:145`, tetapi belum ada constraint anti-grandchild.
- `VisaHotelAgreement` tidak menyimpan `sourceDraftId`, padahal frontend dan service masih membawa field itu.
- `HotelAgreementDraft` sudah tidak punya `groupId`/`assignedAt`, tetapi beberapa contract DTO/docs masih menyebut assigned state seolah field itu ada.
- `InvoiceClient.sortOrder` masih `@@unique([sortOrder])` di `apps/backend/prisma/schema.prisma:177`.

Secara desain, database perlu menjadi single source of truth untuk invariants yang kritikal: enum status, relasi parent-child, kapasitas agreement draft, dan sort order invoice.

### Backend

Backend memakai NestJS dengan pemisahan module yang masuk akal. Modul groups sudah dibagi menjadi `http`, `application`, `domain`, `infrastructure`, dan `dto`. Ini arah yang benar.

Masalahnya, service layer masih membawa terlalu banyak mode dan kontrak sekaligus:

- `GroupsService` masih facade dual data source memory/prisma, dengan return type `unknown` di `apps/backend/src/groups/application/groups.service.ts:62` sampai `:73`.
- `GroupsCommandService` dan `HotelAgreementDraftsService` masih punya path memory dan Prisma berbeda perilaku.
- Banyak operasi Prisma melakukan write lalu fetch ulang detail group, misalnya `addVisaHotelAgreementWithPrisma` memanggil `findOneWithPrisma` setelah create di `apps/backend/src/groups/application/groups-command.service.ts:831` sampai `:844`.
- Agreement draft assignment memanggil `GroupsService.addVisaHotelAgreement`, sehingga operasi lintas aggregate tidak berada dalam satu transaction yang sama.
- Controller auth guard global sudah baik melalui `APP_GUARD`, tetapi dokumentasi endpoint agreement draft sudah tidak sinkron dengan controller aktual.

Backend sudah cukup aman secara auth dasar, tetapi lemah di typed domain contract dan transaction boundary.

### Frontend

Frontend sudah menggunakan TanStack Query, API client terpusat, React Hook Form, dan zod untuk form. Ini fondasi bagus.

Masalah utama frontend:

- API response belum diparse dengan zod/schema runtime. `BackendGroupRecord` membuat hampir semua field optional di `apps/frontend/src/hooks/use-app-controller-backend.ts:146` dan seterusnya.
- Mapping enum manual tersebar, misalnya `mapVisaStatusToBackend`, `mapPaymentStatusToBackend`, `mapBackendVisaStatus`, dan lain-lain di `apps/frontend/src/hooks/use-app-controller-backend.ts:252` sampai `:297` dan `:684` sampai `:728`.
- `app-domain.ts` masih 2508 baris dan mencampur type, fixture, helper, domain logic, dan status rules.
- Query key groups belum punya key detail per group. Mutasi masih banyak invalidate `groupQueryKeys.all`, bukan cache detail spesifik.
- Optimistic/local state update cukup kompleks di `use-dashboard-group-records.ts`, sehingga error backend mudah tersamarkan.

Frontend tidak perlu langsung dibongkar total. Yang paling penting adalah memperjelas boundary API dan mengurangi fallback diam-diam.

### Integration

Integrasi backend-frontend sekarang bergantung pada kesepakatan informal: enum disalin manual, field optional diperlakukan sebagai fallback UI, agreement draft assigned/unassigned diturunkan dari pencocokan hotel agreement, dan group child mewarisi operational fields dari parent saat query detail tanpa model inheritance eksplisit di DB/API.

---

## 3. Findings

### Critical

#### C1. `Group.status` masih string bebas

Lokasi:

- `apps/backend/prisma/schema.prisma:124`
- `apps/backend/src/groups/dto/create-group.dto.ts:445`
- `apps/backend/src/groups/dto/update-group.dto.ts:16`
- `apps/frontend/src/shared/app-domain.ts:1049`

Masalah: status group disimpan sebagai string bebas, sementara UI/test memakai variasi `Active`, `Inactive`, `In Active`, `Entry Only`. `tone` sudah enum, tetapi `status` tetap bebas dan masuk ke search document.

Dampak:

- Data status bisa drift.
- Filter dan search bisa miss.
- Refactor status akan rawan regresi karena tidak ada contract kuat.

Rekomendasi:

- Tambahkan `GroupStatus` enum atau pisahkan `lifecycleStatus` dari display label.
- Migrasikan data lama dengan mapping eksplisit.
- Jadikan `tone` sebagai derived/read model jika hanya untuk active/inactive UI.

#### C2. `InvoiceClient.sortOrder` unique global

Lokasi:

- `apps/backend/prisma/schema.prisma:167` sampai `:178`
- `apps/backend/src/invoices/invoices.service.ts:545` sampai `:567`

Masalah: `@@unique([sortOrder])` membuat sort order unik global. Service juga membuat sort order dengan `max + 1`, bukan per group atau per scope.

Dampak:

- Potensi konflik P2002 saat data invoice/client bertambah.
- Model tidak fleksibel jika client ordering perlu scoped.

Rekomendasi:

- Jika sort order global memang diinginkan, ubah nama/semantik menjadi `displayOrder` dan pertahankan unique dengan transaction lock yang jelas.
- Jika urutan harus scoped, ubah ke `@@unique([groupId, sortOrder])` atau cukup `@@index([sortOrder])`.

#### C3. Parent-child group belum diproteksi dari multi-level hierarchy

Lokasi:

- `apps/backend/prisma/schema.prisma:145` sampai `:147`
- `apps/backend/src/groups/application/groups-command.service.ts:1222` sampai `:1285`
- `apps/backend/src/groups/application/groups-query.service.ts:164` sampai `:187`

Masalah: `parentGroupId` bisa diisi tanpa validasi bahwa parent bukan child, dan bahwa group yang sedang diubah belum punya child. Query inheritance hanya 1 level.

Dampak:

- Bisa terbentuk grandchild.
- Operational data inheritance menjadi salah.
- Sync/edit rule parent-child sulit dipahami.

Rekomendasi:

- Tambahkan validation backend `validateParentGroupLink` di create/update.
- Tambahkan test integration: parent ke child valid, child ke grandchild ditolak, parent yang sudah punya child tidak bisa dijadikan child.
- Pertimbangkan DB trigger/check constraint jika rule ini kritikal di luar API.

#### C4. Agreement draft link tidak punya identitas persisten yang kuat

Lokasi:

- `apps/backend/prisma/schema.prisma:305` sampai `:320`
- `apps/backend/src/groups/dto/group-operations.dto.ts:128` sampai `:131`
- `apps/frontend/src/hooks/use-app-controller-backend.ts:446` sampai `:458`
- `apps/backend/src/groups/application/hotel-agreement-drafts.service.ts:128` sampai `:181`

Masalah: DTO dan frontend membawa `sourceDraftId`, tetapi `VisaHotelAgreement` tidak punya kolom `sourceDraftId`, dan Prisma selection tidak mengembalikan field itu. Memory mode menyimpan field ini, Prisma mode kehilangan field ini. Akibatnya assignment/unassignment draft di Prisma harus mencocokkan city, agreement number, hotel name, date, dan kadang mengabaikan pax.

Dampak:

- Unassign bisa salah target jika ada draft mirip.
- Status assigned/partially assigned dihitung dari data turunan, bukan relasi eksplisit.
- Behavior memory dan Prisma berbeda.

Rekomendasi:

- Tambahkan `sourceDraftId String?` di `VisaHotelAgreement` dengan FK opsional ke `HotelAgreementDraft`.
- Backfill dari matching existing data jika memungkinkan.
- Gunakan `sourceDraftId` sebagai identitas utama untuk assign/unassign, fallback matching hanya untuk data legacy.

#### C5. Create group masih mencoba menulis field draft yang sudah dihapus migration

Lokasi:

- `apps/backend/prisma/migrations/20260617061830_remove_group_id_from_hotel_draft/migration.sql:15`
- `apps/backend/src/groups/application/groups-command.service.ts:1033` sampai `:1044`

Masalah: migration menghapus `HotelAgreementDraft.groupId` dan `assignedAt`, tetapi `createWithPrisma` masih memanggil `hotelAgreementDraft.updateMany` dengan `groupId` dan `assignedAt` ketika payload berisi `sourceDraftId`.

Dampak:

- Risiko runtime error pada create group dengan selected agreement draft.
- Menandakan refactor agreement draft belum selesai lintas layer.

Rekomendasi:

- Hapus update `groupId`/`assignedAt` lama.
- Ganti dengan relasi `sourceDraftId` pada `VisaHotelAgreement` atau flow assign eksplisit setelah group dibuat.
- Tambahkan e2e test create group dari new group screen dengan selected draft.

### High

#### H1. Return type service groups masih `unknown`

Lokasi:

- `apps/backend/src/groups/application/groups.service.ts:62` sampai `:73`
- `apps/backend/src/groups/application/groups-query.service.ts:27` sampai `:50`

Dampak: controller dan caller tidak punya type safety. Perubahan Prisma selection bisa tidak terdeteksi oleh TypeScript.

Rekomendasi: definisikan `GroupDetailRecord`, `GroupSummaryRecord`, dan `PaginatedGroupList<T>` dari `Prisma.GroupGetPayload` dengan selection yang ada.

#### H2. Dual data source memory/prisma membuat behavior bercabang

Lokasi:

- `apps/backend/src/groups/application/groups.service.ts:36` sampai `:59`
- `apps/backend/src/invoices/invoices.service.ts:398` sampai `:430`
- `apps/backend/src/groups/application/hotel-agreement-drafts.service.ts:184` sampai `:195`

Dampak: test memory tidak cukup menjamin production behavior. Memory menyimpan field seperti `sourceDraftId`, sementara Prisma tidak.

Rekomendasi: jangan hapus langsung. Batasi memory sebagai adapter test/dev, lalu buat contract tests yang dijalankan pada memory dan Prisma untuk skenario domain yang sama.

#### H3. API response frontend tidak divalidasi runtime

Lokasi:

- `apps/frontend/src/hooks/use-app-controller-backend.ts:146` dan seterusnya
- `apps/frontend/src/hooks/use-app-controller-backend.ts:1121` sampai `:1125`
- `apps/frontend/src/hooks/use-agreement-drafts-query.ts:9` sampai `:27`

Dampak: response API yang rusak bisa diubah menjadi fallback UI tanpa error jelas. Ini memperbesar risiko bug refresh kembali ke data awal.

Rekomendasi: buat zod schema untuk `BackendGroupRecord`, `BackendAgreementDraft`, `BackendInvoice`, dan parse di API hooks.

#### H4. Mapping enum backend/frontend manual dan tidak lengkap

Lokasi:

- `apps/frontend/src/hooks/use-app-controller-backend.ts:252` sampai `:297`
- `apps/frontend/src/hooks/use-app-controller-backend.ts:684` sampai `:728`
- `apps/frontend/src/hooks/use-agreement-drafts-query.ts:63` sampai `:82`

Masalah: `mapAgreementStatusToBackend` untuk group hotel hanya mengembalikan `WAITING | APPROVED`, sementara enum backend juga punya `REJECTED`.

Rekomendasi: generate client type dari OpenAPI atau buat shared contract package kecil untuk enum/constants.

#### H5. Agreement draft list filtering bisa override filter assigned saat query aktif

Lokasi:

- `apps/backend/src/groups/application/hotel-agreement-drafts.service.ts:842` sampai `:890`

Masalah: `where.OR` untuk assigned pairs bisa ditimpa oleh `where.OR` search query. Kombinasi status filter + search berpotensi mengabaikan filter assigned/unassigned.

Rekomendasi: bangun Prisma where dengan `AND: [statusCondition, searchCondition]`, bukan mutasi `where.OR` bertahap.

#### H6. Transaction boundary agreement draft assign tidak atomic

Lokasi:

- `apps/backend/src/groups/application/hotel-agreement-drafts.service.ts:467` sampai `:538`
- `apps/backend/src/groups/application/groups-command.service.ts:796` sampai `:844`

Masalah: assign menghitung kapasitas, mencari target group, lalu memanggil service lain yang menulis hotel agreement. Ini tidak dalam satu transaction/domain command.

Dampak: dua assign paralel bisa melewati remaining capacity check.

Rekomendasi: pindahkan assign draft ke satu Prisma transaction dengan row/advisory lock pada draft id.

### Medium

#### M1. `app-domain.ts` adalah god file

Lokasi: `apps/frontend/src/shared/app-domain.ts` (2508 lines)

Dampak: domain type, fixtures, helper, business rules, dan derived view model tercampur. Refactor jadi berisiko karena blast radius besar.

Rekomendasi: pecah bertahap setelah contract API stabil: types, fixtures, group status logic, itinerary logic, checklist logic, visa logic.

#### M2. `use-app-controller-backend.ts` terlalu banyak peran

Lokasi: `apps/frontend/src/hooks/use-app-controller-backend.ts` (1205 lines)

Masalah: file ini memuat payload builder, response mapper, validators ringan, dan API calls.

Rekomendasi: pisah menjadi `group-api.ts`, `group-mappers.ts`, `group-contract.ts`, dan `visa-agreement-api.ts` setelah zod schema dibuat.

#### M3. Query cache groups belum punya detail key

Lokasi:

- `apps/frontend/src/shared/query-keys.ts:7` sampai `:14`
- `apps/frontend/src/hooks/use-groups-query.ts:5` sampai `:31`

Dampak: mutasi cenderung invalidate semua groups. Ini boros dan bisa memicu flicker/regresi state.

Rekomendasi: tambah `groupQueryKeys.detail(code)` dan query detail yang dipakai halaman detail/visa detail.

#### M4. Bus status disimpan di notes text

Lokasi:

- `apps/frontend/src/hooks/use-app-controller-backend.ts:422` sampai `:426`
- `apps/frontend/src/hooks/use-app-controller-backend.ts:760` sampai `:775`

Dampak: field bisnis penting diparse regex dari notes. Format typo akan hilang.

Rekomendasi: tambah `busStatus` enum di `VisaSetup` atau `Group`, backfill dari notes, lalu hentikan parsing notes untuk data baru.

#### M5. Write lalu fetch ulang group detail berulang

Lokasi:

- `apps/backend/src/groups/application/groups-command.service.ts:831` sampai `:844`
- `apps/backend/src/groups/application/groups-command.service.ts:893` sampai `:906`
- `apps/backend/src/groups/application/groups-command.service.ts:964` sampai `:1004`

Dampak: round trip DB bertambah dan command service semakin bergantung pada full read model.

Rekomendasi: untuk mutation kecil, gunakan transaction select/include final yang spesifik atau return DTO minimal lalu frontend invalidate detail.

#### M6. Search document manual rawan stale

Lokasi:

- `apps/backend/prisma/schema.prisma:125`
- `apps/backend/src/groups/application/groups-command.service.ts:1267` sampai `:1272`
- `apps/backend/src/groups/infrastructure/groups.prisma-write-builders.ts:195` sampai `:200`

Rekomendasi: tetap boleh manual sementara, tetapi tambahkan tests untuk semua write path yang mengubah `code`, `name`, `status`, `packageName`.

#### M7. Generated Prisma Client stale setelah pindah branch

Observasi: backend type-check gagal sebelum `npm run db:generate --workspace backend`, lalu lulus setelah generate.

Rekomendasi: dokumentasikan dan/atau tambahkan script `postcheckout` opsional, atau ubah `check:backend` agar menjalankan generate dulu seperti build.

### Low

#### L1. Dokumentasi endpoint agreement draft tidak sinkron

Lokasi:

- `docs/backend.md:184` sampai `:188`
- `docs/codebase-walkthrough.md:185` sampai `:189`
- `apps/backend/src/groups/http/hotel-agreement-drafts.controller.ts:29`

Dokumentasi menyebut `/api/hotel-agreement-drafts`, controller aktual `/api/visa/agreement-drafts`.

#### L2. UI page dan component besar

Contoh:

- `apps/frontend/src/pages/invoice-page.tsx` 2553 lines
- `apps/frontend/src/pages/add-group-workspace-page.tsx` 2454 lines
- `apps/frontend/src/pages/visa-detail-page.tsx` 2139 lines
- `apps/frontend/src/components/group-detail-modals.tsx` 1732 lines

Rekomendasi: pecah setelah domain/API contract stabil. Jangan jadikan ini sprint pertama.

#### L3. Docs release flow menyebut `develop`, tetapi branch aktif terlihat memakai `master`/feature branches

Rekomendasi: rapikan branch policy aktual agar sesuai kebiasaan repo.

---

## 4. Refactoring Plan

### Phase 0 - Stabilize Audit Branch

Target: laporan dan baseline aman.

1. Commit hanya dokumen audit/plan.
2. Pastikan `npm run db:generate --workspace backend`, backend check, dan frontend check lulus.
3. Jangan ubah source code produksi di branch audit ini.

### Phase 1 - Fix Critical Contract Bugs

Target: perubahan kecil, impact tinggi.

1. Fix `InvoiceClient.sortOrder` constraint.
2. Tambah guard anti-grandchild untuk `parentGroupId`.
3. Hapus sisa write `HotelAgreementDraft.groupId/assignedAt` atau ganti dengan flow source draft yang benar.
4. Tambah `sourceDraftId` pada `VisaHotelAgreement` dan gunakan untuk assign/unassign.
5. Tambah tests integration untuk create group with draft, assign partial capacity, unassign specific group, parent-child hierarchy.

### Phase 2 - Harden API Contracts

Target: backend/frontend tidak lagi sepakat secara informal.

1. Definisikan DTO response typed di backend dari Prisma payload.
2. Tambahkan zod response schema di frontend untuk groups, agreement drafts, invoices, master data.
3. Buat central enum map atau generated OpenAPI client.
4. Hilangkan fallback diam-diam untuk required API fields; tampilkan error yang jelas.

### Phase 3 - Database Normalization

Target: data model lebih tahan perubahan bisnis.

1. Migrasikan `Group.status` ke enum/lifecycle status.
2. Tambah `busStatus` enum di `VisaSetup` atau `Group`.
3. Tambah index `Group.tone` dan index sesuai query agreement draft.
4. Pertimbangkan generated/search column atau trigger untuk `searchDocument`.

### Phase 4 - Modularize Frontend Domain

Target: refactor aman setelah contract stabil.

1. Pecah `app-domain.ts` menjadi `types`, `fixtures`, dan `domain/*`.
2. Pecah `use-app-controller-backend.ts` menjadi API client, mappers, schemas.
3. Tambah query detail per group dan kurangi invalidate global.
4. Pecah page besar berdasarkan workflow, bukan sekadar berdasarkan ukuran file.

### Phase 5 - Simplify Backend Data Source Strategy

Target: memory mode tidak lagi menutupi bug production.

1. Buat contract tests yang wajib pass di memory dan Prisma.
2. Pindahkan memory store ke adapter test/dev jelas.
3. Untuk production-like local dev, default-kan Prisma di QA full.
4. Hapus fallback schema-drift yang sudah tidak diperlukan setelah migration discipline stabil.

---

## 5. Database Improvements

1. Tambah enum `GroupStatus` atau model lifecycle status.
   - Suggested values: `ENTRY_ONLY`, `ACTIVE`, `INACTIVE`, `COMPLETED`, `ARCHIVED`.
   - Simpan display label di frontend atau master data, bukan sebagai raw DB value.

2. Fix `InvoiceClient.sortOrder`.
   - Option A: `@@index([sortOrder])` jika hanya ordering global.
   - Option B: `@@unique([groupId, sortOrder])` jika scoped per group.

3. Tambah `VisaHotelAgreement.sourceDraftId`.
   - FK opsional ke `HotelAgreementDraft.id` dengan `onDelete: SetNull`.
   - Index `@@index([sourceDraftId])`.

4. Tambah constraint/index parent-child.
   - `@@index([parentGroupId])`.
   - Guard anti-grandchild di service; trigger DB jika perlu hard guarantee.

5. Tambah `busStatus` sebagai enum.
   - `VISA_PLUS`, `VISA_ONLY` atau nama domain yang lebih jelas.
   - Backfill dari notes `Bus status:`.

6. Tambah `@@index([tone])` di `Group`.

7. Evaluasi `searchDocument`.
   - Jangka pendek: test write path.
   - Jangka panjang: generated column/trigger atau PostgreSQL tsvector.

8. Tambah unique/index untuk agreement draft bila sesuai bisnis.
   - Misalnya `@@index([city, agreementNumber])`.
   - Jangan unique dulu jika agreement number bisa dipakai split capacity lintas group.

---

## 6. Backend Improvements

1. Buat typed return model untuk groups.
   - `GroupSummaryRecord = Prisma.GroupGetPayload<{ select: typeof groupSummarySelection }>`.
   - `GroupDetailRecord = Prisma.GroupGetPayload<{ select: typeof groupDetailSelection }>`.

2. Buat command khusus parent-child.
   - `linkChildGroup(parentId, childId)`.
   - `unlinkChildGroup(childId)`.
   - Hindari update generic `parentGroupId` tanpa validasi.

3. Jadikan agreement draft assignment satu transaction.
   - Lock draft id.
   - Cek remaining capacity.
   - Upsert/create visa setup.
   - Create `VisaHotelAgreement` dengan `sourceDraftId`.

4. Pisahkan read model dan write model.
   - Command tidak perlu selalu return full group detail.
   - Query detail bisa bertanggung jawab atas inheritance parent-child.

5. Kurangi `unknown` pada service/public API.

6. Tambah tests untuk kasus bisnis, bukan hanya function-level.
   - Parent-child flat hierarchy.
   - Visa child independen.
   - Agreement draft partial assignment.
   - Create group dari selected draft.
   - Rejected agreement status.

7. Update docs endpoint agar sesuai controller aktual.

---

## 7. Frontend Improvements

1. Tambah zod schema untuk API response.
   - Mulai dari groups dan agreement drafts.
   - Fail loudly saat required field hilang.

2. Centralize enum mapping.
   - Jangan mapping `WAITING`, `APPROVED`, `REJECTED` di banyak file.
   - Pastikan group hotel agreement juga mendukung `Rejected` jika backend mengizinkan.

3. Tambah query detail group.
   - `groupQueryKeys.detail(code)`.
   - Halaman detail/visa detail tidak perlu selalu bergantung list besar.

4. Kurangi optimistic update untuk operasi high-risk.
   - Untuk agreement draft, visa hotel, parent-child link, lebih aman tunggu server response lalu update cache.

5. Pecah `app-domain.ts` setelah API schema stabil.
   - `shared/domain/types.ts`
   - `shared/domain/group-status.ts`
   - `shared/domain/visa.ts`
   - `shared/domain/checklist.ts`
   - `shared/fixtures/groups.ts`

6. Pecah `use-app-controller-backend.ts`.
   - `groups-api.ts`
   - `groups-contract.ts`
   - `groups-mappers.ts`
   - `agreement-drafts-api.ts`

7. UI large pages dipisah berdasarkan workflow.
   - Invoice: list, form, items editor, export.
   - Visa detail: status, hotel agreements, raudhah, linked groups.
   - Add group: identity, itinerary, agreement, review.

---

## 8. Migration Strategy

### Principles

- Satu migration kecil per domain invariant.
- Selalu tambah test sebelum refactor behavior.
- Hindari perubahan UI besar bersamaan dengan perubahan schema.
- Pertahankan backward compatibility untuk data lama minimal satu release.
- Jangan hapus memory mode sampai Prisma contract tests lengkap.

### Suggested Order

1. Preparation
   - Regenerate Prisma client.
   - Jalankan `npm run qa`.
   - Tambah tests pending untuk bugs critical.

2. Invoice safe migration
   - Ubah unique sort order.
   - Jalankan migration.
   - Test create multiple clients.

3. Parent-child guard
   - Backend-only validation.
   - Tidak perlu migration besar.
   - Tambah integration tests.

4. Agreement draft source link
   - Add nullable `sourceDraftId`.
   - Deploy migration.
   - Update backend assign/create group.
   - Frontend tetap compatible.

5. Group status enum
   - Tambah enum baru atau field baru dulu.
   - Backfill dari string lama.
   - Update backend DTO and frontend mapping.
   - Setelah data stabil, drop/deprecate string lama.

6. Bus status normalization
   - Add field.
   - Backfill from notes.
   - Frontend read new field, fallback notes legacy.
   - Later stop writing marker notes.

7. Frontend API schema
   - Zod parse one endpoint at a time.
   - Start with agreement drafts and groups.

8. File/module refactor
   - Only after tests and contracts stabilize.
   - Keep PRs small and reviewable.

### Rollback Plan

- For additive migrations (`sourceDraftId`, `busStatus`, new enum field), keep old read path until confidence is high.
- For constraint changes (`InvoiceClient.sortOrder`), backup current table and verify duplicate behavior in staging.
- For status enum, deploy in two steps: add/backfill first, enforce later.

---

## Recommended Immediate Backlog

### P0

1. Fix stale agreement draft code path writing removed `groupId`/`assignedAt`.
2. Fix `InvoiceClient.sortOrder` constraint.
3. Add parent-child anti-grandchild guard.
4. Add regression tests for child visa independence and agreement draft assignment.

### P1

1. Add `sourceDraftId` to `VisaHotelAgreement`.
2. Add zod response parsing for groups and agreement drafts.
3. Add `GroupStatus` migration plan.
4. Add detail query key for group detail pages.

### P2

1. Add `busStatus` field.
2. Type backend service returns.
3. Reduce global invalidation after mutations.
4. Update docs endpoint paths.

### P3

1. Split `app-domain.ts`.
2. Split `use-app-controller-backend.ts`.
3. Split large pages/components.
4. Rationalize memory mode.

---

## Final Recommendation

Jangan ulangi refactor besar pada branch sebelumnya. Project ini perlu fase stabilisasi kontrak terlebih dahulu. Fokus 2 sampai 3 PR pertama harus kecil, mudah diverifikasi, dan menyentuh invariant yang paling berbahaya: agreement draft identity, invoice sort order, parent-child hierarchy, dan status enum. Setelah itu, baru refactor modular frontend/backend akan jauh lebih aman.
