<!--
Sync Impact Report
- Version change: (template) → 1.0.0
- Principles added: I. Output Sesuai Format Target, II. Data Siswa Tetap Lokal,
  III. Mudah untuk Operator, IV. Diuji dengan File Asli, V. Sederhana Dulu
- Sections added: Batasan Teknis, Alur Kerja Pengembangan, Governance
- Templates requiring updates: none (templates read the constitution at runtime)
- Follow-up TODOs: none
-->

# Web Ujian Constitution

## Core Principles

### I. Output Sesuai Format Target (NON-NEGOTIABLE)

File hasil konversi MUST bisa langsung di-upload ke sistem tujuan tanpa diedit
tangan. Urutan kolom, nama header, baris petunjuk, nama sheet, pemisah CSV, dan
encoding MUST meniru file contoh (`MAPEL FIX.xlsx` untuk mata pelajaran,
`user cbtadmin.xlsx` untuk peserta). Jika ada data yang tidak bisa dipetakan,
aplikasi MUST menampilkan peringatan yang jelas, bukan diam-diam menebak.

Alasan: tujuan aplikasi adalah menghilangkan kerja manual di Excel; output yang
masih perlu dibetulkan berarti aplikasi gagal.

### II. Data Siswa Tetap Lokal

Data peserta (nama, username, password) MUST diproses di perangkat sekolah dan
MUST NOT dikirim ke layanan pihak ketiga. Aplikasi MUST bisa berjalan tanpa
internet di jaringan lokal lab.

Alasan: file peserta berisi password ujian; kebocoran berarti ujian bisa
dicurangi.

### III. Mudah untuk Operator

Antarmuka MUST berbahasa Indonesia, memakai istilah sekolah (jadwal, mapel,
rombel, ruang, sesi), dan alur utamanya MUST selesai dalam paling banyak tiga
langkah: masukkan data → periksa pratinjau → unduh. Pengguna tidak perlu
memasang apa pun selain membuka browser.

### IV. Diuji dengan File Asli

Setiap aturan konversi MUST punya tes otomatis yang memakai file contoh asli
(atau salinan yang datanya disamarkan) sebagai fixture, dan membandingkan output
dengan file target. Bug format yang ditemukan MUST ditambahkan sebagai kasus
tes sebelum diperbaiki.

### V. Sederhana Dulu

Bangun hanya fitur yang diminta: konversi jadwal → mapel dan konversi user →
CBTAdmin. Tanpa login, database, atau server terpisah kecuali sebuah fitur yang
sudah disetujui benar-benar membutuhkannya. Kompleksitas tambahan MUST
dijelaskan di bagian Complexity Tracking pada plan.

## Batasan Teknis

- Target: PC lab Windows dengan browser Chrome/Edge versi terbaru.
- Format input yang didukung: `.xlsx`, `.csv` (pemisah `;` atau `,`), dan
  input manual lewat form. PDF hasil scan tidak dijadikan sumber utama karena
  tidak bisa dibaca dengan andal.
- Format output: `.xlsx` yang bisa dibuka Excel dan diterima sistem tujuan.

## Alur Kerja Pengembangan

- Fitur dikerjakan lewat alur Spec Kit: specify → (clarify) → plan → tasks →
  implement.
- Perubahan aturan konversi MUST disertai pembaruan tes fixture.
- Sebelum dianggap selesai, output MUST dicoba dibuka di Excel dan dicocokkan
  dengan file contoh.

## Governance

Constitution ini mengalahkan kebiasaan atau preferensi lain dalam proyek.
Perubahan dilakukan lewat `/speckit-constitution`, dengan versi naik mengikuti
semantic versioning (MAJOR: prinsip dihapus/diubah maknanya; MINOR: prinsip atau
bagian baru; PATCH: perbaikan kata). Setiap plan MUST memeriksa kepatuhan
terhadap prinsip di atas pada bagian Constitution Check.

**Version**: 1.0.0 | **Ratified**: 2026-11-05 | **Last Amended**: 2026-11-05
