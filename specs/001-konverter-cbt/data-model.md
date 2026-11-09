# Data Model: Konverter Jadwal & User CBT

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

Semua data hidup di memori browser. Hanya `Kamus` dan pilihan operator di tab Jadwal yang disimpan
ke `localStorage`.

## Mapel (entri kamus)

| Field | Tipe | Aturan |
| --- | --- | --- |
| `kode` | string | Wajib, unik, huruf besar. Bagian akhir `shortname` (mis. `BINDO`, `MATEMATIKA LANJUT`) |
| `namaLengkap` | string | Wajib. Bagian awal `fullname`, ditulis apa adanya (mis. `BHS INDONESIA`, `Matematika`) |
| `alias` | string[] | Nama ternormalisasi yang muncul di jadwal (mis. `bahasa indonesia`). Satu alias hanya boleh menunjuk ke satu entri kamus |

## GrupMapel

| Field | Tipe | Aturan |
| --- | --- | --- |
| `alias` | string[] | Mis. `pendidikan agama` |
| `kodeAnggota` | string[] | Mis. `['PAI', 'PAK']`; setiap kode harus ada di kamus |

Saat dicocokkan, sebuah grup menghasilkan satu `BarisMapel` per anggota.

## Kamus

`{ versi: 1, mapel: Mapel[], grup: GrupMapel[] }`, dengan nilai awal dari
`MAPEL FIX.xlsx` (lihat research §6). Disimpan di `localStorage` dengan kunci
`web-ujian.kamus`, dan bisa diekspor/diimpor sebagai JSON.

## JadwalUjian (hasil baca `jadwal.xlsx`)

| Field | Tipe | Aturan |
| --- | --- | --- |
| `namaSheet` | string | Sheet yang dipilih operator |
| `tingkat` | string[] | Dari header `KELAS <romawi>`, urut sesuai kolom (mis. `['XII', 'X', 'XI']`) |
| `hari` | HariUjian[] | Urut sesuai baris di sheet |
| `peringatan` | Peringatan[] | Mis. tanggal tidak terbaca |

### HariUjian

| Field | Tipe | Aturan |
| --- | --- | --- |
| `namaHari` | string | Mis. `Senin` |
| `tanggal` | Date \| null | Dari hasil rumus, nilai tanggal, atau teks bulan Indonesia |
| `susulan` | boolean | `true` jika semua sel mapel berisi `SUSULAN` |
| `sesi` | Sesi[] | 1–2 sesi |

### Sesi

| Field | Tipe | Aturan |
| --- | --- | --- |
| `nomor` | `'I' \| 'II'` | Dari kolom `JAM`; kosong pada baris susulan |
| `mapelPerTingkat` | `Record<tingkat, string[]>` | Teks sel dipecah dengan koma, lalu di-trim; sel kosong → `[]` |

## Konversi mapel

### HasilCocok (satu nama dari jadwal)

| Field | Tipe | Aturan |
| --- | --- | --- |
| `teksAsli` | string | Mis. `Bhs. Inggris` |
| `status` | `'cocok' \| 'tidak-dikenal' \| 'duplikat'` | `duplikat` = kode yang sama sudah muncul di hari lain untuk tingkat yang sama |
| `kode` | string[] | Kosong jika `tidak-dikenal`; lebih dari 1 untuk grup |
| `hariKe` | number | `category` |

Tombol **Unduh** dinonaktifkan selama masih ada status `tidak-dikenal`.
Status `duplikat` hanya berupa peringatan: operator memilih mapel lain atau
membiarkannya (baris kedua dibuang).

### BarisMapel (output)

| Kolom | Isi |
| --- | --- |
| `category` | number — urutan hari non-susulan yang berisi mapel (kelas mana pun), mulai 1; sama untuk semua kelas |
| `format` | `singleactivity` |
| `shortname` | `USBK-${tingkat}-${kode}` |
| `fullname` | `${namaLengkap} ${tingkat}` |

Urutan baris: berdasarkan `category`, lalu urutan kemunculan di jadwal (sesi I
sebelum sesi II, kiri ke kanan di dalam sel). Setiap `shortname` unik per file.

File gabungan (**Konvert semua kelas**): urut `category`, lalu kelas XII → X → XI
(tingkat lain menyusul sesuai urutan kolom), lalu urutan kemunculan di jadwal.

## Konversi user

### PesertaMasuk (baris file user)

Kolom wajib: `username`, `firstname`, `department`. Kolom opsional:
`password`, `lastname`, `address`. Kolom lain (`email`, `course1..14`)
diabaikan. Nama kolom dicocokkan tanpa membedakan huruf besar/kecil dan
setelah di-trim.

### PesertaCBT (baris output)

| Kolom template | Isi |
| --- | --- |
| `Nama Peserta` | `NAMA SISWA` (format lama: `firstname`, ditambah `lastname` jika berbeda dari rombel), spasi berlebih dirapikan |
| `Nama Rombel` | `KELAS` (format lama: `department`) apa adanya, mis. `X-1` |
| `Kelas / Jurusan` | sama dengan Nama Rombel (`KELAS`) |
| `Ruang` | `RG.` (format lama: `address`) sebagai angka jika berupa angka bulat, selain itu kosong |
| `Kel. Sesi` | `1` untuk semua peserta |
| `Username` | nomor `UJIAN` (format lama: `username`), disimpan sebagai teks |
| `Password` | acak 6 karakter `[A-Z]{2}[0-9]{2}[A-Z]{2}` (mis. `HJ86KL`) dari `crypto.getRandomValues`, unik dalam satu file, dibuat sekali saat upload; format lama memakai `password` dari file. Disimpan sebagai **teks** |

Format DATA PESERTA: setiap sheet yang punya header `UJIAN`, `NAMA SISWA`, `KELAS` dibaca (header berulang dilewati).
Nomor ujian tanpa nama dilewati sebagai keterangan (`info`). Jika tingkat di KELAS ≠ tingkat di nama sheet (`KLS. XI`),
muncul `peringatan` per sheet, tetapi nilai KELAS tetap dipakai apa adanya.
Baris dengan `username` kosong dilewati dan dicatat sebagai peringatan.

### Peringatan

`{ tingkat: 'info' | 'peringatan' | 'galat', pesan: string, lokasi?: string }`,
dengan `lokasi` berupa sel/baris sumber (mis. `D14`, `baris 5`). Semua pesan
ditulis dalam Bahasa Indonesia.

