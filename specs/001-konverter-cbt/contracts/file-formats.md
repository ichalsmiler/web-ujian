# Contract: Format File

Kontrak ini menjadi acuan tes fixture (Prinsip IV). Perubahan di sini **harus**
diikuti perubahan tes.

## Input 1 — Jadwal (`.xlsx`)

- Satu atau lebih sheet; operator memilih satu.
- Baris header: ada sel berisi `HARI/TGL` (huruf besar/kecil diabaikan).
- Di baris header: `JAM`, lalu untuk setiap tingkat pasangan `WAKTU` +
  `KELAS <X|XI|XII|…>`.
- Data per hari = 2 baris berurutan:
  - baris sesi I: kolom HARI/TGL berisi nama hari, kolom JAM `I`;
  - baris sesi II: kolom HARI/TGL berisi tanggal (nilai tanggal, rumus, atau
    teks `DD <Bulan> YYYY`), kolom JAM `II`.
- Hari susulan: semua sel mapel berisi `SUSULAN` (boleh hanya 1 baris; sel
  boleh di-merge).
- Sel mapel: satu atau lebih nama dipisah koma.
- Data berakhir pada baris pertama yang kolom HARI/TGL dan semua kolom mapelnya
  kosong.

**Galat yang harus dilaporkan**: header tidak ditemukan; tidak ada kolom
`KELAS …`; tidak ada satu pun hari dengan mapel.

## Input 2 — User (`.csv` atau `.xlsx`)

- CSV: pemisah `;` atau `,` (dideteksi otomatis), UTF-8 (dengan atau tanpa BOM)
  atau Windows-1252. XLSX: sheet pertama.
- Baris pertama berisi nama kolom. Kolom wajib: `username`, `firstname`,
  `department`.
- Contoh baris: `00-000-0001;AB12CD;Siswa Contoh Satu; XII-1 ;…; XII-1 ;1;USBK-XII-…`

**Galat**: kolom wajib tidak ada (sebutkan namanya); file kosong.

## Output 1 — Mapel (`MAPEL <TINGKAT>.xlsx`)

| Baris | A | B | C | D |
| --- | --- | --- | --- | --- |
| 1 | `category` | `format` | `shortname` | `fullname` |
| 2… | angka ≥ 1 | `singleactivity` | `USBK-<TINGKAT>-<KODE>` | `<NAMA LENGKAP> <TINGKAT>` |

Satu sheet, tanpa baris kosong di antara data, tanpa kolom tambahan.

**Contoh yang diharapkan** (tingkat XII, `jadwal-2026.xlsx`, kamus awal,
setelah 6 nama yang tidak dikenal dipilih operator), baris pertama:

```text
1 | singleactivity | USBK-XII-MATEMATIKA | Matematika XII
1 | singleactivity | USBK-XII-BINDO      | BHS INDONESIA XII
2 | singleactivity | USBK-XII-PENDIDIKAN PANCASILA | PENDIDIKAN PANCASILA XII
2 | singleactivity | USBK-XII-SENI BUDAYA | SENI BUDAYA XII
3 | singleactivity | USBK-XII-PAI        | AGAMA ISLAM XII
3 | singleactivity | USBK-XII-PAK        | AGAMA KRISTEN XII
3 | singleactivity | USBK-XII-BING       | BHS INGGRIS XII
```

## Output 2 — User CBTAdmin (`USER CBTADMIN <YYYY-MM-DD>.xlsx`)

- Sheet tunggal `template_dokumen_aiocbt`.
- Baris 1–8: sama persis dengan template (judul `[[ Template Upload User
  CBTAdmin ]]`, baris 3 "Petunjuk Singkat…", baris 4–7 petunjuk kolom, baris 2
  dan 8 kosong). A1 tetap tebal, lebar kolom tetap.
- Baris 9: `Nama Peserta | Nama Rombel | Kelas / Jurusan | Ruang | Kel. Sesi |
  Username | Password`.
- Baris 10…: satu baris per peserta, urut sesuai file input. `Ruang` bertipe
  angka, `Password` bertipe teks.

Contoh (dari baris 1 fixture `tests/fixtures/users-sample.csv`, `kelasJurusan = tingkat`):

```text
Siswa Contoh Satu | XII-1 | XII | 1 | (kosong) | 00-000-0001 | AB12CD
```
