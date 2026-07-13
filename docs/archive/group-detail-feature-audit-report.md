# Group Detail Feature Audit Report

Tanggal audit: 2026-06-20
Cakupan: fitur Group Detail, dari route frontend `/groups/:code` sampai backend group detail/replace/delete logic.

## Ringkasan

Audit ini memeriksa fitur Group Detail secara end-to-end:

- Route dan data selection untuk `/groups/:code`.
- UI Group Detail, termasuk itinerary, notes, musyrif, edit identity, unlink child, delete group, export PDF, dan quick action.
- Controller frontend `useDashboardGroupRecords` untuk selected group, optimistic update, delete, dan save.
- Payload mapper frontend untuk PUT full group payload.
- Backend `GET /groups/:idOrCode`, `PUT /groups/:idOrCode`, `PATCH /groups/:idOrCode`, dan `DELETE /groups/:idOrCode`.
- Parent-child group inheritance untuk child detail.

Kesimpulan utama: Group Detail sudah cukup kaya dan secara backend punya guard parent-child yang baik untuk mutation itinerary/checklist. Namun ada satu bug aktif di frontend: child group detail memakai data dari list endpoint, bukan `GET /groups/:code`, sehingga inheritance parent untuk itinerary/musyrif tidak selalu diterapkan. Bug ini sudah diperbaiki pada audit ini dengan view-model inheritance di frontend dan regression test.

## Execution Update - 2026-06-20

Status setelah eksekusi awal:

- GD-1 selesai: child group detail sekarang mewarisi field operasional parent di frontend (`musyrif`, `nextActivity`, `timeline`, `itinerary`, `notes`, dan `checklistAssignments`) sambil tetap mempertahankan identitas/visa/pax child.
- GD-1 regression test ditambahkan di `apps/frontend/src/unit/group-detail-selection.unit.test.ts`.
- GD-2 selesai: local state Group Detail sekarang resync saat `group` prop berubah, sehingga rollback/refetch backend tidak meninggalkan UI detail pada state lama.
- GD-3 selesai: backend memory/Prisma sekarang menolak delete parent yang masih punya child, dan frontend delete modal menampilkan warning serta menonaktifkan tombol delete untuk parent yang masih memiliki linked child group.
- GD-4 partially fixed: edit identity Group Detail dan unlink child sekarang memakai `PATCH /groups/:idOrCode`, bukan `PUT` full replace. Itinerary, notes, dan musyrif masih memakai full replace dan perlu refactor lanjutan.
- Audit menemukan risiko lanjutan yang belum diubah penuh: full PUT replace untuk itinerary/notes/musyrif dan notes pinned yang belum persisten.

Verifikasi terbaru:

```bash
npm run test:unit --workspace frontend -- --run src/unit/group-detail-selection.unit.test.ts src/unit/overview-filter.unit.test.ts src/unit/use-app-controller-backend.unit.test.ts
npm run check --workspace frontend
```

Hasil: 16 test files passed, 67 tests passed. Frontend type-check lulus.

Verifikasi tambahan P1 delete guard:

```bash
npm run test:unit --workspace backend
npm run check --workspace frontend
npm run test:unit --workspace frontend -- --run src/unit/group-detail-selection.unit.test.ts src/unit/overview-filter.unit.test.ts
```

Hasil: backend full unit suite lulus, frontend type-check lulus, frontend targeted unit test lulus.

Verifikasi tambahan P2 identity/unlink patch:

```bash
npm run check --workspace frontend
npm run test:unit --workspace frontend -- --run src/unit/group-detail-selection.unit.test.ts src/unit/overview-filter.unit.test.ts src/unit/use-app-controller-backend.unit.test.ts
```

Hasil: frontend type-check lulus, 16 test files passed, 68 tests passed.

## Alur Data Group Detail

1. Route `/groups/:groupCode` dibaca oleh `useDashboardRouteState`.
2. Karena ada `selectedGroupCode`, `useDashboardGroupRecords` meminta projection `detail` lewat `GET /api/groups?projection=detail`.
3. `selectedGroup` dipilih dari `visibleGroupRecords` berdasarkan `code`.
4. Jika selected group adalah child, frontend sekarang membangun view-model detail dengan field operasional dari parent.
5. `AppMainContent` mengirim `selectedGroup`, `groupRecords`, `handleDeleteGroup`, dan `handleSaveGroupDetail` ke `GroupDetail`.
6. `GroupDetail` menyimpan local UI state untuk itinerary, notes, dan musyrif, lalu menyimpan perubahan via `onSaveGroup`.
7. `handleSaveGroupDetail` melakukan optimistic commit lokal lalu memanggil `replaceGroupInBackend` (`PUT /groups/:idOrCode`) dengan full payload.
8. Backend `replaceWithPrisma` menghapus dan membuat ulang beberapa child records (`itinerary`, `timeline`, `notes`, `musyrif`, `visaSetup`, `checklistAssignments`) melalui `buildGroupReplaceData`.
9. Jika backend gagal, controller frontend mencoba restore dari backend/rollback snapshot.

Referensi utama:

- `apps/frontend/src/components/app-main-content.tsx`
- `apps/frontend/src/pages/group-detail-page.tsx`
- `apps/frontend/src/components/group-detail-modals.tsx`
- `apps/frontend/src/hooks/app-controller/use-dashboard-group-records.ts`
- `apps/frontend/src/hooks/groups-backend-api.ts`
- `apps/frontend/src/hooks/groups-backend-payload.ts`
- `apps/backend/src/groups/http/groups.controller.ts`
- `apps/backend/src/groups/application/groups-query.service.ts`
- `apps/backend/src/groups/application/groups-command.service.ts`
- `apps/backend/src/groups/infrastructure/groups.prisma-write-builders.ts`

## Temuan

### GD-1 - Child Group Detail tidak selalu mewarisi itinerary/musyrif parent

Severity: High

Status: Fixed pada audit ini.

Lokasi:

- `apps/frontend/src/hooks/app-controller/use-dashboard-group-records.ts`
- `apps/frontend/src/pages/group-detail-page.tsx`
- `apps/backend/src/groups/application/groups-query.service.ts`

Detail:

Backend `findOneWithPrisma` menerapkan inheritance parent untuk child group pada `GET /groups/:idOrCode`. Tetapi halaman Group Detail frontend tidak memakai endpoint single group. Halaman ini memilih `selectedGroup` dari hasil `GET /groups?projection=detail`. List endpoint tidak menerapkan inheritance parent. Akibatnya child group detail bisa menampilkan itinerary/notes/musyrif kosong atau milik child sendiri, sementara UI memberi pesan bahwa data operasional diwarisi dari parent.

Dampak:

- Operator membuka detail child group dan tidak melihat itinerary bersama dari parent.
- Tombol/edit guard child sudah disembunyikan, tetapi data yang ditampilkan bisa tidak sesuai pesan UI.
- Export PDF child bisa memakai itinerary kosong jika local state berasal dari child raw record.

Fix yang diterapkan:

- Tambah helper `resolveGroupDetailRecord(group, allGroups)` di `use-dashboard-group-records.ts`.
- Jika selected group punya `parentGroupId`, helper mengambil `musyrif`, `nextActivity`, `timeline`, `itinerary`, `notes`, dan `checklistAssignments` dari parent.
- Identitas child seperti `code`, `name`, `pax`, `packageName`, `visaSetup`, dan `parentGroupId` tetap milik child.
- Tambah regression test `group-detail-selection.unit.test.ts`.

### GD-2 - Local state Group Detail bisa stale setelah rollback/refetch

Severity: Medium

Status: Fixed pada audit ini.

Lokasi:

- `apps/frontend/src/pages/group-detail-page.tsx`
- `apps/frontend/src/hooks/app-controller/use-dashboard-group-records.ts`

Detail:

`GroupDetail` menginisialisasi `itineraryItems`, `noteItems`, dan `musyrifProfile` dari props hanya saat mount. Save dilakukan optimistic melalui parent controller. Jika backend gagal dan parent controller rollback/refetch group records, local state di halaman detail bisa tetap menampilkan data optimistic yang sudah gagal tersimpan.

Dampak:

- User melihat perubahan itinerary/note/musyrif seolah tersimpan, padahal backend menolak.
- Setelah navigasi/refresh, data kembali berubah sehingga terasa seperti data hilang.

Fix yang diterapkan:

- Tambah effect untuk sync `itineraryItems`, `noteItems`, dan `musyrifProfile` saat props `group` berubah.
- Sync notes mempertahankan `pinned` lokal berdasarkan text agar UI tidak flicker kehilangan pin selama sesi berjalan.

### GD-3 - Delete parent group dengan child berpotensi membuat child orphan/standalone

Severity: Medium

Status: Fixed pada eksekusi P1.

Lokasi:

- `apps/frontend/src/hooks/app-controller/use-dashboard-group-records.ts`
- `apps/backend/prisma/schema.prisma`
- `apps/backend/src/groups/application/groups-command.service.ts`

Detail:

Frontend delete group melakukan optimistic removal hanya untuk group yang dipilih. Backend schema self-relation parent-child memakai `onDelete: SetNull`, sehingga menghapus parent group akan membuat child kehilangan parent dan menjadi standalone. Tidak terlihat ada confirm khusus yang menjelaskan dampak ini pada parent dengan child.

Dampak:

- Operator bisa menghapus parent tanpa sadar bahwa child akan berubah menjadi standalone.
- Setelah backend refetch, child yang sebelumnya tersembunyi/terkait bisa muncul sebagai group independen.
- Jika child mengandalkan operational inheritance, data detailnya bisa berubah drastis.

Fix yang diterapkan:

1. Backend `removeWithPrisma` mengecek child count dan melempar `ConflictException` jika parent masih punya child.
2. Memory store `removeFromMemory` melakukan guard setara dengan pengecekan `parentGroupId` terhadap parent id/code.
3. Frontend `DeleteGroupModal` menerima `childGroupCount`, menampilkan warning, dan menonaktifkan tombol delete jika child masih ada.
4. Regression test ditambahkan untuk memory parent-child flow dan Prisma remove guard.

Prioritas: P1.

### GD-4 - Group Detail memakai PUT full replace untuk banyak perubahan kecil

Severity: Medium

Status: Partially fixed pada eksekusi P2 awal.

Lokasi:

- `apps/frontend/src/pages/group-detail-page.tsx`
- `apps/frontend/src/hooks/app-controller/use-dashboard-group-records.ts`
- `apps/frontend/src/hooks/groups-backend-api.ts`
- `apps/backend/src/groups/application/groups-command.service.ts`

Detail:

Sebelum eksekusi P2 awal, perubahan kecil seperti tambah note, edit musyrif, tambah itinerary, edit identity, dan unlink child semuanya masuk ke `replaceGroupInBackend`, yaitu `PUT /groups/:idOrCode` dengan full group payload. Backend `replaceWithPrisma` menghapus dan membuat ulang banyak child records: checklist assignments, itinerary, timeline, notes, next activity, musyrif, dan visa setup.

Dampak:

- Blast radius masih tinggi untuk itinerary, notes, dan musyrif.
- ID child records masih dapat berubah setelah replace untuk flow yang belum dipindah.
- Risiko kehilangan data meningkat jika frontend payload tidak membawa seluruh nested state terbaru pada flow yang masih memakai PUT.
- Checklist relink sudah punya logic khusus, tetapi flow tetap lebih besar dari kebutuhan edit kecil.

Fix yang sudah diterapkan:

1. Tambah callback `handlePatchGroupDetail` di controller frontend.
2. `GroupDetail` sekarang menerima `onPatchGroup` khusus untuk perubahan ringan.
3. Modal edit identity memakai `PATCH /groups/:idOrCode` lewat `updateGroupInBackend`.
4. Unlink child group juga memakai `PATCH` dengan `parentGroupId: null`.
5. Regression test API memastikan `updateGroupInBackend` memakai method `PATCH` dan tidak mengirim nested `itinerary`, `notes`, atau `musyrif`.

Catatan eksekusi lanjutan:

- Endpoint granular itinerary sudah tersedia di backend (`POST/PATCH/DELETE /groups/:idOrCode/itinerary`).
- Namun tipe frontend `ItineraryItem` dan mapper `mapBackendGroupToFrontend` belum membawa `id`/`sortOrder` backend ke UI Group Detail.
- Karena edit/delete itinerary di UI saat ini berbasis index, migrasi itinerary granular perlu dimulai dengan mengalirkan `id` itinerary backend ke domain frontend. Tanpa itu, update/delete harus menebak item berdasarkan index/judul dan rawan salah saat itinerary berubah urutan.

Rekomendasi:

1. Untuk itinerary, gunakan endpoint granular yang sudah ada: `POST/PATCH/DELETE /groups/:id/itinerary`.
2. Selesai: untuk identity edit dan unlink child, gunakan `PATCH /groups/:idOrCode`.
3. Untuk notes dan musyrif, pertimbangkan endpoint granular atau patch field sederhana.
4. Kurangi penggunaan `PUT replace` untuk action UI yang kecil.

Prioritas: P2, karena membutuhkan refactor workflow dan test lebih luas.

### GD-5 - Notes `pinned` hanya local UI state, tidak persisten

Severity: Low/Medium

Status: Open.

Lokasi:

- `apps/frontend/src/pages/group-detail-page.tsx`
- `apps/frontend/src/components/group-detail-modals.tsx`
- `apps/frontend/src/hooks/groups-backend-payload.ts`
- `apps/backend/src/groups/dto/create-group.dto.ts`

Detail:

Note modal punya opsi `pinned`, dan UI `NoteItem` juga punya field `pinned`. Namun domain `GroupData.notes` hanya `string[]`, dan payload mapper mengirim note dengan `pinned: false`. Artinya pinned note tidak benar-benar tersimpan ke backend.

Dampak:

- User bisa mengira pin tersimpan, tetapi setelah refresh/refetch pin hilang.
- Sync props sekarang mempertahankan pin selama sesi lokal berdasarkan text, tetapi ini bukan persistensi permanen.

Rekomendasi:

1. Ubah `GroupData.notes` menjadi `NoteItem[]` atau tambahkan field note structured di domain frontend.
2. Pastikan backend DTO dan Prisma `GroupNote.pinned` dipakai dari payload.
3. Tambahkan test create/update note pinned.

Prioritas: P2/P3.

## Hal Yang Sudah Baik

- Backend punya guard supaya child group tidak bisa mengedit itinerary/checklist langsung; operasi tersebut diarahkan ke parent.
- Backend validasi parent link sudah mencegah self-parent, grandchild, dan parent yang sudah punya child menjadi child.
- Group Detail UI sudah menyembunyikan action edit itinerary/note untuk child group.
- Full replace backend punya logic relink checklist assignment ke itinerary baru berdasarkan identity/sort order.
- Frontend save detail sudah melakukan optimistic rollback snapshot jika backend gagal.
- Export PDF memakai escaping HTML dan fallback popup handling.

## Rekomendasi Fix Bertahap

### P0 - Child detail inheritance

Status: selesai.

Test yang sudah ada:

- `child detail inherits parent operational fields`
- `standalone detail returns the same record`

### P1 - Delete parent with child guard

Status: selesai.

Target: parent tidak bisa dihapus tanpa keputusan eksplisit terhadap child groups.

Langkah aman:

1. Selesai: backend `removeWithPrisma` cek child count sebelum delete.
2. Selesai: jika child count > 0, return `ConflictException` dengan pesan jelas.
3. Selesai: frontend delete modal tampilkan pesan khusus ketika group punya child dan tombol delete disabled.
4. Selesai: regression test backend memory + Prisma ditambahkan.

### P2 - Kurangi full replace untuk edit kecil

Target: action kecil di Group Detail memakai endpoint yang blast radius-nya kecil.

Langkah aman:

1. Selesai: mulai dari identity modal dan unlink child, gunakan `PATCH /groups/:idOrCode` untuk code/name/pax/date/parent.
2. Prasyarat itinerary: tambahkan `id`/`sortOrder` backend ke `ItineraryItem` frontend dan mapper.
3. Lanjut itinerary add/edit/delete: gunakan endpoint granular yang sudah ada.
4. Tambah query invalidation detail/list yang lebih spesifik.
5. Setelah stabil, note/musyrif bisa dipisah ke endpoint patch khusus.

### P3 - Persist pinned notes

Target: pinned note tidak hilang setelah refresh/refetch.

Langkah aman:

1. Ubah frontend `GroupData.notes` dari string array menjadi structured notes, atau tambah `noteItems` terpisah.
2. Mapper backend frontend membaca/menulis `pinned` dari `GroupNote`.
3. Update export/detail UI memakai structured note.

## Suggested Test Cases

Frontend unit tests:

- `child detail inherits parent itinerary and musyrif but keeps child visa setup`
- `selected group detail resyncs local itinerary after parent group prop changes` (component test jika test environment DOM tersedia)
- `pinned note survives local prop sync during same session`
- `delete modal shows linked child warning when group has children`

Backend unit/integration tests:

- `DELETE parent group with child is rejected` jika guard dipilih.
- `DELETE child group succeeds without affecting parent`.
- `PATCH identity preserves itinerary and visa setup`.
- `PUT replace preserves checklist assignment identity after itinerary reorder` (sebagian sudah ada).

## Status Audit

Status: audit awal selesai, P1 selesai, dan P2 tahap identity/unlink selesai.

Belum dilakukan:

- Belum ada migrasi/domain change untuk persistent pinned notes.
- Belum ada refactor itinerary/notes/musyrif dari PUT full replace ke endpoint granular.
- Belum ada manual browser QA untuk Group Detail responsive/interaction.

Next audit yang disarankan:

1. Lanjutkan P2 itinerary granular endpoint dengan prasyarat alirkan `id`/`sortOrder` itinerary backend ke frontend.
2. Audit Visa Detail, karena banyak pattern parent-child dan save group dipakai ulang di halaman Visa Detail.
3. Setelah Group Detail dan Visa Detail stabil, audit Agreement Inbox karena linked agreement source draft berdampak ke dua halaman itu.
