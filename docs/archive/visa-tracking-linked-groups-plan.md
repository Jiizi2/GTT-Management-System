# Visa Tracking Linked Groups Plan

Tanggal: 2026-06-20
Status: Implementasi selesai di branch `stabilization/backbone-phase-25`; menunggu review/PR

## Tujuan

Menata ulang perilaku linked group pada modul Visa Tracking agar UI konsisten dan mudah dipahami operator.

Keputusan produk utama:

- Visa Tracking table menampilkan linked groups sebagai accordion/grouped display.
- Visa Detail tetap per group aktif, bukan data gabungan parent-child.
- Copy to WhatsApp tetap mencakup semua group yang sedang ter-link.

## Prinsip Domain

1. Parent-child group hanya berarti sharing data operasional tertentu, terutama Musyrif dan Itinerary.
2. Data visa tetap milik masing-masing group.
3. Agreement hotel tetap milik masing-masing group.
4. Payment, visa status, syarikah, visa type, dan Raudhah tetap milik masing-masing group.
5. Copy WhatsApp adalah pengecualian: output harus family-aware karena dipakai untuk kebutuhan komunikasi operasional gabungan.

## Scope Behavior Final

### Visa Tracking Table

Linked group ditampilkan sebagai accordion, bukan row aggregate angka.

Aturan tampilan:

- Parent dan child berada dalam satu blok accordion.
- Tidak menambahkan icon baru apa pun untuk accordion/link state.
- Tidak ada indentasi visual antara parent dan child.
- Parent dan child harus sejajar secara visual.
- Pax tidak dijumlah pada table.
- Setiap group menampilkan pax masing-masing.
- Parent tanpa child tetap tampil sebagai row/card normal.
- Parent dengan child tampil sebagai accordion group.
- Child row/card di dalam accordion tetap punya action sendiri, termasuk View Details.

Contoh expected behavior:

- `G001` parent 40 pax.
- `G002` child 15 pax.
- Table tidak menampilkan 55 pax.
- Table menampilkan `G001` dengan 40 pax.
- Saat accordion dibuka, table menampilkan `G002` dengan 15 pax.
- `G002` tidak lebih masuk/indent daripada `G001`.

### Visa Detail

Visa Detail selalu mewakili satu group aktif.

Aturan tampilan dan data:

- Header menampilkan group aktif saja, bukan kode gabungan.
- Total pax di detail adalah pax group aktif saja.
- Agreement Makkah/Madinah yang tampil hanya agreement group aktif.
- Summary assigned/missing pax Makkah/Madinah hanya dihitung dari agreement group aktif.
- Payment status hanya group aktif.
- Visa status hanya group aktif.
- Syarikah hanya group aktif.
- Visa type hanya group aktif.
- Raudhah hanya group aktif.
- Completeness warning hanya group aktif.
- Linked group chip hanya berfungsi sebagai konteks dan navigasi.

Aturan action:

- Add agreement menarget group aktif.
- Edit agreement menarget group aktif.
- Delete agreement menarget group aktif.
- Assign agreement draft menarget group aktif.
- Unassign agreement draft menarget group aktif.
- Update payment/status/syarikah/visa type/Raudhah menarget group aktif.
- Delete group menarget group aktif.

### Linked Group Navigation Di Detail

Detail tetap boleh menampilkan daftar group yang terhubung.

Aturan:

- Linked groups tampil sebagai chip/list kecil untuk navigasi.
- Klik linked group berpindah ke konteks detail group tersebut.
- Setelah berpindah, semua data/action detail harus mengikuti group aktif baru.
- Tampilan ini tidak boleh menggabungkan pax, agreement, atau status antar group.

### Copy To WhatsApp

Copy WhatsApp tetap mencakup semua group yang ter-link.

Aturan:

- Jika group aktif punya linked family, output WhatsApp memuat seluruh group dalam family tersebut.
- Total pax dalam WhatsApp tetap dijumlah dari seluruh family.
- Copy WhatsApp dari parent atau child harus menghasilkan family yang sama selama link masih ada.
- Source itinerary untuk WhatsApp sebaiknya memakai operational parent/shared itinerary.
- Setelah unlink, group yang dilepas tidak lagi masuk output WhatsApp family.

Contoh expected output behavior:

- `G001` parent 40 pax dan `G002` child 15 pax masih linked.
- Copy dari detail `G001` mencantumkan `G001`, `G002`, dan total 55 pax.
- Copy dari detail `G002` juga mencantumkan `G001`, `G002`, dan total 55 pax.
- Setelah `G002` di-unlink, copy dari `G001` hanya memuat `G001`, dan copy dari `G002` hanya memuat `G002`.

### Unlink Group

Unlink group hanya memutus sharing operasional.

Aturan:

- Unlink mengubah `parentGroupId` menjadi `null`.
- Unlink tidak menghapus visa setup.
- Unlink tidak menghapus agreement hotel.
- Unlink tidak mengubah payment/status/syarikah/Raudhah.
- Copy modal harus jelas bahwa tindakan ini hanya memutus sharing Musyrif dan Itinerary.

## Area Kode Terkait

Frontend:

- `apps/frontend/src/pages/visa-tracking-page.tsx`
- `apps/frontend/src/pages/visa-detail-page.tsx`
- `apps/frontend/src/shared/group-visa-domain.ts`
- `apps/frontend/src/shared/visa-domain.ts`
- `apps/frontend/src/components/group-detail-modals.tsx`
- `apps/frontend/src/hooks/app-controller/use-dashboard-group-records.ts`

Backend:

- `apps/backend/src/groups/application/groups-command.service.ts`
- `apps/backend/src/groups/application/groups-query.service.ts`
- `apps/backend/src/groups/application/hotel-agreement-drafts.service.ts`
- `apps/backend/prisma/schema.prisma`

Catatan backend awal:

- Backend sudah menyimpan relasi parent-child melalui `parentGroupId`.
- Backend sudah menjaga beberapa invariant parent-child, seperti parent tidak boleh child dan group dengan child tidak boleh menjadi child.
- Perubahan utama kemungkinan berada di frontend presentation dan action targeting.

## Implementation Plan

### Phase 1 - Pisahkan Konsep Grouping Table Dan Detail

Tujuan:

- Menghilangkan penggunaan aggregate/family row sebagai sumber data Visa Detail.
- Mempertahankan family grouping hanya sebagai metadata relasi.

Langkah:

1. Audit `VisaTrackingDetailScreen`.
2. Hapus atau nonaktifkan logika `mergedFamilyRow` dari detail.
3. Pastikan `row` detail selalu berasal dari `activeGroupCode`.
4. Pastikan `group` detail selalu berasal dari `activeGroupCode`.
5. Pertahankan `familyGroups` untuk linked chips dan copy WhatsApp.

Acceptance:

- Detail parent menampilkan data parent saja.
- Detail child menampilkan data child saja.
- Klik chip child benar-benar mengganti konteks detail ke child.

### Phase 2 - Table Accordion Grouped Display

Tujuan:

- Table tetap mengelompokkan linked groups, tetapi tidak menjumlahkan pax.

Langkah:

1. Buat helper untuk membentuk grouped rows dari list group/visa row.
2. Parent tanpa child dirender sebagai row/card normal.
3. Parent dengan child dirender sebagai accordion group.
4. Parent dan child memakai layout row/card yang sama.
5. Jangan tambahkan icon baru.
6. Jangan beri indentasi pada child.
7. Pax column/card selalu memakai pax group masing-masing.
8. View Details parent membuka parent detail.
9. View Details child membuka child detail.

Acceptance:

- Linked parent-child tampil dalam satu accordion block.
- Pax parent dan child tidak dijumlah.
- Child tidak terindent.
- Tidak ada icon tambahan untuk accordion/link state.

### Phase 3 - Action Targeting Per Group Aktif

Tujuan:

- Semua mutasi dari Visa Detail tepat menarget group aktif.

Langkah:

1. Audit semua handler di Visa Detail.
2. Gunakan `activeGroupCode` atau `activeRow.groupCode` untuk mutasi.
3. Hindari penggunaan parent/family row untuk target mutasi.
4. Pastikan add/edit/delete agreement memakai group aktif.
5. Pastikan assign/unassign agreement draft memakai group aktif.
6. Pastikan payment/status/syarikah/visa type/Raudhah memakai group aktif.

Acceptance:

- Update payment child tidak mengubah parent.
- Assign agreement draft di child tidak masuk ke parent.
- Delete agreement child tidak menghapus agreement parent.

### Phase 4 - Copy WhatsApp Family-Aware

Tujuan:

- Copy WhatsApp tetap memasukkan semua linked group meskipun detail per group.

Langkah:

1. Pertahankan resolver `familyGroups`.
2. Pastikan `handleCopyWhatsapp` menerima family lengkap.
3. Tentukan operational source group untuk itinerary, idealnya parent bila tersedia.
4. Pastikan total pax WhatsApp tetap menjumlahkan seluruh family.
5. Pastikan unlink mengubah family yang dipakai copy.

Acceptance:

- Copy dari parent dan child menghasilkan family output yang sama ketika linked.
- Copy setelah unlink hanya memuat group mandiri masing-masing.

### Phase 5 - Copy Dan UX Unlink

Tujuan:

- Mengurangi ambiguitas bahwa unlink hanya memutus sharing operasional.

Langkah:

1. Update copy modal unlink.
2. Sebutkan eksplisit sharing Musyrif dan Itinerary.
3. Hindari copy yang mengesankan agreement/visa ikut dilepas.
4. Setelah unlink, table tidak lagi menempatkan child dalam accordion parent.

Acceptance:

- Operator memahami unlink tidak menghapus data visa/agreement.
- Linked display berubah sesuai relasi terbaru.

### Phase 6 - Regression Tests

Tujuan:

- Mengunci behavior agar tidak kembali merge di detail.

Skenario minimal:

1. Parent `G001` pax 40, child `G002` pax 15.
2. Visa Tracking table menampilkan grouped accordion, bukan total 55 pax.
3. Detail `G001` menampilkan 40 pax dan agreement `G001` saja.
4. Detail `G002` menampilkan 15 pax dan agreement `G002` saja.
5. Payment update di `G002` tidak mengubah `G001`.
6. Copy WhatsApp dari `G001` dan `G002` memuat family dan total 55 pax.
7. Unlink `G002` membuat table tidak lagi mengelompokkan `G001` dan `G002`.
8. Copy WhatsApp setelah unlink tidak lagi menggabungkan `G001` dan `G002`.

Target test:

- Unit/domain test untuk grouping helper dan WhatsApp copy.
- E2E atau component-level test untuk Visa Tracking table dan Visa Detail action targeting.

## Non-Goals

- Tidak mengubah model database parent-child kecuali ditemukan blocker.
- Tidak menggabungkan visa setup parent-child di backend.
- Tidak membuat total pax family sebagai metric utama di table.
- Tidak mengubah agreement ownership menjadi family-level.
- Tidak menghapus kemampuan copy WhatsApp family-aware.

## Open Questions

1. Accordion default untuk linked group di table apakah collapsed atau expanded?
2. Jika parent memiliki banyak child, apakah semua child tetap tampil dalam satu accordion tanpa pagination lokal?
3. Untuk Copy WhatsApp, jika parent itinerary kosong tetapi child punya itinerary lokal, apakah fallback ke child aktif atau tetap kosong?
4. Apakah unlink dari parent view boleh langsung melepas child, atau hanya child yang sedang aktif boleh unlink dirinya?

## Final Acceptance Criteria

Dengan data:

- Parent `G001`, 40 pax, agreement Makkah/Madinah milik `G001`.
- Child `G002`, 15 pax, agreement Makkah/Madinah milik `G002`.
- `G002.parentGroupId = G001.id`.

Maka:

- Visa Tracking table mengelompokkan `G001` dan `G002` dalam accordion.
- Table tidak menampilkan 55 pax.
- `G001` tetap menampilkan 40 pax.
- `G002` tetap menampilkan 15 pax.
- `G002` tidak terindent dari `G001`.
- Tidak ada icon tambahan untuk accordion/link state.
- Detail `G001` hanya menampilkan data visa/agreement `G001`.
- Detail `G002` hanya menampilkan data visa/agreement `G002`.
- Copy WhatsApp dari `G001` atau `G002` tetap memuat `G001`, `G002`, dan total 55 pax.
- Setelah unlink `G002`, table menampilkan `G001` dan `G002` sebagai group terpisah.
- Setelah unlink, Copy WhatsApp tidak lagi menggabungkan `G001` dan `G002`.
