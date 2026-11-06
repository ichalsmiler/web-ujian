# Feature Specification: Konverter Jadwal & User CBT

**Feature Branch**: `001-konverter-cbt`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "aplikasi konvert ke format ujian berbasis web dan ketika jadwal saya masukkan maka akan ada tombol konvert dengan output seperti pada file mapel fix kemudian nanti ada tempat upload user dan akan terkonvert seperti file user cbtadmin itu saja dulu"

**File contoh** (di root proyek, tidak di-commit karena berisi data siswa):

| File | Peran |
| --- | --- |
| `jadwal.xlsx` | **Input 1**: jadwal ujian dalam Excel. Sheet `Jadwal SMT Gsl 2026 EDIT` (23 Nov – 3 Des 2026 + susulan 4 Des) dan sheet lama `Jadwal SMT Gsl 2025`. Header di baris 4: `HARI/TGL`, `JAM`, `WAKTU`, `KELAS XII`, `WAKTU`, `KELAS X`, `WAKTU`, `KELAS XI`. Tiap hari memakai 2 baris (sesi I dan II); nama hari ada di baris sesi I, tanggal di baris sesi II (bisa berupa rumus `=A6+1`). Satu sel bisa berisi beberapa mapel dipisah koma |
| `jadwal.pdf` | Versi cetak/scan dari jadwal yang sama (hanya referensi, tidak dibaca aplikasi) |
| `MAPEL FIX.xlsx` | **Target output 1**: daftar mapel dengan kolom `category`, `format`, `shortname`, `fullname` |
| `USER MOODLE.csv` | Contoh **input 2**: data peserta (pemisah `;`) dengan kolom `username;password;firstname;lastname;email;department;address;course1..course14` |
| `user cbtadmin.xlsx` | **Target output 2**: template upload user CBTAdmin (baris judul + petunjuk, lalu header `Nama Peserta`, `Nama Rombel`, `Kelas / Jurusan`, `Ruang`, `Kel. Sesi`, `Username`, `Password`) |

## Clarifications

### Session 2026-11-05

- Q: Bagaimana jadwal dimasukkan? → A: Upload file Excel seperti `jadwal.xlsx`.
- Q: Prefix `shortname`? → A: Selalu `USBK-<tingkat sesuai kolom kelas>-<mapel>`.
- Q: Isi kolom `Kelas / Jurusan` di CBTAdmin? → A: Belum diputuskan (menunggu pengguna).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Konversi jadwal menjadi daftar mapel (Priority: P1)

Operator meng-upload file jadwal Excel (format seperti `jadwal.xlsx`) dan memilih
sheet yang dipakai. Aplikasi menampilkan jadwal yang terbaca (hari, tanggal,
sesi, mapel per tingkat). Setelah jadwal terbaca, tombol **Konvert** aktif.
Operator menekannya, melihat pratinjau tabel mapel, lalu mengunduh file Excel
yang formatnya sama dengan `MAPEL FIX.xlsx` untuk tingkat yang dipilih.

**Why this priority**: Ini permintaan pertama pengguna dan hasilnya dipakai untuk
membuat mata pelajaran ujian di sistem; tanpa ini user tidak bisa di-enrol.

**Independent Test**: Upload `jadwal.xlsx`, pilih sheet `Jadwal SMT Gsl 2026 EDIT`
dan tingkat XII, tekan Konvert, unduh hasilnya, lalu cocokkan kolom dan aturan
isinya dengan `MAPEL FIX.xlsx`.

**Acceptance Scenarios**:

1. **Given** `jadwal.xlsx` sheet 2026 sudah di-upload (8 hari ujian + 1 hari
   susulan), **When** operator memilih tingkat XII dan menekan Konvert, **Then**
   muncul satu baris per mapel dengan `category` = urutan hari ujian (Senin 23
   Nov = 1, Selasa 24 Nov = 2, …, Kamis 3 Des = 8), `format` = `singleactivity`,
   `shortname` = `USBK-<TINGKAT>-<KODE MAPEL>` (mis. `USBK-XII-MATEMATIKA`), dan
   `fullname` = `<NAMA MAPEL> <TINGKAT>` (mis. `Matematika XII`).
2. **Given** file jadwal punya lebih dari satu sheet, **When** di-upload,
   **Then** operator bisa memilih sheet mana yang dibaca.
3. **Given** satu sel berisi dua mapel (mis. "Fisika, Kimia Lanjutan"),
   **When** dikonvert, **Then** keduanya menjadi dua baris terpisah dengan
   `category` yang sama.
4. **Given** satu sesi berisi "Pendidikan Agama", **When** dikonvert, **Then**
   menghasilkan baris untuk setiap agama yang dikonfigurasi (minimal PAI dan PAK),
   seperti pada `MAPEL FIX.xlsx`.
5. **Given** jadwal memuat baris "SUSULAN", **When** dikonvert, **Then** baris itu
   tidak menghasilkan mapel dan tidak dihitung sebagai hari ujian.
6. **Given** file yang di-upload bukan jadwal (header `HARI/TGL` … `KELAS XI`
   tidak ditemukan), **When** di-upload, **Then** tombol Konvert tetap nonaktif
   dan aplikasi menjelaskan apa yang tidak ditemukan.
7. **Given** hasil sudah tampil di pratinjau, **When** operator menekan Unduh,
   **Then** file `.xlsx` yang terunduh bisa dibuka di Excel dan isinya sama
   dengan pratinjau.

---

### User Story 2 - Konversi user ke template CBTAdmin (Priority: P2)

Operator meng-upload file data peserta (format seperti `USER MOODLE.csv`).
Aplikasi menampilkan pratinjau hasil, lalu operator mengunduh file Excel dengan
format persis `user cbtadmin.xlsx`, termasuk baris judul dan petunjuknya.

**Why this priority**: Dibutuhkan setelah mapel tersedia, dan bisa dipakai
terpisah dari fitur jadwal.

**Independent Test**: Upload `USER MOODLE.csv`, unduh hasilnya, buka di Excel, dan
pastikan file bisa langsung di-upload ke CBTAdmin.

**Acceptance Scenarios**:

1. **Given** file `USER MOODLE.csv` berisi 8 peserta, **When** di-upload, **Then**
   pratinjau menampilkan 8 baris dengan pemetaan: `Nama Peserta` ← `firstname`,
   `Nama Rombel` ← `department` (spasi di awal/akhir dibuang, mis. `XII-1`),
   `Kelas / Jurusan` ← [NEEDS CLARIFICATION: tingkat (`XII`) atau rombel (`XII-1`)?],
   `Ruang` ← `address`, `Kel. Sesi` kosong, `Username` ← `username`,
   `Password` ← `password`.
2. **Given** hasil sudah tampil, **When** operator menekan Unduh, **Then** file
   memuat 8 baris judul/petunjuk yang sama persis dengan template, header di
   baris 9, dan data mulai baris 10.
3. **Given** file yang di-upload tidak punya kolom wajib (`username`,
   `firstname`, `department`), **When** di-upload, **Then** aplikasi menolak
   dengan pesan yang menyebut kolom yang hilang.

---

### User Story 3 - Kamus mata pelajaran (Priority: P3)

Operator mengelola daftar mapel: nama yang tampil di jadwal (mis. "Bahasa
Indonesia"), kode untuk `shortname` (mis. `BINDO`), dan nama lengkap untuk
`fullname` (mis. `BHS INDONESIA`). Daftar awal diisi dari `MAPEL FIX.xlsx`.

**Why this priority**: Konversi jadwal bergantung pada kode yang konsisten;
kamus ini mencegah salah ketik dan perbedaan kode antar-file.

**Independent Test**: Tambah mapel "KKA" dengan kode `KKA`, pakai di jadwal kelas
X, lalu cek hasil konversi memakai kode tersebut.

**Acceptance Scenarios**:

1. **Given** aplikasi baru dibuka pertama kali, **When** operator membuka kamus,
   **Then** semua 20 mapel dari `MAPEL FIX.xlsx` sudah tersedia.
2. **Given** operator mengubah kode sebuah mapel, **When** jadwal dikonvert
   ulang, **Then** `shortname` memakai kode baru.

---

### Edge Cases

- Mapel di jadwal tidak ada di kamus → Konvert tetap bisa ditekan, tetapi baris
  itu ditandai dan operator diminta memilih/menambah mapel.
- Mapel yang sama muncul dua kali dalam satu tingkat → hanya satu baris, dengan
  peringatan. Contoh nyata di `jadwal.xlsx`: sel "Bhs. Inggris, Bhs. Indonesia
  Lanjutan" pada 30 Nov. Jika dibaca per kata, "Bhs. Inggris" bentrok dengan
  Bahasa Inggris wajib (26 Nov), padahal maksudnya Bhs. Inggris **Lanjutan**.
  Aplikasi MUST menandai baris ini di pratinjau agar operator memilih mapel yang
  benar, dan pilihan itu diingat untuk upload berikutnya.
- Mapel di jadwal tidak ada di kamus awal (contoh nyata: "KKA" kelas X) →
  ditandai, operator menambahkannya ke kamus.
- Tanggal di jadwal berupa rumus (`=A6+1`) atau teks ("05 Desember 2025") →
  keduanya terbaca sebagai tanggal.
- Kode mapel di jadwal berbeda dengan kode yang dipakai di kolom `course1..14`
  file user (contoh nyata: `USBK-XII-MATEMATIKA-L` di file user vs
  `USBK-XII-MATEMATIKA LANJUT` di `MAPEL FIX.xlsx`; `USBK-XII-SEJARAH` vs
  `USBK-XII-SEJARAH INDO`) → jika kedua file diproses, aplikasi menampilkan
  daftar kode yang tidak cocok.
- File user memakai pemisah `,` alih-alih `;`, atau disimpan dari Excel dengan
  encoding Windows-1252 → tetap terbaca tanpa huruf rusak.
- Nama peserta berisi spasi berlebih atau titik di akhir (mis. "NAMA
  CONTOH.") → spasi di awal/akhir dibuang, isi nama tidak diubah.
- Kolom `password` atau `address` kosong → sel dibiarkan kosong (CBTAdmin akan
  membuat otomatis).
- File berukuran besar (±1.500 peserta) → tetap selesai tanpa membuat browser
  macet.

## Requirements *(mandatory)*

### Functional Requirements

**Jadwal → Mapel**

- **FR-001**: Operator MUST bisa meng-upload jadwal ujian `.xlsx` berformat
  seperti `jadwal.xlsx` dan memilih sheet-nya. Aplikasi MUST membaca: nama hari,
  tanggal (termasuk tanggal hasil rumus), sesi (I/II), dan mapel per tingkat dari
  kolom `KELAS XII`, `KELAS X`, `KELAS XI`. Posisi kolom MUST dicari dari teks
  header, bukan dari huruf kolom tetap.
- **FR-001a**: Tingkat (X, XI, XII) MUST diambil dari teks header kolom
  (`KELAS XII` → `XII`), sehingga tingkat lain ikut terbaca jika ada.
- **FR-002**: Sel yang berisi beberapa mapel dipisah koma MUST dipecah menjadi
  mapel terpisah; tiap nama dicocokkan ke kamus mapel (termasuk ejaan lain
  seperti "Bhs. Inggris", "Bahasa Inggris", "BAHASA INGGRIS").
- **FR-003**: Hari bertanda SUSULAN MUST diabaikan dalam konversi.
- **FR-004**: Tombol Konvert MUST nonaktif sampai file jadwal berhasil dibaca,
  dan aktif setelah setidaknya satu hari berisi mapel.
- **FR-005**: Konversi MUST menghasilkan kolom `category`, `format`,
  `shortname`, `fullname` dengan urutan dan nama header persis seperti
  `MAPEL FIX.xlsx`.
- **FR-006**: `category` MUST berisi nomor urut hari ujian (1, 2, 3, …) sesuai
  urutan tanggal, sehingga semua mapel di hari yang sama berbagi `category`.
- **FR-007**: `format` MUST selalu `singleactivity`.
- **FR-008**: `shortname` MUST berbentuk `USBK-<TINGKAT>-<KODE>`, dengan
  TINGKAT mengikuti kolom kelas di jadwal (mis. `USBK-X-MATEMATIKA`,
  `USBK-XI-MATEMATIKA`, `USBK-XII-MATEMATIKA`).
- **FR-009**: `fullname` MUST berbentuk `<NAMA LENGKAP> <TINGKAT>`.
- **FR-010**: Operator MUST bisa memilih tingkat yang dikonvert; setiap tingkat
  menghasilkan file terpisah bernama `MAPEL <TINGKAT>.xlsx`.
- **FR-011**: Mapel "Pendidikan Agama" MUST dipecah menjadi satu baris per agama
  yang dikonfigurasi (awal: PAI, PAK).

**User → CBTAdmin**

- **FR-012**: Operator MUST bisa meng-upload file peserta `.csv` (pemisah `;`
  atau `,`) atau `.xlsx` dengan kolom seperti `USER MOODLE.csv`.
- **FR-013**: Aplikasi MUST memetakan kolom sesuai Acceptance Scenario US2-1.
- **FR-014**: File hasil MUST memuat baris judul dan 7 baris petunjuk dari
  template `user cbtadmin.xlsx` tanpa perubahan, header di baris 9, data mulai
  baris 10.
- **FR-015**: Kolom `course1..course14` MUST diabaikan dalam output CBTAdmin.

**Umum**

- **FR-016**: Sebelum mengunduh, aplikasi MUST menampilkan pratinjau tabel hasil
  dan jumlah barisnya.
- **FR-017**: Semua pemrosesan file MUST terjadi di perangkat sekolah; data
  peserta MUST NOT dikirim ke layanan luar.
- **FR-018**: Kamus mapel dan jadwal terakhir MUST tetap tersimpan saat halaman
  dibuka ulang di browser yang sama.
- **FR-019**: Semua teks antarmuka MUST berbahasa Indonesia.

### Key Entities

- **Mapel (kamus)**: nama di jadwal, kode singkat, nama lengkap, apakah
  mapel agama.
- **Jadwal Ujian**: daftar hari ujian; tiap hari punya tanggal, urutan, penanda
  susulan, dan sesi.
- **Sesi**: nomor sesi, jam, dan daftar mapel per tingkat.
- **Baris Mapel (output)**: category, format, shortname, fullname.
- **Peserta**: nama, rombel, kelas/jurusan, ruang, kelompok sesi, username,
  password.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: File mapel hasil konversi diterima sistem ujian tanpa diedit
  manual pada percobaan pertama.
- **SC-002**: File user hasil konversi diterima CBTAdmin tanpa diedit manual,
  dengan 100% peserta dari file input ikut terimpor.
- **SC-003**: Operator bisa menyelesaikan konversi jadwal satu tingkat (8 hari,
  2 sesi) dalam waktu kurang dari 10 menit, termasuk mengisi jadwal.
- **SC-004**: Konversi file user berisi 1.500 peserta selesai dalam kurang dari
  5 detik di PC lab.
- **SC-005**: Konversi ulang `USER MOODLE.csv` dan jadwal kelas XII contoh
  menghasilkan file yang cocok 100% dengan aturan di spesifikasi ini (diuji
  otomatis).

## Assumptions

- Pengguna adalah satu operator/admin lab; tidak perlu login atau banyak akun.
- `MAPEL FIX.xlsx` berasal dari jadwal lain (isinya tidak sama dengan kedua
  sheet di `jadwal.xlsx`), jadi dipakai sebagai acuan **format dan aturan**, bukan
  acuan isi.
- Prefix `USBK` dipakai tetap untuk semua ujian (keputusan pengguna 2026-11-05).
- Input manual jadwal lewat form tidak dibuat di versi ini; koreksi dilakukan
  dengan memilih mapel di pratinjau atau mengedit file Excel-nya.
- `Ruang` diambil dari kolom `address` file user (pada contoh berisi `1`).
- `Kel. Sesi` dibiarkan kosong karena tidak ada di file sumber.
- Nama sheet output tidak memengaruhi proses upload.
- Hari ke-N dihitung hanya dari hari yang punya mapel untuk tingkat tersebut.
- Aplikasi dipakai di jaringan lokal sekolah dan harus tetap jalan tanpa internet.
- Di luar cakupan versi ini: membuat soal, mengunggah langsung ke CBTAdmin/Moodle,
  membaca PDF hasil scan, cetak kartu ujian.
