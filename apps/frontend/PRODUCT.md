# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Admin operasional Ghaniya Tour and Travel yang membuat dan memeriksa draft hotel agreement dalam pekerjaan harian, serta super admin yang memelihara opsi sistem dan entitas operasional.

## Product Purpose

Dashboard operasional untuk mengelola proses perjalanan, dokumen group, dan data acuan yang dipakai lintas alur. Pada Agreement Inbox, keberhasilan berarti admin dapat membuat draft baru, memeriksa draft yang sudah ada, memperbarui status approval, dan mengalokasikan kapasitas agreement ke group tanpa kehilangan konteks. Pada Master Data, keberhasilan berarti super admin dapat menemukan kategori yang tepat, menambah atau memperbarui data, memeriksa kelengkapan dan pratinjau, lalu menyimpan tanpa mengubah kode aplikasi.

## Operating Context

Agreement hotel memiliki agent, nama group, kota, hotel, nomor agreement, kapasitas pax, periode menginap, status approval, dan catatan. Admin bekerja dengan kumpulan draft yang dapat dicari dan difilter, lalu menghubungkannya ke satu atau beberapa group.

Master Data mencakup opsi sistem yang digunakan oleh fitur lain, termasuk data terkait invoice, user management, dan kota Saudi, serta entitas operasional seperti agent dan direktori H-1. Setiap kategori mempertahankan field, status aktif, urutan, dan aturan backend-nya sendiri.

## Capabilities and Constraints

- Admin dapat membuat dan mengedit draft agreement.
- Admin dapat mengubah status approval secara langsung: Waiting for Approval, Approved, atau Rejected.
- Satu agreement dapat dibagi ke beberapa group hingga kapasitas pax habis.
- Admin dapat melepas hubungan agreement dari group.
- Agreement yang ditolak tidak dapat dihubungkan ke group sebelum diperbaiki.
- Perubahan desain Agreement Inbox harus mempertahankan aturan bisnis dan integrasi backend yang ada.
- Super admin dapat memilih kategori Master Data, melihat daftar data, menambah data baru, dan mengedit data yang sudah ada.
- Data Master Data dapat diaktifkan atau dinonaktifkan; penghapusan tetap melalui konfirmasi.
- Form Master Data menyesuaikan field dan validasi per kategori serta mempertahankan kontrak API yang ada.

## Brand Commitments

Produk menggunakan identitas Ghaniya Tour and Travel (GTT) dan istilah operasional yang sudah digunakan di dashboard.

## Evidence on Hand

- Implementasi Agreement Inbox dan alur operasional ada di `src/pages/agreement-inbox-page.tsx` dan `src/pages/agreement-inbox/`.
- Implementasi Master Data dan alur pengelolaan kategori ada di `src/pages/master-data-page.tsx` dan `src/pages/master-data/`.
- Komponen shell dan navigasi dashboard ada di `src/components/`.
- Data, status, dan validasi agreement ada di `src/shared/` dan `src/hooks/`.
- Tidak ada benchmark produktivitas, riset pengguna, atau klaim performa yang boleh difabrikasi.

## Product Principles

- Utamakan pembuatan draft dan pemeriksaan draft yang sudah ada.
- Buat status approval, kapasitas tersisa, dan hubungan group mudah dipindai.
- Pertahankan kontrol langsung untuk tindakan operasional yang sering dilakukan.
- Tampilkan informasi detail secara bertahap agar daftar tetap tenang dan efisien.
- Dalam Master Data, pisahkan pekerjaan menyusun data dari pemindaian daftar, tetapi pertahankan akses cepat ke data terbaru dan mode edit.

## Accessibility & Inclusion

Pertahankan semantic HTML, label kontrol, navigasi keyboard, focus state, dan status yang tidak bergantung pada warna saja.
