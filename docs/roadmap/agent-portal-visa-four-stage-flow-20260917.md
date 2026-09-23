# Agent Portal Visa Four-Stage Flow — 2026-09-17

## Outcome

Visa Tracking sekarang menggunakan satu alur proses yang mudah dipahami:

1. Pengiriman dokumen;
2. Agreement hotel;
3. Upload paspor ke Nusuk;
4. Visa issued.

Halaman daftar menjelaskan urutan tersebut, menunjukkan tahap yang sedang perlu
ditindaklanjuti untuk setiap group, dan merangkum jumlah tahap yang sudah selesai.
Halaman detail menampilkan status faktual untuk keempat tahap dalam urutan yang
sama.

## Data mapping

- Pengiriman dokumen menggunakan `documentStatus`.
- Agreement hotel menggunakan `agreementStatus`, dengan data hotel group sebagai
  fallback terbatas.
- Upload paspor ke Nusuk menggunakan `nusukStatus`.
- Visa issued menggunakan `visaStatus`, dengan status visa group sebagai fallback.

Status tahap tidak disimpulkan selesai hanya dari posisi tahap lain. Jika sumber
lama hanya mencatat visa issued tetapi tidak menyediakan detail dokumen atau
Nusuk, UI tetap menampilkan detail yang hilang sebagai **Belum tercatat**.

## Boundaries retained

- Tidak ada perubahan backend, database, migration, atau seed.
- Tidak ada aksi tulis baru pada Portal Agent.
- Portal Admin dan workflow production tidak berubah.
- Tidak ada deployment atau push remote.
