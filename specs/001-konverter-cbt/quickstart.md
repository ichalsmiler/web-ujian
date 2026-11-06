# Quickstart: Validasi Konverter Jadwal & User CBT

## Prasyarat

- Node.js ≥ 20 (PC lab: v26.13.0) dan npm.
- Chrome atau Edge versi terbaru.
- File contoh asli di root proyek (`jadwal.xlsx`, `USER MOODLE.csv`,
  `MAPEL FIX.xlsx`, `user cbtadmin.xlsx`). File ini tidak ada di git.

## Pasang & jalankan

```bash
npm install
```

```bash
npm run dev
```

Buka alamat yang ditampilkan (mis. `http://localhost:5173`).

## Tes otomatis

```bash
npm test
```

Harus lulus, termasuk tes fixture untuk aturan di
[contracts/file-formats.md](./contracts/file-formats.md).

```bash
npm run test:e2e
```

Menjalankan alur browser untuk skenario 1 dan 2 di bawah.

## Skenario validasi manual

### 1. Jadwal → Mapel (US1)

1. Tab **Jadwal → Mapel** → upload `jadwal.xlsx` → pilih sheet
   `Jadwal SMT Gsl 2026 EDIT`.
2. **Diharapkan**: 9 hari terbaca (23 Nov – 4 Des 2026); 4 Des bertanda susulan.
3. Pilih **XII** → **Konvert**.
4. **Diharapkan**: baris merah untuk Geografi Lanjutan, Sosiologi Lanjutan,
   Biologi Lanjutan, dan Informatika Lanjutan; baris kuning untuk
   "Bhs. Inggris" pada 30 Nov. Pilih mapel yang benar untuk masing-masing.
5. **Unduh** → buka `MAPEL XII.xlsx` di Excel.
6. **Diharapkan**: kolom `category | format | shortname | fullname`,
   `category` 1–8, 7 baris pertama sama dengan contoh di
   [file-formats.md](./contracts/file-formats.md#output-1--mapel-mapel-tingkatxlsx).
7. Ulangi untuk **X**: "KKA" dan "Kimia" berwarna merah sampai ditambahkan ke
   kamus.

### 2. User → CBTAdmin (US2)

1. Tab **User → CBTAdmin** → upload `tests/fixtures/users-sample.csv` (data palsu; ulangi dengan `USER MOODLE.csv` asli untuk langkah 5).
2. **Diharapkan**: 8 peserta; baris pertama
   `Siswa Contoh Satu | XII-1 | XII | 1 | | 00-000-0001 | AB12CD`.
3. **Unduh** → buka di Excel.
4. **Diharapkan**: baris 1–9 sama dengan `user cbtadmin.xlsx` (tanpa 2 baris
   "User Coba"), data mulai baris 10, password `07AB12` tetap teks.
5. Upload hasilnya ke CBTAdmin → 8 peserta masuk tanpa galat (SC-002).

### 3. Kamus & penyimpanan (US3, FR-018)

1. Tambahkan alias "KKA" dengan kode `KKA` lalu tutup browser.
2. Buka lagi → "KKA" masih ada; jadwal dan file user **tidak** tersimpan.

### 4. Build offline (Prinsip II)

```bash
npm run build
```

Putuskan internet, klik dua kali `dist/index.html`, lalu ulangi skenario 1–2.
**Diharapkan**: semua fitur tetap jalan.
