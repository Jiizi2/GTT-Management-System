# Penyelarasan fitur Admin dan Portal Agent

Tanggal: 2 Oktober 2026\
Baseline pemeriksaan: checkout lokal `4d5827f`, branch `fix/itinerary-builder-desktop-layout`\
Status: rencana awal telah dieksekusi secara lokal; lihat [catatan implementasi 3 Oktober 2026](agent-portal-parity-implementation-20261003.md) untuk hasil, validasi, dan batasnya. Isi di bawah dipertahankan sebagai riwayat perencanaan; belum ada verifikasi production.

## Tujuan dan keputusan pengguna

Portal Agent perlu menerapkan konsep operasional yang sudah dibangun di Admin: parent–child group, perjalanan bersama, dan Agreement Inbox. Keberhasilan bukan hanya tersedianya halaman, melainkan Agent membaca struktur perjalanan dan status yang konsisten dengan Admin.

Keputusan yang sudah diberikan pengguna:

- Terapkan konsep parent–child group di Portal Agent.
- Tambahkan Agreement Inbox milik Agent.
- Agent boleh melihat, mengirim, dan mengubah draft agreement miliknya.
- Assignment agreement ke group tetap dilakukan Admin.
- Periksa fitur Admin lainnya yang layak dibagikan.

Rencana ini memperluas batas frontend-only/read-only pada roadmap September. Parent–child membutuhkan perubahan proyeksi API; pengiriman dan perubahan draft membutuhkan endpoint write khusus Agent. Perluasan tersebut tetap memakai domain dan model yang ada. Hak membuat atau mengubah relasi parent–child, approval agreement, serta fitur tambahan belum diminta secara eksplisit; rekomendasi awal menempatkan tindakan operasional tersebut pada Admin.

## Temuan pada implementasi sekarang

| Area | Bukti di kode | Dampak pada Portal Agent |
| --- | --- | --- |
| Relasi group | Schema `Group` memiliki `parentGroupId`/`childGroups`. Validasi Admin mewajibkan parent dan child berasal dari Agent yang sama. | Model tersedia; tidak perlu menciptakan entitas perjalanan baru untuk tahap ini. |
| Pewarisan operasional | Detail Admin mewariskan musyrif, next activity, timeline, itinerary, notes, dan checklist dari parent. | Service baca Agent mengambil data group langsung dan belum menerapkan pewarisan tersebut. Child dapat terlihat tanpa itinerary/checklist yang sebenarnya tersedia pada parent. |
| Daftar perjalanan | Overview Admin menyembunyikan child sebagai kartu utama, tetapi pencarian child dapat menemukan parent. Kartu/detail menghitung pax keluarga group. | Kontrak `GroupSummary` Agent dan mapper tidak membawa `parentGroupId`; daftar Agent masih memperlakukan group sebagai record terpisah. |
| Visa Tracking | Admin membentuk `mainRow` dan `followerRows`; visa dan hotel tetap berasal dari masing-masing group. | Daftar Agent belum memiliki struktur parent–child. |
| Agreement Inbox | Draft mempunyai `agentId`, approval, periode menginap, kapasitas, dan relasi alokasi melalui `sourceDraftId`. | Agent baru menerima hotel agreement yang sudah terhubung ke group, bukan seluruh draft miliknya. |
| Pengelolaan draft | Endpoint Admin mendukung create/update/assign/unassign. Update juga memperbarui hotel agreement yang sudah terhubung. | Menampilkan form Admin langsung pada Agent akan memberikan kontrol dan dampak perubahan yang terlalu luas. |
| Masa approval | `findAll` Prisma dapat mengubah WAITING menjadi REJECTED setelah 24 jam berdasarkan `updatedAt`; assignment juga menangani expiry. | Pembacaan inbox bukan operasi murni. Aturan ini harus dipertahankan atau diubah secara sengaja, dengan perilaku jelas setelah revisi. |
| Raudhah | Appointment dan `tasrehPrinted` tersedia pada VisaSetup Admin. Mapper Agent mengisi `raudhahAppointments: []`. | Data nyata belum disalurkan ke Portal Agent. |
| Transportasi | API Agent hanya menampilkan jumlah driver assigned/verified. UI detail masih menampilkan `—` untuk nama, plat, dan telepon. | Bagian tersebut belum memberikan rincian operasional yang sudah tersedia di Admin. |
| Penerbangan | Admin mempunyai flight legs dan informasi penerbangan VisaSetup. Agent menerima sebagian informasi lewat itinerary. | Rincian penerbangan/transit dan ketersediaan data belum setara. |
| Invoice | Endpoint Agent list/detail sudah tersedia, tetapi proyeksinya hanya nomor, status, tanggal, dan group. | UI Agent belum tersedia; API saat ini belum mendukung rincian nominal atau PDF invoice penuh. |

Catatan: temuan di atas berasal dari pembacaan source, bukan hasil menjalankan portal atau database production. Catatan keberhasilan N1–N3 September menunjukkan penyelesaian slice UI saat itu, bukan bukti kesetaraan fitur Admin–Agent sekarang.

## Peta fitur yang layak dibagikan

| Fitur | Perilaku yang disarankan untuk Agent | Kebutuhan utama | Urutan |
| --- | --- | --- | --- |
| Parent–child di Perjalanan | Lihat parent dan child, pax per group dan total keluarga, buka detail, cari kode/nama child. | Kontrak relasi, pewarisan terotorisasi, pencarian dan pagination keluarga group. | 1 |
| Parent–child di Visa Tracking | Parent dengan child yang dapat dibuka; status visa/hotel masing-masing tetap terlihat. | Proyeksi keluarga dan pemetaan status yang sama dengan Admin. | 1 |
| Dashboard sesuai struktur group | Bedakan jumlah perjalanan induk, jumlah seluruh group, dan total jamaah. | Agregasi server yang konsisten dengan daftar. | 1 |
| Agreement Inbox | Lihat/cari/filter draft sendiri, kirim draft, revisi draft yang memenuhi aturan edit, lihat alokasi oleh Admin. | API baca/tulis Agent dan kebijakan revisi. | 2 |
| Preview dan PDF itinerary | Preview/unduh itinerary yang sama dengan Admin, termasuk konteks parent–child yang diizinkan. | Komponen/formatter bersama dan payload ekspor untuk Agent. | 3 |
| Raudhah dan tasreh | Lihat jadwal, status appointment, dan status tasreh; salin ringkasan jika berguna. | Tambahkan data yang ada ke proyeksi Agent. | 3 |
| Penerbangan dan transit | Lihat segmen, bandara, nomor flight, serta waktu keberangkatan/kedatangan yang tercatat. | Proyeksi flight legs dan presentasi bersama. | 3 |
| Armada dan driver | Lihat jadwal, kesiapan, serta rincian driver yang disetujui untuk dibagikan. | Proyeksi driver untuk perjalanan milik Agent; assignment/verifikasi tetap Admin. | 3 |
| Kelengkapan visa/hotel | Gunakan status, periode hotel, pax, dan pengecualian hotel yang sama dengan Admin. | Proyeksi waiver hotel dan aturan kelengkapan bersama; nilai null tetap berarti belum tercatat. | 3 |
| Invoice milik Agent | Lihat daftar dan status tagihan; rincian nominal/PDF sebagai perluasan tersendiri jika dibutuhkan. | UI untuk API minimal yang ada; kontrak finansial tambahan untuk detail penuh. | Opsional setelah 3 |
| Statistik Agent sendiri | Tren keberangkatan, jamaah, dan visa miliknya. | Endpoint Agent scoped; endpoint analytics internal menerima filter Agent dan tidak boleh dibuka langsung. | Opsional setelah 3 |

User Management, Master Data, pengelolaan Agent lain, assignment driver, approval agreement, linking/unlinking group, dan perubahan status operasional tetap berada di Admin pada usulan awal. Fitur upload file agreement belum diasumsikan: model draft saat ini menyimpan metadata, bukan lampiran file.

## Tahap 1 — Penyelarasan parent–child

### Aturan domain

- Satu keluarga terdiri dari parent dan child langsung, mengikuti aturan Admin yang sudah ada.
- Parent dan seluruh child yang ditampilkan harus terverifikasi milik Agent dari sesi. Relasi pada data legacy tidak boleh melewati pemeriksaan kepemilikan.
- Identitas, pax, lifecycle, visa, dan hotel tetap milik masing-masing group. Jangan mewariskan visa/hotel parent ke child sebagai status child.
- Itinerary, timeline, next activity, musyrif, dan checklist child mengikuti parent sebagaimana di Admin. Notes hanya dibagikan sesuai kebijakan konten untuk Agent; sumber sekarang tidak mempunyai penanda visibility pada `GroupNote`.
- Transportasi bersama tampil sekali pada ringkasan perjalanan keluarga. Child yang dibuka langsung tetap menampilkan informasi bersama beserta asal parent-nya.
- Parent tanpa child, child tanpa parent yang dapat diakses, data kosong, dan group mandiri mempunyai tampilan yang jujur; data yang hilang tidak diisi seolah selesai.

### Kontrak dan alur

1. Tambahkan informasi relasi dan ringkasan keluarga ke proyeksi Agent, dengan perubahan additive pada field yang sudah dikonsumsi.
2. Kerjakan pengelompokan/pagination pada kumpulan keluarga yang lengkap di server atau melalui mode query keluarga yang eksplisit. Jangan menyembunyikan child dari satu halaman hasil pagination biasa: parent bisa berada pada halaman lain dan total hasil menjadi salah.
3. Pencarian child mengembalikan keluarga yang cocok dengan konteks child. Filter lifecycle/visa menunjukkan record yang cocok tanpa mengubah status anggota lain.
4. Perjalanan menampilkan satu kartu/row utama per parent, child di dalamnya, dan tautan detail masing-masing. Visa Tracking memakai struktur keluarga yang sama dengan status tiap group.
5. Dashboard membedakan `jumlah perjalanan`, `jumlah group`, dan `total jamaah`. Pertahankan makna counter API lama; tambahkan counter perjalanan jika diperlukan, jangan mengubah diam-diam `groups.total`.
6. Total pax keluarga mengikuti penjumlahan pax tiap record seperti Admin sekarang; uji dengan fixture parent 20 pax + child 10 pax = 30 pax, tanpa menjumlahkan ulang nilai total keluarga.

### Bukti penerimaan

- Parent dengan dua child terlihat sebagai satu perjalanan dan tiga group.
- Child menampilkan itinerary/musyrif/checklist parent, tetapi visa/hotelnya sendiri.
- Pencarian kode child menemukan parent; hasil tetap benar di batas pagination dan saat kembali dari detail.
- Keluarga yang tidak dimiliki tidak dapat dibaca lewat list, detail, facet, atau direct URL.
- Dashboard, Perjalanan, Visa Tracking, H-1, dan ekspor tidak menghitung transportasi bersama berulang kali.
- Perubahan Admin pada itinerary atau relasi terlihat pada Agent setelah refresh/invalidation, tanpa salinan data baru.

## Tahap 2 — Agreement Inbox kolaboratif

### Alur dan hak akses

Agent membuat draft miliknya → draft terlihat pada inbox Admin → Admin mengelola approval/alokasi → Agent melihat status dan group hasil assignment.

Agent dapat mengisi kota, hotel, nomor agreement, nama group referensi, pax, periode menginap, dan catatan yang memang ditujukan untuk dibagikan. Agent tidak memilih Agent lain, mengubah approval, atau melakukan assign/unassign.

Usulan kebijakan awal: draft baru/pengajuan ulang berstatus WAITING dari server. Draft REJECTED yang belum dialokasikan dapat direvisi dan diajukan ulang. Untuk draft APPROVED atau yang sudah dialokasikan, perubahan material perlu aturan khusus sebelum endpoint edit dirilis. Pilihan yang paling kecil lingkupnya adalah Admin melepas alokasi terlebih dahulu sebelum Agent merevisi; alur permintaan revisi dengan histori merupakan perluasan berbeda. Kebijakan edit ini masih usulan, bukan keputusan pengguna.

### Kebutuhan implementasi

- Tambahkan route frontend `/agent/agreement-inbox` dan item Agreement Inbox sebagai tujuan utama keempat. Pertahankan navigasi mobile berlabel dan akses Profile sebagai utilitas.
- Tambahkan endpoint khusus, misalnya `GET /api/agent/agreement-drafts`, `GET /api/agent/agreement-drafts/:id`, `POST /api/agent/agreement-drafts`, dan `PATCH /api/agent/agreement-drafts/:id`.
- Semua kepemilikan berasal dari principal sesi. DTO Agent tidak menerima `agentId`, approval `status`, atau parameter assignment; pemeriksaan backend berlaku juga untuk request langsung.
- Update memeriksa kepemilikan, keadaan draft, dan alokasi dalam operasi transaksi yang sama. Pre-check kepemilikan lalu memanggil update internal berdasarkan ID saja tidak cukup untuk menjamin keadaan tetap sesuai.
- Tambahkan permission khusus agreement read/create/update; jangan memberikan `operations.write` keseluruhan kepada Agent. Permission UI adalah penyajian; backend tetap menentukan tindakan yang sah.
- Gunakan kembali model `HotelAgreementDraft` dan relasi `sourceDraftId`. Fitur dasar metadata tidak memerlukan migration baru. Histori revisi, asal pengiriman per akun, lampiran, atau catatan internal/publik terpisah perlu penilaian model tersendiri.
- Pertahankan dua sumbu status: approval WAITING/APPROVED/REJECTED dan alokasi Unassigned/Partially Assigned/Assigned. Jangan menampilkan satu status campuran yang menutupi sebagian alokasi.
- Gunakan aturan kapasitas per periode menginap yang sama dengan Admin. Saat menampilkan alokasi, daftar group juga diverifikasi milik Agent; jangan mengandalkan filter daftar draft saja.
- Catatan draft saat ini hanya satu field `notes`; tidak ada alasan penolakan khusus yang boleh ditampilkan seolah sudah disimpan. Tetapkan apakah field ini konten bersama sebelum menyalurkan seluruh catatan lama.
- Tangani aturan expiry 24 jam secara sengaja. GET Agent sebaiknya memakai proyeksi baca tanpa pemanggilan tersembunyi ke `findAll` yang memutasi status; bila expiry dipindah ke maintenance/service khusus, perubahan harus tetap menjaga perilaku Admin. Edit mengubah `updatedAt`, sehingga pengaruhnya terhadap jendela approval perlu diuji.
- Query Agent dan invalidation dibatasi sesi/account. Setelah save, refresh inbox Agent; Admin membaca sumber draft yang sama pada refetch berikutnya.

### Struktur tampilan

Gunakan design system GTT dan pola daftar Agreement Inbox yang sudah ada: header ringkas dengan Kirim Draft, pencarian/filter, baris identitas hotel/nomor/periode/pax/approval/alokasi, lalu detail alokasi yang dapat dibuka. Agent tidak memerlukan filter memilih Agent atau kontrol approval/assignment. Form memakai label dan validasi yang konsisten dengan Admin, dengan field kepemilikan/status ditentukan server.

### Bukti penerimaan

- Draft Agent A muncul pada inbox Admin dan inbox A, tetapi tidak pada inbox B.
- Agent A tidak dapat membaca/mengubah draft B dengan mengganti URL, ID, body, atau query.
- Request Agent yang mencoba menyetel approval, kepemilikan, atau assignment ditolak.
- Revisi draft yang memenuhi aturan edit terlihat di Admin; operasi yang berbenturan dengan perubahan/alokasi Admin memberi feedback yang jelas.
- Assignment oleh Admin memperbarui kapasitas/status alokasi yang dibaca Agent dari sumber yang sama.
- Tanggal invalid, revisi setelah expiry, kapasitas per malam, double submit, session expiry, dan refresh setelah save diuji.
- Agent tetap tidak dapat melakukan write ke endpoint internal Admin. Endpoint write Agent memakai proteksi origin cookie yang sudah ada.

## Tahap 3 — Kelengkapan informasi perjalanan

Kerjakan dalam slice terpisah: preview/PDF itinerary, Raudhah, penerbangan, lalu rincian driver dan kelengkapan visa/hotel. Semua bergantung pada penyelarasan keluarga group agar data bersama tidak hilang atau berulang.

Reuse yang tepat adalah komponen presentasi, formatter tanggal/flight, aturan pengelompokan, perhitungan kapasitas, dan pemetaan status. Container/hook Admin yang membawa fetch internal atau mutation operasional tidak dipasang langsung pada Agent. Ekspor hanya menerima proyeksi yang boleh dibaca Agent, termasuk batas notes dan anggota keluarga.

## Batas dan keputusan sebelum build

- Pewarisan dan hak lihat keluarga: ikuti domain Admin, selalu dalam scope Agent; pengelolaan relasi tetap Admin pada usulan ini.
- Assignment agreement: Admin, sudah dikonfirmasi pengguna.
- Approval agreement: disarankan tetap Admin; Agent mengirim metadata/revisi.
- Revisi draft approved/assigned dan interaksinya dengan expiry 24 jam: belum diputuskan.
- Notes lama dan rincian kontak driver yang dapat dibagikan: belum mempunyai aturan visibility tersendiri pada model saat ini.
- Invoice dan statistik merupakan kandidat tambahan, bukan scope implementasi yang sudah dipilih.

Implementasi berikutnya sebaiknya dimulai dengan Tahap 1, kemudian Tahap 2. Keduanya merupakan pekerjaan API + frontend, dengan uji domain/tenant dan journey browser yang relevan. Tidak ada alasan menjalankan build, screenshot UI, atau test suite pada pemeriksaan dokumen ini karena kode aplikasi belum diubah.

## Referensi source

- [Schema group, draft, dan visa](../../apps/backend/prisma/schema.prisma)
- [Proyeksi baca group Agent](../../apps/backend/src/agent-portal-read/agent-portal-groups.service.ts)
- [Dashboard Agent](../../apps/backend/src/agent-portal-read/agent-portal-read.service.ts)
- [Pewarisan detail Admin dan validasi parent](../../apps/backend/src/infrastructure/repositories/prisma/prisma-group.repository.ts)
- [Pengelompokan/pencarian Overview Admin](../../apps/frontend/src/hooks/app-controller/group-record-selectors.ts)
- [Detail keluarga Admin](../../apps/frontend/src/pages/group-detail/hooks/use-group-detail-dashboard.ts)
- [Visa Tracking Admin](../../apps/frontend/src/pages/visa-tracking/hooks/use-visa-tracking.ts)
- [Kontrak dan mapper Agent](../../apps/frontend/src/agent/data/contracts.ts), [mapper](../../apps/frontend/src/agent/data/map-agent-group.ts)
- [Agreement Inbox Admin](../../apps/frontend/src/pages/agreement-inbox/hooks/use-agreement-inbox.ts)
- [Repository draft Prisma](../../apps/backend/src/infrastructure/repositories/prisma/prisma-hotel-agreement-draft.repository.ts), [memory](../../apps/backend/src/infrastructure/repositories/memory/memory-hotel-agreement-draft.repository.ts)
- [Proyeksi invoice Agent](../../apps/backend/src/agent-portal-read/agent-portal-invoices.service.ts)
- [Permission frontend](../../apps/frontend/src/access/permissions.ts), [guard Agent](../../apps/backend/src/agent-auth/agent-auth.guard.ts)
