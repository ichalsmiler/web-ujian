# Contract: Antarmuka

Satu halaman dengan tiga tab. Semua teks dalam Bahasa Indonesia (FR-019).

## Tab "Jadwal → Mapel"

1. **Upload jadwal** (`.xlsx`). Jika ada >1 sheet, muncul pilihan sheet
   (default: sheet pertama).
2. **Jadwal terbaca**: tabel hari/tanggal × tingkat, hari susulan diberi tanda
   abu-abu. Galat ditampilkan di atas tabel.
3. **Pilih tingkat** (tombol X / XI / XII sesuai header) → tombol **Konvert**
   (nonaktif sampai jadwal terbaca — FR-004).
4. **Pratinjau**: tabel 4 kolom output + jumlah baris. Baris bermasalah:
   - `tidak-dikenal` (merah): dropdown "pilih mapel" + tombol "tambah ke
     kamus"; pilihan disimpan sebagai alias;
   - `duplikat` (kuning): dropdown untuk mengganti mapel, atau "abaikan".
5. **Unduh `MAPEL <TINGKAT>.xlsx`** (nonaktif selama masih ada baris merah).

## Tab "User → CBTAdmin"

1. **Upload user** (`.csv` / `.xlsx`).
2. **Pengaturan** "Kelas / Jurusan diisi dengan": `Tingkat (XII)` / `Rombel
   (XII-1)`.
3. **Pratinjau**: 7 kolom output, jumlah peserta, dan peringatan (baris
   dilewati, dsb.). Password ditampilkan tersamar (`••••`) dengan tombol
   "tampilkan".
4. **Unduh `USER CBTADMIN <tanggal>.xlsx`**.
5. Jika file jadwal sudah dikonvert di tab pertama: panel "Kode mapel tidak
   cocok", berisi daftar kode `course1..14` yang tidak ada di hasil mapel
   (Edge Case spec).

## Tab "Kamus Mapel"

Tabel kode / nama lengkap / alias, bisa tambah, ubah, dan hapus. Tombol
**Ekspor JSON**, **Impor JSON**, dan **Kembalikan ke awal**.

## Status bersama

- Tidak ada data siswa yang tersimpan setelah halaman ditutup.
- Kamus dan pengaturan dimuat dari `localStorage` saat halaman dibuka.
