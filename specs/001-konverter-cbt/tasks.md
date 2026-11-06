# Tasks: Konverter Jadwal & User CBT

**Input**: Design documents from `specs/001-konverter-cbt/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Wajib. Constitution Prinsip IV mengharuskan setiap aturan konversi
punya tes fixture. Tes ditulis dulu dan harus **gagal** sebelum implementasi.

**Organization**: Tugas dikelompokkan per user story agar tiap story bisa
dibangun dan diuji sendiri.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Bisa dikerjakan paralel (file berbeda, tidak bergantung pada tugas yang belum selesai)
- **[Story]**: User story pemilik tugas (US1, US2, US3)

## Path Conventions

Proyek frontend tunggal di root repo: `src/core/` (logika, tanpa DOM),
`src/ui/` (tampilan), `tests/unit/`, `tests/e2e/`, `tests/fixtures/` — sesuai
[plan.md](./plan.md#source-code-repository-root).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Kerangka proyek dan alat bantu

- [X] T001 Buat `package.json` (nama `web-ujian`, `"type": "module"`) dengan dependensi `exceljs`, `papaparse` dan devDependensi `typescript`, `vite`, `vite-plugin-singlefile`, `vitest`, `@playwright/test`, `@types/papaparse`; skrip `dev`, `build`, `test`, `test:e2e`
- [X] T002 [P] Buat `tsconfig.json` (target ES2022, `strict: true`, `moduleResolution: "bundler"`)
- [X] T003 [P] Buat `vite.config.ts` dengan `vite-plugin-singlefile` dan `assetsInlineLimit` yang cukup besar agar `src/assets/template-cbtadmin.xlsx` ikut tertanam di `dist/index.html`
- [X] T004 [P] Buat `vitest.config.ts` (environment `node`, include `tests/unit/**/*.test.ts`) dan `playwright.config.ts` (Chromium, `webServer: npm run dev`)
- [X] T005 Buat `index.html`, `src/main.ts`, dan `src/style.css` berisi kerangka 3 tab kosong ("Jadwal → Mapel", "User → CBTAdmin", "Kamus Mapel") dengan `lang="id"`
- [X] T006 Jalankan `npm install` lalu pastikan `npm run dev`, `npm run build`, dan `npm test` (tanpa tes) berjalan tanpa galat

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Tipe, fixture, kamus, dan utilitas yang dipakai semua story

**⚠️ CRITICAL**: Tidak ada pekerjaan user story sebelum fase ini selesai

- [X] T007 Definisikan semua tipe di `src/core/tipe.ts` sesuai [data-model.md](./data-model.md): `Mapel`, `GrupMapel`, `Kamus` (`{ versi: 1, mapel, grup }`), `JadwalUjian`, `HariUjian`, `Sesi` (`nomor: 'I' | 'II'`), `HasilCocok` (`status: 'cocok' | 'tidak-dikenal' | 'duplikat'`), `BarisMapel`, `PesertaMasuk`, `PesertaCBT`, `Peringatan` (`tingkat: 'info' | 'peringatan' | 'galat'`), `Pengaturan` (`kelasJurusan: 'tingkat' | 'rombel'`), dan class `GalatFormat`
- [X] T008 [P] Buat skrip `scripts/buat-fixture.ts` yang menyalin `jadwal.xlsx` ke `tests/fixtures/jadwal-2026.xlsx` **tanpa** baris tanda tangan (nama/NIP kepala sekolah), menyalin `MAPEL FIX.xlsx` → `tests/fixtures/mapel-fix.xlsx`, dan menyalin `user cbtadmin.xlsx` tanpa 2 baris "User Coba" → `tests/fixtures/template-cbtadmin.xlsx` dan `src/assets/template-cbtadmin.xlsx`
- [X] T009 [P] Tulis `tests/fixtures/users-sample.csv` secara manual: 8 peserta **palsu** dengan struktur kolom persis `USER MOODLE.csv` (pemisah `;`, `department` berspasi ` XII-1 `, `address` = `1`, `course1..14`). Baris 1 = `00-000-0001;AB12CD;Siswa Contoh Satu;…`; satu peserta punya password berawalan nol (`07AB12`) dan satu nama berakhiran titik. Tanpa nama, username, atau password asli
- [X] T010 Jalankan `scripts/buat-fixture.ts`, lalu pastikan dengan grep bahwa tidak ada data dari `USER MOODLE.csv` maupun NIP kepala sekolah di `tests/` dan `src/`
- [X] T011 [P] Tes `tests/unit/tanggal.test.ts`: nilai `Date`, hasil rumus ExcelJS (`{ formula, result }`), teks `05 Desember 2025`, dan teks tak terbaca → `null`
- [X] T012 [P] Implementasi `src/core/tanggal.ts` (urai tanggal + nama bulan Indonesia) sampai T011 lulus
- [X] T013 [P] Tes `tests/unit/kamus.test.ts`:
  - `normalisasiNama`: `Bhs. Inggris` → `bahasa inggris`; `Kimia Lanjut` dan `Matematika Tingkat Lanjut` → akhiran `lanjutan`; spasi ganda dirapikan;
  - `kamusAwal()` berisi 20 mapel dari `MAPEL FIX.xlsx` plus alias tambahan di [research.md §6](./research.md#6-mencocokkan-nama-mapel-kamus) (`bahasa indonesia lanjutan` → `BINDO LANJUT`, `sejarah` → `SEJARAH INDO`, dst.) dan grup `pendidikan agama` → `['PAI', 'PAK']`;
  - `tambahAlias` tidak mengubah kamus asli, dan menolak alias yang sudah menunjuk ke kode lain
- [X] T014 Implementasi `normalisasiNama`, `kamusAwal`, `tambahAlias` di `src/core/kamus.ts` sampai T013 lulus. Nama lengkap disalin apa adanya, termasuk `BHS INDONESIA LANJT`
- [X] T015 [P] Implementasi `src/ui/simpan.ts`: baca/tulis `localStorage` dengan kunci `web-ujian.kamus` dan `web-ujian.pengaturan` (kembali ke `kamusAwal()` jika data rusak), serta helper `unduhFile(nama, ArrayBuffer)`
- [X] T016 [P] Implementasi `src/ui/tabel.ts`: tabel pratinjau generik (kolom, baris, penanda baris merah/kuning, penghitung jumlah baris) dan kotak daftar `Peringatan`

**Checkpoint**: Fondasi siap; US1 dan US2 bisa mulai paralel

---

## Phase 3: User Story 1 - Konversi jadwal menjadi daftar mapel (Priority: P1) 🎯 MVP

**Goal**: Upload `jadwal.xlsx` → pilih sheet & tingkat → Konvert → pratinjau → unduh `MAPEL <TINGKAT>.xlsx` berformat `MAPEL FIX.xlsx`

**Independent Test**: [quickstart.md skenario 1](./quickstart.md#1-jadwal--mapel-us1); output XII cocok dengan contoh di [file-formats.md](./contracts/file-formats.md#output-1--mapel-mapel-tingkatxlsx)

### Tests for User Story 1 ⚠️

> Tulis dulu, pastikan GAGAL sebelum implementasi

- [X] T017 [P] [US1] Tes `tests/unit/jadwal.test.ts` dengan `tests/fixtures/jadwal-2026.xlsx`:
  - `daftarSheet` → 2 sheet;
  - `bacaJadwal` sheet 2026 → tingkat `['XII', 'X', 'XI']`, 9 hari, 23 Nov – 4 Des 2026, hanya 4 Des `susulan`;
  - sel `Fisika, Kimia Lanjutan` → 2 nama;
  - blok tanda tangan diabaikan;
  - sheet 2025 terbaca, termasuk tanggal teks `05 Desember 2025`;
  - workbook tanpa `HARI/TGL` → `GalatFormat`
- [X] T018 [P] [US1] Tes `tests/unit/cocok.test.ts` untuk `cocokkanJadwal`:
  - XII → `category` 1–8;
  - `Pendidikan Agama` → kode `['PAI', 'PAK']`;
  - `Bhs. Inggris` di hari ke-5 → `duplikat` (BING sudah di hari ke-3);
  - XII: Geografi Lanjutan, Sosiologi Lanjutan, Biologi Lanjutan, dan Informatika Lanjutan → `tidak-dikenal`;
  - X: KKA dan Kimia → `tidak-dikenal`
- [X] T019 [P] [US1] Tes `tests/unit/mapel.test.ts`:
  - `susunBarisMapel` menghasilkan 7 baris pertama persis seperti contoh di `contracts/file-formats.md` (setelah alias untuk nama tidak dikenal ditambahkan);
  - `shortname` unik;
  - round-trip `tulisMapelXlsx` → header `category | format | shortname | fullname`, `category` bertipe angka, satu sheet;
  - kolom output sama dengan `tests/fixtures/mapel-fix.xlsx`

### Implementation for User Story 1

- [X] T020 [US1] Implementasi `daftarSheet` dan `bacaJadwal` di `src/core/jadwal.ts` (cari header `HARI/TGL`, kolom `KELAS <romawi>`, baris berpasangan sesi I/II, deteksi `SUSULAN`, berhenti di baris kosong — [research §5](./research.md#5-menemukan-struktur-jadwal)) sampai T017 lulus
- [X] T021 [US1] Implementasi `cocokkanJadwal` di `src/core/kamus.ts`: `category` = urutan hari non-susulan yang punya ≥1 mapel untuk tingkat itu; status `duplikat` jika kode sudah muncul di hari lain pada tingkat yang sama — sampai T018 lulus
- [X] T022 [US1] Implementasi `susunBarisMapel` dan `tulisMapelXlsx` di `src/core/mapel.ts` (`shortname` = `` `USBK-${tingkat}-${kode}` ``, `fullname` = `` `${namaLengkap} ${tingkat}` ``, `format` = `singleactivity`, urut `category` lalu urutan kemunculan) sampai T019 lulus
- [X] T023 [US1] Bangun `src/ui/tab-jadwal.ts`:
  - input file `.xlsx` dan pilihan sheet;
  - tabel jadwal terbaca (hari susulan abu-abu);
  - tombol tingkat dan tombol **Konvert**, nonaktif sampai jadwal terbaca (FR-004) — [contracts/ui.md](./contracts/ui.md#tab-jadwal--mapel)
- [X] T024 [US1] Tambahkan pratinjau hasil di `src/ui/tab-jadwal.ts`:
  - baris merah `tidak-dikenal` dengan dropdown "pilih mapel" dan tombol "tambah ke kamus" (memanggil `tambahAlias` lalu menyimpan via `simpan.ts`);
  - baris kuning `duplikat` dengan dropdown ganti mapel atau "abaikan";
  - tombol **Unduh `MAPEL <TINGKAT>.xlsx`**, nonaktif selama masih ada baris merah
- [X] T025 [US1] Tampilkan `GalatFormat` dan peringatan jadwal dalam Bahasa Indonesia di atas tabel, di `src/ui/tab-jadwal.ts`

**Checkpoint**: US1 berfungsi penuh; MVP bisa didemokan dan dipakai

---

## Phase 4: User Story 2 - Konversi user ke template CBTAdmin (Priority: P2)

**Goal**: Upload file user → pratinjau → unduh `USER CBTADMIN <YYYY-MM-DD>.xlsx` dari template asli

**Independent Test**: [quickstart.md skenario 2](./quickstart.md#2-user--cbtadmin-us2) dengan `tests/fixtures/users-sample.csv`

### Tests for User Story 2 ⚠️

- [ ] T026 [P] [US2] Tes `tests/unit/user-baca.test.ts` untuk `bacaUser`:
  - `users-sample.csv` → 8 peserta;
  - versi pemisah `,` → hasil sama;
  - versi Windows-1252 dengan huruf `é` → tidak rusak;
  - versi dengan BOM UTF-8 → kolom `username` tetap dikenali;
  - tanpa kolom `department` → `GalatFormat` yang menyebut `department`;
  - baris dengan `username` kosong → dilewati dengan peringatan
- [ ] T027 [P] [US2] Tes `tests/unit/user-cbt.test.ts`:
  - `keCbt` baris 1 → `Siswa Contoh Satu | XII-1 | XII | 1 | (kosong) | 00-000-0001 | AB12CD`;
  - `kelasJurusan: 'rombel'` → `XII-1`;
  - `Ruang` diisi `trim(address)` sebagai angka jika berupa angka bulat, selain itu kosong;
  - nama berakhiran titik tidak diubah;
  - `lastname` yang sama dengan rombel tidak ditambahkan ke nama
- [ ] T028 [P] [US2] Tes `tests/unit/user-tulis.test.ts`: round-trip `tulisCbtXlsx` → sheet `template_dokumen_aiocbt`, baris 1–8 sama dengan `tests/fixtures/template-cbtadmin.xlsx`, A1 tebal, lebar kolom sama, header di baris 9, data mulai baris 10, password `07AB12` bertipe teks

### Implementation for User Story 2

- [ ] T029 [US2] Implementasi `bacaUser` di `src/core/user.ts`: dekode UTF-8 `fatal` lalu `windows-1252` sebagai cadangan, buang BOM, Papa Parse dengan deteksi pemisah, dukung `.xlsx` (sheet pertama), nama kolom di-trim dan tidak peka huruf besar/kecil — sampai T026 lulus
- [ ] T030 [US2] Implementasi `keCbt` di `src/core/user.ts` sesuai tabel `PesertaCBT` di [data-model.md](./data-model.md#pesertacbt-baris-output) sampai T027 lulus
- [ ] T031 [US2] Implementasi `tulisCbtXlsx` di `src/core/user.ts`: muat template, tulis mulai baris 10, set `Password` sebagai teks (`numFmt '@'`) — sampai T028 lulus
- [ ] T032 [US2] Bangun `src/ui/tab-user.ts`:
  - input `.csv`/`.xlsx`;
  - pengaturan "Kelas / Jurusan diisi dengan" (Tingkat/Rombel, disimpan via `simpan.ts`);
  - pratinjau 7 kolom dengan password tersamar dan tombol "tampilkan";
  - jumlah peserta dan peringatan;
  - tombol **Unduh** — [contracts/ui.md](./contracts/ui.md#tab-user--cbtadmin)
- [ ] T033 [US2] Tambahkan panel "Kode mapel tidak cocok" di `src/ui/tab-user.ts`: bandingkan nilai `course1..14` dengan `shortname` hasil konversi tab Jadwal (jika ada), dan tampilkan kode yang tidak ditemukan

**Checkpoint**: US1 dan US2 sama-sama berfungsi secara mandiri

---

## Phase 5: User Story 3 - Kamus mata pelajaran (Priority: P3)

**Goal**: Operator bisa melihat, menambah, mengubah, menghapus, mengekspor, dan mengimpor kamus mapel

**Independent Test**: [quickstart.md skenario 3](./quickstart.md#3-kamus--penyimpanan-us3-fr-018)

### Tests for User Story 3 ⚠️

- [ ] T034 [P] [US3] Tes `tests/unit/kamus-edit.test.ts`:
  - ubah kode → `susunBarisMapel` memakai kode baru;
  - hapus mapel yang dipakai grup → ditolak dengan pesan;
  - ekspor lalu impor JSON → kamus sama;
  - impor JSON tidak valid → `GalatFormat`

### Implementation for User Story 3

- [ ] T035 [US3] Tambahkan `ubahMapel`, `hapusMapel`, `eksporKamus`, dan `imporKamus` (murni, tidak mengubah objek asli) di `src/core/kamus.ts` sampai T034 lulus
- [ ] T036 [US3] Bangun `src/ui/tab-kamus.ts`: tabel kode / nama lengkap / alias yang bisa diedit, tombol tambah dan hapus, **Ekspor JSON**, **Impor JSON**, dan **Kembalikan ke awal** (dengan konfirmasi) — [contracts/ui.md](./contracts/ui.md#tab-kamus-mapel)
- [ ] T037 [US3] Pastikan perubahan kamus di tab Kamus langsung berlaku di dropdown tab Jadwal tanpa reload (event perubahan sederhana di `src/ui/simpan.ts`)

**Checkpoint**: Semua user story berfungsi secara mandiri

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T038 [P] Tes e2e `tests/e2e/alur.spec.ts` (Playwright): skenario quickstart 1 dan 2 memakai fixture, memeriksa isi file yang diunduh, dan memastikan tidak ada request jaringan keluar selama proses (Prinsip II)
- [ ] T039 [P] Tes performa di `tests/unit/performa.test.ts`: 1.500 peserta sintetis melalui `bacaUser` → `keCbt` → `tulisCbtXlsx` selesai < 5 detik (SC-004)
- [ ] T040 Periksa semua teks UI di `src/ui/` dan `index.html`: Bahasa Indonesia, istilah sekolah, tanpa kata teknis (FR-019, Prinsip III)
- [ ] T041 Jalankan `npm run build`, putuskan internet, buka `dist/index.html` dengan klik dua kali, lalu jalankan [quickstart skenario 4](./quickstart.md#4-build-offline-prinsip-ii)
- [ ] T042 Validasi dengan sistem asli: upload `MAPEL XII.xlsx` ke sistem ujian dan file CBTAdmin hasil `USER MOODLE.csv` ke CBTAdmin (SC-001, SC-002). Jika sistem mapel hanya menerima CSV, tambahkan tombol "Unduh CSV" di `src/core/mapel.ts` dan `src/ui/tab-jadwal.ts`
- [ ] T043 [P] Tulis `README.md` (Bahasa Indonesia): cara memakai `dist/index.html`, cara build, dan peringatan agar file data siswa tidak di-commit

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: tidak bergantung pada apa pun
- **Foundational (Phase 2)**: setelah Setup — **memblokir** semua story
- **US1 (Phase 3)** dan **US2 (Phase 4)**: setelah Foundational, saling independen
- **US3 (Phase 5)**: setelah Foundational. T037 menyentuh perilaku tab Jadwal, jadi paling mudah dikerjakan setelah T024
- **Polish (Phase 6)**: setelah semua story yang ingin dirilis selesai

### User Story Dependencies

- **US1**: hanya butuh Foundational (kamus inti ada di T014)
- **US2**: hanya butuh Foundational; T033 memakai hasil US1 jika ada, tetapi tetap jalan tanpanya
- **US3**: hanya butuh Foundational; menambah fitur edit ke kamus yang sudah dipakai US1

### Within Each User Story

- Tes ditulis dan GAGAL dulu → implementasi core → UI
- `src/core/*` selesai sebelum `src/ui/*` yang memakainya
- Commit setelah setiap tugas atau kelompok tugas yang logis

### Parallel Opportunities

- T002, T003, T004 paralel setelah T001
- T008/T009, T011/T013, T015/T016 paralel di Foundational
- Semua tes [P] di dalam satu story paralel
- Setelah Phase 2: US1 dan US2 bisa dikerjakan dua orang sekaligus

---

## Parallel Example: User Story 1

```text
# Tulis semua tes US1 sekaligus:
T017 tests/unit/jadwal.test.ts
T018 tests/unit/cocok.test.ts
T019 tests/unit/mapel.test.ts

# Lalu implementasi berurutan (saling bergantung):
T020 → T021 → T022 → T023 → T024 → T025
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 Setup → Phase 2 Foundational
2. Phase 3 (US1) → **berhenti dan validasi**: upload `MAPEL XII.xlsx` hasil aplikasi ke sistem ujian
3. Jika diterima, MVP sudah bisa dipakai untuk jadwal PSAS 23 Nov 2026

### Incremental Delivery

1. Setup + Foundational → fondasi siap
2. US1 → validasi → pakai (MVP)
3. US2 → validasi ke CBTAdmin → pakai
4. US3 → kamus bisa dirawat tanpa mengedit kode
5. Polish → build offline final

### Catatan tenggat

Ujian mulai **Senin, 23 November 2026**. Mapel dan user harus sudah ter-upload
sebelum tanggal itu, jadi US1 dan US2 adalah prioritas; US3 bisa menyusul.

---

## Notes

- [P] = file berbeda, tanpa ketergantungan
- Label [Story] memetakan tugas ke user story untuk keterlacakan
- Keputusan **Kelas / Jurusan** masih terbuka; T027/T030/T032 memakai
  pengaturan dengan nilai awal `tingkat`, jadi tidak memblokir
- **Jangan** menyalin nama, username, atau password siswa asli ke tes, fixture,
  dokumen, atau commit; selalu pakai data palsu (lihat T009 dan T010)
