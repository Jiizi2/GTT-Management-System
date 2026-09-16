# Agent Portal N3 Itinerary Driver Fields — 2026-09-17

## Outcome

Kesiapan transportasi tidak lagi ditampilkan sebagai bagian terpisah karena
informasinya mengulang kronologi perjalanan. Status penugasan transportasi
sekarang ditempatkan langsung pada aktivitas itinerary yang membutuhkan bus.

Setiap aktivitas tersebut menyiapkan tiga informasi operasional:

- nama driver;
- plat nomor;
- muassasah.

## Current data boundary

Kontrak Agent Portal saat ini hanya mengirim jumlah driver dan status
verifikasinya. Karena itu, tampilan mempertahankan status faktual seperti
**Terverifikasi**, **Menunggu verifikasi**, atau **Belum ditugaskan**, serta
menandai identitas driver, plat nomor, dan muassasah sebagai belum tersedia di
Portal Agent.

Nama dan plat nomor internal sengaja tidak dibuka melalui perubahan frontend
ini. Muassasah juga belum menjadi bagian dari data penugasan transportasi.
Menampilkan nilai sebenarnya memerlukan keputusan akses data dan perubahan
kontrak backend yang terpisah.

## Boundaries retained

- Tidak ada perubahan backend, database, migration, atau seed.
- Tidak ada perubahan pada Portal Admin.
- Tidak ada deployment atau perubahan production.
- Perubahan tetap read-only dan terbatas pada detail Perjalanan Agent.

## Verification

- Tampilan desktop dan mobile diperiksa dengan data preview terbaru.
- Informasi pengemudi tampil di dalam itinerary dan seksi transportasi lama
  tidak lagi muncul.
- Tidak ada horizontal overflow atau request gagal setelah login.
- Component tests mencakup penugasan terverifikasi dan aktivitas bus yang belum
  memiliki penugasan.
