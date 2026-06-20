# Overview Feature Audit Report

Tanggal audit: 2026-06-20
Cakupan: fitur Overview, dari UI React sampai query/listing backend.

## Ringkasan

Audit ini memeriksa fitur Overview secara end-to-end:

- UI daftar group, search, filter bulan, filter active only, pagination, dan export report.
- State/controller frontend yang menggabungkan data list, remote search, linked groups, dan statistik.
- API frontend untuk `GET /api/groups`.
- Backend controller, query service, memory listing, Prisma listing, dan projection `summary`/`detail`.
- Domain logic status/tone group dan linked parent-child group.

Kesimpulan utama: fitur Overview sudah punya fondasi yang cukup baik, terutama pemisahan `summary`/`detail` projection dan local filter untuk kombinasi month + active. Risiko terbesar saat ini ada pada interaksi search dengan linked/child group. Ada kemungkinan data child cocok dengan keyword, tetapi parent card tidak muncul karena remote search sudah mempersempit data sebelum frontend menjalankan logic parent-child.

## Execution Update - 2026-06-20

Status setelah eksekusi awal:

- P0 selesai: Overview search sekarang tetap memakai full local summary list, sehingga match pada child group bisa resolve ke parent card sebelum filter final.
- P0 regression test ditambahkan di `apps/frontend/src/unit/overview-filter.unit.test.ts`.
- P1 sebagian selesai: label pax pada group card diperjelas menjadi `Linked Pax` karena angka tersebut menjumlahkan parent + child group.
- P2 kontrak minimal selesai: `lifecycleStatus` diperlakukan sebagai workflow state tersimpan dari backend, sedangkan frontend `tone` diperlakukan sebagai current operational state yang bisa menjadi inactive jika seluruh itinerary sudah lewat. Kontrak ini dikunci di mapper test dan diberi komentar di mapper frontend.

Verifikasi terbaru:

```bash
npm run test:unit --workspace frontend -- --run src/unit/overview-filter.unit.test.ts src/unit/use-app-controller-backend.unit.test.ts src/unit/app-domain.unit.test.ts
```

Hasil: 15 test files passed, 65 tests passed.

Verifikasi tambahan P2:

```bash
npm run test:unit --workspace frontend -- --run src/unit/use-app-controller-backend.unit.test.ts src/unit/overview-filter.unit.test.ts
```

Expected contract: response backend dengan `lifecycleStatus: "ACTIVE"` tetap tersimpan di frontend sebagai lifecycle, tetapi `tone` bisa menjadi `inactive` jika itinerary sudah selesai.

## Alur Data Overview

1. Route `/overview` dirender lewat `AppMainContent` dan menerima state dari `useAppController`.
2. `useAppController` meneruskan `query`, `isActiveOnly`, dan `overviewMonthFilter` ke `useDashboardGroupRecords`.
3. Untuk Overview, `resolveRequestedGroupProjection` memilih projection `summary`.
4. `useGroupsQuery("summary")` memanggil `fetchGroupsFromBackend({ projection: "summary" })`.
5. Saat user mengetik search, `useGroupsSearchQuery(query, "summary")` memanggil backend dengan `q`.
6. Frontend melakukan filter akhir:
   - child group disembunyikan dari card Overview;
   - month filter diterapkan lokal;
   - active only diterapkan lokal;
   - parent bisa ditampilkan jika child match query, tetapi hanya jika child dan parent tersedia di source data lokal.
7. Statistik dihitung dari group yang terlihat pada source month, dengan child pax ikut digabung ke parent pada beberapa metrik.

Referensi utama:

- `apps/frontend/src/pages/overview-page.tsx`
- `apps/frontend/src/hooks/app-controller/use-dashboard-group-records.ts`
- `apps/frontend/src/hooks/use-groups-query.ts`
- `apps/frontend/src/hooks/groups-backend-api.ts`
- `apps/frontend/src/components/group-card.tsx`
- `apps/backend/src/groups/http/groups.controller.ts`
- `apps/backend/src/groups/application/groups-query.service.ts`
- `apps/backend/src/groups/infrastructure/groups.listing.ts`
- `apps/backend/src/groups/infrastructure/groups.prisma-include.ts`

## Temuan

### OVR-1 - Search linked/child group bisa tidak menampilkan parent

Severity: High

Lokasi:

- `apps/frontend/src/hooks/use-groups-query.ts`
- `apps/frontend/src/hooks/groups-backend-api.ts`
- `apps/frontend/src/hooks/app-controller/use-dashboard-group-records.ts`
- `apps/backend/src/groups/infrastructure/groups.listing.ts`

Detail:

Overview memakai remote search saat projection adalah `summary`. Query dikirim ke backend sebagai `GET /api/groups?q=...&projection=summary`. Backend mencari group yang dokumen search-nya cocok dengan keyword. Search document backend hanya mencakup data group itu sendiri seperti `code`, `name`, `status`, dan `packageName`.

Di frontend ada logic untuk menyembunyikan child group dari card Overview, lalu menampilkan parent bila child match query. Namun logic ini berjalan setelah remote search selesai. Jika keyword hanya cocok dengan child group, backend dapat mengembalikan child saja. Setelah itu frontend langsung membuang child karena `parentGroupId` ada. Parent tidak ada di source remote result, sehingga parent tidak bisa ditampilkan.

Dampak:

- User mencari kode/nama child group, tetapi Overview menampilkan `No groups found`.
- Data sebenarnya ada di database, tetapi tidak terlihat pada Overview.
- Risiko ini paling besar untuk fitur linked groups karena UX Overview sengaja hanya menampilkan parent card.

Rekomendasi:

1. Untuk Overview search, gunakan local filtering dari full `visibleGroupRecords` saat data summary sudah dimuat, bukan remote search yang mempersempit parent-child relation.
2. Alternatif backend: saat child group match query, backend ikut mengembalikan parent group.
3. Tambahkan unit/regression test: `search by child code/name should display parent card`.
4. Tambahkan test untuk kombinasi query + month filter + active only pada linked groups.

Prioritas fix: P0 untuk fitur linked groups.

### OVR-2 - Angka pax card dan statistik active bisa berbeda makna

Severity: Medium

Lokasi:

- `apps/frontend/src/components/group-card.tsx`
- `apps/frontend/src/hooks/app-controller/use-dashboard-group-records.ts`

Detail:

`GroupCard` menghitung `totalPax` dari parent + semua child group yang terhubung. Sementara statistik `Active Pilgrims` menghitung parent active + child active saja. Dengan filter `Active only`, card masih bisa menampilkan total pax yang mencakup child inactive/completed, sementara stat card menghitung active pax.

Dampak:

- Angka pax pada card dapat terlihat tidak konsisten dengan statistik utama.
- Operator bisa salah memahami apakah angka tersebut adalah total linked pax atau active linked pax.

Rekomendasi:

1. Tetapkan definisi produk:
   - `total linked pax`: selalu parent + semua child, apa pun statusnya; atau
   - `active linked pax`: parent + child active saja saat active only aktif.
2. Jika memakai `total linked pax`, label UI perlu eksplisit, misalnya `Linked Pax` atau `Total Linked Pax`.
3. Jika memakai `active linked pax`, `GroupCard` perlu menerima konteks `isActiveOnly` atau menghitung child sesuai filter aktif.
4. Tambahkan unit test untuk parent active dengan child inactive.

Prioritas fix: P1.

### OVR-3 - Definisi active frontend dan backend belum satu kontrak

Severity: Medium/Low

Lokasi:

- `apps/frontend/src/hooks/app-controller/use-dashboard-group-records.ts`
- `apps/frontend/src/hooks/groups-backend-mapper.ts`
- `apps/frontend/src/shared/group-status-domain.ts`
- `apps/backend/src/groups/infrastructure/groups.listing.ts`

Detail:

Overview saat ini sengaja tidak memakai remote `activeOnly=true`; active filter diterapkan lokal agar month filter dan active filter tetap independen. Ini keputusan yang masuk akal. Namun backend tetap punya support `activeOnly`, dan backend mendefinisikan active dari stored `GroupTone.ACTIVE`. Frontend mapper dapat mengubah tone menjadi inactive berdasarkan itinerary yang seluruh jadwalnya sudah lewat.

Dampak:

- Overview saat ini relatif aman karena active filter lokal.
- Fitur lain atau refactor berikutnya bisa memakai `activeOnly=true` dan mendapatkan hasil berbeda dari Overview.
- Risiko regresi meningkat saat pagination/search dipindahkan ke backend.

Rekomendasi:

1. Jadikan definisi active sebagai kontrak domain eksplisit: stored lifecycle, current operational tone, atau derived itinerary status.
2. Jika active harus derived dari itinerary, backend perlu punya read model/derived field yang sama.
3. Jika active harus stored dari database, frontend mapper tidak boleh mengubah tone untuk filter utama tanpa field berbeda seperti `currentTone`.
4. Tambahkan test kontrak memory + Prisma + frontend mapper untuk group dengan itinerary lampau.

Prioritas fix: P2, tetapi perlu diselesaikan sebelum backend pagination/search Overview diperluas.

## Hal Yang Sudah Baik

- Overview memakai projection `summary` untuk halaman daftar, lalu fitur yang butuh detail akan meminta projection `detail`. Ini mengurangi payload awal.
- Month filter memakai travel range dari `arrivalDate`/`returnDate`, dengan fallback dari itinerary. Group lintas bulan tetap bisa muncul pada bulan yang overlap.
- Child group memang sengaja tidak ditampilkan sebagai card sendiri, dan parent-child pax sudah mulai diperhitungkan di card/statistik.
- `shouldUseRemoteOverviewActiveOnly = false` membuat month options tetap dibangun dari semua group, lalu active filter diterapkan lokal. Ini menghindari opsi bulan hilang hanya karena active-only aktif.
- API fetch groups sudah melalui client terpusat dan contract parser `parseBackendGroupRecordArray`.

## Rekomendasi Fix Bertahap

### P0 - Search linked groups

Target: data child yang match query tetap membuat parent terlihat di Overview.

Langkah aman:

1. Ubah source search Overview menjadi local full summary data saat `activeNav === "overview"`.
2. Pertahankan remote search untuk route lain jika memang dibutuhkan.
3. Tambah helper pure function untuk filtering Overview agar mudah dites.
4. Test minimal:
   - query parent code menampilkan parent;
   - query child code menampilkan parent;
   - query child name menampilkan parent;
   - query child + active only tidak menampilkan parent jika seluruh family inactive;
   - query child + month filter tetap menghormati travel range parent.

### P1 - Samakan makna pax card/statistik

Target: operator tidak melihat dua angka yang tampak bertentangan.

Langkah aman:

1. Putuskan label domain: `Linked Pax` atau `Active Pax`.
2. Jika `Linked Pax`, biarkan perhitungan card seperti sekarang tetapi label jangan hanya `Pax`.
3. Jika `Active Pax`, filter child sesuai tone saat active only aktif.
4. Tambah unit test group-card atau pure helper untuk linked pax.

### P2 - Kontrak active status

Target: frontend dan backend tidak punya dua definisi active yang berbeda.

Status eksekusi awal: kontrak minimal sudah dikunci tanpa schema/API migration.

Keputusan kontrak saat ini:

- `lifecycleStatus`: workflow state tersimpan dari backend (`ENTRY_ONLY`, `ACTIVE`, `INACTIVE`, `COMPLETED`, `ARCHIVED`).
- backend `activeOnly=true`: filter berdasarkan stored `GroupTone.ACTIVE`.
- frontend `tone`: current operational tone untuk UI Overview/card; value bisa berubah menjadi `inactive` saat seluruh itinerary yang valid sudah lewat.
- Overview `Active only`: memakai frontend operational `tone`, bukan backend `activeOnly=true`.

Langkah aman:

1. Selesai: dokumentasikan beda `lifecycleStatus`, backend stored `tone`, dan frontend operational `tone`.
2. Selesai: tambahkan regression test frontend mapper untuk itinerary yang sudah selesai.
3. Belum dilakukan: tambah field berbeda seperti `operationalTone` jika nanti API/frontend perlu membedakan dua konsep ini secara eksplisit.

## Suggested Test Cases

Frontend unit tests:

- `overview search shows parent when child code matches`
- `overview search shows parent when child name matches`
- `overview active-only excludes inactive linked child from active pax when configured`
- `overview month filter includes group when travel range overlaps selected month`
- `overview month filter excludes group when travel range is outside selected month`

Backend unit/integration tests:

- `GET /groups?q=<child-code>&projection=summary` behavior is explicitly defined.
- `activeOnly=true` behavior is documented against stored `GroupTone.ACTIVE`.
- Memory and Prisma search produce the same result for parent-child fixtures.

## Verifikasi Yang Sudah Dijalankan

Frontend:

```bash
npm run test:unit --workspace frontend -- --run src/unit/use-app-controller-backend.unit.test.ts src/unit/app-domain.unit.test.ts
```

Hasil: 14 test files passed, 61 tests passed.

Backend:

```bash
npm run test:unit --workspace backend -- --run src/groups/tests/groups.service.test.ts src/groups/tests/groups.service.prisma-crud.test.ts
```

Catatan: script backend menjalankan build dan seluruh rangkaian unit test backend, bukan hanya dua file yang diminta.

Hasil: seluruh rangkaian backend unit test yang dijalankan lulus.

## Status Audit

Status: report awal selesai.

Belum dilakukan:

- Tidak ada perubahan source code produksi.
- Belum ada regression test baru untuk `OVR-1`.
- Belum ada manual browser QA pada UI Overview.
- Belum ada audit visual/responsiveness Overview.

Next audit yang disarankan:

1. Implementasi test regression untuk `OVR-1`.
2. Fix search linked groups.
3. Audit fitur Visa Tracking setelah Overview, karena linked groups dan visa agreement saling beririsan.
