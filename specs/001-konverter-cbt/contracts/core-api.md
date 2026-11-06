# Contract: Modul Inti (`src/core`)

Modul inti tidak menyentuh DOM, sehingga bisa diuji di Node. UI hanya memanggil
fungsi-fungsi berikut. Tipe data mengikuti [data-model.md](../data-model.md).

```ts
// Jadwal
daftarSheet(file: ArrayBuffer): Promise<string[]>
bacaJadwal(file: ArrayBuffer, namaSheet: string): Promise<JadwalUjian>

// Kamus
kamusAwal(): Kamus
normalisasiNama(teks: string): string
cocokkanJadwal(jadwal: JadwalUjian, tingkat: string, kamus: Kamus): HasilCocok[]
tambahAlias(kamus: Kamus, teksAsli: string, kode: string): Kamus   // tidak mengubah objek asli

// Mapel
susunBarisMapel(hasil: HasilCocok[], tingkat: string, kamus: Kamus): BarisMapel[]
tulisMapelXlsx(baris: BarisMapel[]): Promise<ArrayBuffer>

// User
bacaUser(file: ArrayBuffer, namaFile: string): Promise<{ peserta: PesertaMasuk[]; peringatan: Peringatan[] }>
keCbt(peserta: PesertaMasuk[], pengaturan: Pengaturan): PesertaCBT[]
tulisCbtXlsx(peserta: PesertaCBT[], template: ArrayBuffer): Promise<ArrayBuffer>
```

Aturan:

- Fungsi `baca*` melempar `GalatFormat` (berisi pesan Bahasa Indonesia) untuk
  galat yang tercantum di [file-formats.md](./file-formats.md); masalah kecil
  dikembalikan sebagai `peringatan`.
- Fungsi selain `baca*` dan `tulis*` bersifat murni (tanpa I/O, tanpa
  `localStorage`) dan deterministik.
- `tulis*` menghasilkan byte yang, jika dibaca kembali, sama dengan input
  `baris`/`peserta` (diuji dengan round-trip).
