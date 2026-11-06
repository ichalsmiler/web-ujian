# Implementation Plan: Konverter Jadwal & User CBT

**Branch**: `001-konverter-cbt` | **Date**: 2026-11-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-konverter-cbt/spec.md`

## Summary

Aplikasi web satu halaman untuk operator lab:

1. upload `jadwal.xlsx` → hasilkan `MAPEL <TINGKAT>.xlsx` berformat
   `MAPEL FIX.xlsx` (`category` = hari ke-N, `shortname` = `USBK-<tingkat>-<kode>`);
2. upload `USER MOODLE.csv` → hasilkan file upload user CBTAdmin dari template
   asli.

Semua proses berjalan di browser (TypeScript + ExcelJS + Papa Parse), dan hasil
build berupa satu `index.html` yang bisa dibuka tanpa server dan tanpa
internet. Nama mapel di jadwal dicocokkan secara persis ke kamus mapel yang
bisa diedit; nama yang tidak dikenal atau bentrok ditandai untuk dipilih
operator, bukan ditebak.

## Technical Context

**Language/Version**: TypeScript 5.x, target ES2022

**Primary Dependencies**: Vite + `vite-plugin-singlefile` (build), ExcelJS (baca/tulis xlsx), Papa Parse (CSV)

**Storage**: `localStorage` untuk kamus mapel dan pengaturan saja; tanpa database

**Testing**: Vitest (modul inti + fixture), Playwright (1 alur ujung-ke-ujung di Chromium)

**Target Platform**: Chrome/Edge terbaru di Windows 10/11 PC lab; berjalan dari `file://` atau server lokal

**Project Type**: Aplikasi web statis (frontend saja)

**Performance Goals**: 1.500 peserta dikonversi < 5 detik (SC-004); jadwal < 1 detik

**Constraints**: Offline, data siswa tidak keluar dari browser, UI Bahasa Indonesia, output harus bisa langsung di-upload

**Scale/Scope**: 1 operator, 3 tab, ±20–40 mapel per tingkat, ≤ 2.000 peserta per file

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Prinsip | Pemeriksaan | Status |
| --- | --- | --- |
| I. Output Sesuai Format Target | Output mapel mengikuti kolom `MAPEL FIX.xlsx`; output user dibangun dari template CBTAdmin asli (sheet, baris petunjuk, dan gaya tetap). Nama yang tidak dikenal memblokir unduhan, bukan ditebak | ✅ |
| II. Data Siswa Tetap Lokal | Proses di browser, tanpa server, tanpa CDN saat runtime; file siswa tidak disimpan ke `localStorage` | ✅ |
| III. Mudah untuk Operator | Upload → pratinjau → unduh; cukup buka `index.html`; seluruh teks Bahasa Indonesia | ✅ |
| IV. Diuji dengan File Asli | Fixture dari file asli (disamarkan untuk data siswa); kontrak format di `contracts/file-formats.md` menjadi dasar tes | ✅ |
| V. Sederhana Dulu | Tanpa framework UI, tanpa backend, tanpa login. Tambahan di luar permintaan awal: kamus mapel (diperlukan agar kode konsisten — spec US3) dan pengaturan Kelas/Jurusan (karena keputusannya belum ada) | ✅ |

**Re-check setelah Phase 1**: desain tidak menambah komponen baru; semua
gerbang tetap ✅. Masih ada satu klarifikasi terbuka (isi `Kelas / Jurusan`),
tetapi tidak memblokir karena dibuat sebagai pengaturan (research §10).

## Project Structure

### Documentation (this feature)

```text
specs/001-konverter-cbt/
├── plan.md              # File ini
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   ├── file-formats.md  # Format input/output (acuan tes)
│   ├── core-api.md      # Fungsi modul inti
│   └── ui.md            # Perilaku 3 tab
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
index.html
package.json
vite.config.ts
src/
├── core/                    # Tanpa DOM, diuji di Node
│   ├── jadwal.ts            # daftarSheet, bacaJadwal
│   ├── kamus.ts             # kamusAwal, normalisasiNama, cocokkanJadwal, tambahAlias
│   ├── mapel.ts             # susunBarisMapel, tulisMapelXlsx
│   ├── user.ts              # bacaUser, keCbt, tulisCbtXlsx
│   ├── tanggal.ts           # urai tanggal & nama bulan Indonesia
│   └── tipe.ts              # tipe dari data-model.md + GalatFormat
├── ui/
│   ├── tab-jadwal.ts
│   ├── tab-user.ts
│   ├── tab-kamus.ts
│   ├── tabel.ts             # komponen tabel pratinjau
│   └── simpan.ts            # localStorage + unduh file
├── assets/
│   └── template-cbtadmin.xlsx
├── main.ts
└── style.css

tests/
├── fixtures/
│   ├── jadwal-2026.xlsx     # tanpa blok tanda tangan
│   ├── mapel-fix.xlsx
│   ├── template-cbtadmin.xlsx
│   └── users-sample.csv     # nama & password palsu
├── unit/                    # Vitest: satu file per modul core
└── e2e/
    └── alur.spec.ts         # Playwright
```

**Structure Decision**: Satu proyek frontend di root repo. `src/core` dipisah
dari `src/ui` supaya semua aturan konversi bisa diuji dengan Vitest tanpa
browser (Prinsip IV), sedangkan UI tetap tipis.

## Complexity Tracking

Tidak ada pelanggaran constitution yang perlu dijustifikasi.

## Risiko & Keputusan Terbuka

| Item | Dampak | Penanganan |
| --- | --- | --- |
| Isi `Kelas / Jurusan` belum diputuskan | Kecil | Pengaturan, nilai awal `tingkat` (research §10) |
| Sistem mapel mungkin hanya menerima CSV | Sedang | Cek saat validasi; jika perlu tambah tombol "Unduh CSV" |
| Kode mapel di file user ≠ kode di `MAPEL FIX.xlsx` (`MATEMATIKA-L` vs `MATEMATIKA LANJUT`) | Tinggi — peserta tidak ter-enrol | Panel "Kode mapel tidak cocok"; operator perlu menyeragamkan kode di kamus atau di sumber data user |
| 6 nama mapel di jadwal 2026 tidak ada di kamus awal | Kecil | Ditandai sekali, lalu diingat sebagai alias |
