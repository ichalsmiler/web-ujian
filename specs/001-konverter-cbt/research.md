# Research: Konverter Jadwal & User CBT

**Feature**: [spec.md](./spec.md) | **Date**: 2026-11-06

Temuan dari pemeriksaan langsung file contoh dan PC lab:

| Fakta | Sumber |
| --- | --- |
| Node.js v26.13.0 dan npm 11.20.0 terpasang di PC lab | `node --version` |
| `jadwal.xlsx` menyimpan hasil rumus tanggal (`=A6+1` → 24 Nov 2026), jadi tanggal bisa dibaca tanpa menghitung ulang rumus | dibaca dengan `data_only` |
| `USER MOODLE.csv` adalah ASCII murni, tanpa BOM, pemisah `;` | pemeriksaan byte |
| Template CBTAdmin: 1 sheet `template_dokumen_aiocbt`, A1 tebal, tanpa merge dan tanpa validasi data, punya lebar kolom khusus | openpyxl |
| `MAPEL FIX.xlsx`: 1 sheet bernama hash (`507d409b…`), 4 kolom tanpa format khusus | openpyxl |

## 1. Bentuk aplikasi

- **Decision**: Aplikasi web statis satu halaman. Semua proses berjalan di
  browser, dan hasil build berupa **satu file `index.html`** yang bisa dibuka
  dengan klik dua kali (tanpa server), atau ditaruh di server lokal lab.
- **Rationale**: Memenuhi Prinsip II (data tidak keluar dari PC, jalan tanpa
  internet), Prinsip III (cukup buka browser), dan Prinsip V (tanpa server
  maupun database).
- **Alternatives considered**: Server Python/Flask (perlu dijalankan dan dirawat;
  data siswa ikut lewat jaringan); aplikasi desktop Electron (installer besar,
  melanggar "cukup buka browser").

## 2. Bahasa dan build

- **Decision**: TypeScript + Vite, dengan `vite-plugin-singlefile` supaya JS dan
  CSS digabung ke dalam satu `index.html`.
- **Rationale**: Browser menolak modul ES dari `file://`; menggabung semuanya
  ke satu file menghindari masalah itu sehingga file bisa dibuka langsung.
  TypeScript membantu menjaga bentuk data konversi tetap benar.
- **Alternatives considered**: JS biasa tanpa build (tidak bisa memakai pustaka
  npm dengan rapi); React/Vue (tidak perlu untuk 3 layar sederhana — UI dibuat
  dengan DOM biasa).

## 3. Membaca & menulis Excel

- **Decision**: **ExcelJS** untuk membaca `jadwal.xlsx` dan menulis kedua output.
- **Rationale**: ExcelJS memberi hasil rumus yang tersimpan (`cell.result`),
  bisa membuka file template lalu menulis ulang dengan nama sheet, lebar kolom,
  dan huruf tebal yang tetap (Prinsip I), serta berjalan di browser dan Node
  (untuk tes).
- **Alternatives considered**: SheetJS edisi komunitas (menulis tanpa gaya, jadi
  tidak bisa menjaga template); membuat XML xlsx sendiri (rawan salah).

## 4. Membaca CSV user

- **Decision**: **Papa Parse** dengan deteksi pemisah otomatis (`;` atau `,`).
  Byte file didekode dulu dengan `TextDecoder('utf-8', { fatal: true })`, dan
  jika gagal, dicoba lagi sebagai `windows-1252`. BOM UTF-8 dibuang.
- **Rationale**: CSV dari Excel Indonesia biasanya memakai `;` dan bisa
  tersimpan sebagai ANSI; kedua kasus ada di Edge Cases spec.
- **Alternatives considered**: `split(';')` sendiri (gagal pada nilai yang
  dikutip atau memuat pemisah).

## 5. Menemukan struktur jadwal

- **Decision**: Cari baris header yang memuat sel `HARI/TGL`. Setiap sel header
  yang cocok dengan pola `KELAS <romawi>` menjadi satu tingkat, dan kolom
  `WAKTU` di kirinya menjadi jam tingkat tersebut. Baris data dibaca
  berpasangan per hari: sesi I memuat nama hari, sesi II memuat tanggal. Hari
  yang semua mapelnya `SUSULAN` ditandai sebagai susulan. Pembacaan berhenti di
  baris kosong pertama setelah data (sehingga blok tanda tangan diabaikan).
- **Rationale**: Struktur sheet 2025 dan 2026 sama, tetapi letak baris/kolom
  bisa bergeser; mencari dari teks header memenuhi FR-001.
- **Tanggal**: dibaca dari hasil rumus/nilai `Date`; teks seperti
  "05 Desember 2025" diurai dengan nama bulan Indonesia. Jika tanggal tidak
  terbaca, urutan baris tetap dipakai untuk `category` dan muncul peringatan.

## 6. Mencocokkan nama mapel (kamus)

- **Decision**: Nama dinormalisasi dulu: huruf kecil, `bhs.` → `bahasa`,
  `tingkat lanjut` / `lanjut` → `lanjutan`, spasi ganda dirapikan. Hasilnya
  dicocokkan secara **persis** ke alias di kamus. Tidak ada pencocokan
  "mirip-mirip"; nama yang tidak ditemukan atau yang bentrok ditandai untuk
  dipilih operator, dan pilihan itu disimpan sebagai alias baru.
- **Rationale**: Pencocokan kabur bisa diam-diam salah memilih mapel
  (melanggar Prinsip I). Dari jadwal 2026, nama berikut **tidak** punya
  padanan di `MAPEL FIX.xlsx` dan pasti ditandai pada pemakaian pertama:
  KKA, Kimia (kelas X), Geografi Lanjutan, Sosiologi Lanjutan, Biologi
  Lanjutan, Informatika Lanjutan.
- **Kamus awal**: 20 mapel dari `MAPEL FIX.xlsx`. Kode = `shortname` tanpa
  `USBK-XII-`, nama lengkap = `fullname` tanpa ` XII`, dengan huruf
  besar/kecil dipertahankan (mis. `Matematika`, `Sejarah Indonesia`).
  "Pendidikan Agama" adalah grup yang dipecah menjadi `PAI` dan `PAK`.
- **Alias awal tambahan** (ditulis tangan karena nama lengkap di
  `MAPEL FIX.xlsx` tidak sama dengan nama di jadwal):

  | Nama di jadwal (ternormalisasi) | Kode |
  | --- | --- |
  | `bahasa indonesia lanjutan` | `BINDO LANJUT` (nama lengkap tetap `BHS INDONESIA LANJT`, sesuai file asli) |
  | `bahasa inggris lanjutan` | `BING LANJUT` |
  | `sejarah`, `sejarah indonesia` | `SEJARAH INDO` |
  | `pjok` | `PJOK` |
  | `pkwu` | `PKWU` |

  Salah ketik `LANJT` tidak diperbaiki diam-diam (Prinsip I); operator bisa
  mengubahnya di kamus.

## 7. Penyimpanan

- **Decision**: `localStorage` browser untuk kamus mapel, alias pilihan
  operator, dan pengaturan. File jadwal/user **tidak** disimpan.
- **Rationale**: FR-018 cukup terpenuhi tanpa database. Password siswa tidak
  tertinggal di browser.
- **Risiko**: Data hilang jika cache browser dibersihkan → disediakan tombol
  Ekspor/Impor kamus (file JSON).

## 8. Output

- **Mapel**: workbook baru dengan satu sheet `Sheet1`, header
  `category | format | shortname | fullname`, `category` bertipe angka. Nama
  file `MAPEL <TINGKAT>.xlsx`.
- **CBTAdmin**: template asli (8 baris judul/petunjuk + header baris 9, tanpa
  2 baris "User Coba") disimpan di `src/assets/template-cbtadmin.xlsx` dan
  diisi mulai baris 10. Nama file `USER CBTADMIN <tanggal>.xlsx`.
- **Risiko terbuka**: Moodle "Upload courses" bawaan hanya menerima CSV. Jika
  sistem ujian Anda menolak `.xlsx` untuk mapel, tambahkan tombol "Unduh CSV"
  (perubahan kecil, dicatat sebagai tugas opsional).

## 9. Pengujian

- **Decision**: **Vitest** di Node untuk modul konversi (tanpa UI), memakai
  fixture di `tests/fixtures/`, ditambah satu tes ujung-ke-ujung di browser
  dengan **Playwright** untuk alur upload → konvert → unduh.
- **Fixture & privasi**: `jadwal-2026.xlsx` adalah salinan `jadwal.xlsx` tanpa
  blok tanda tangan (nama dan NIP kepala sekolah). `users-sample.csv` adalah
  8 peserta dengan struktur sama tetapi nama dan password palsu.
  `mapel-fix.xlsx` dan template CBTAdmin tidak berisi data pribadi, jadi
  disalin apa adanya. File asli tetap di luar git (`.gitignore`).

## 10. Kolom "Kelas / Jurusan" (belum diputuskan)

- **Decision**: Pemetaan kolom ini dibuat sebagai satu pengaturan
  (`kelasJurusan: 'tingkat' | 'rombel'`) dengan nilai awal `tingkat` (→ `XII`).
  Pilihan bisa diubah di layar User dan disimpan.
- **Rationale**: Pengguna belum memutuskan; menjadikannya pengaturan berarti
  keputusan nanti tidak perlu mengubah kode. Ini satu-satunya
  [NEEDS CLARIFICATION] yang tersisa, dan sengaja dibiarkan terbuka.
