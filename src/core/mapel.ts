// Menyusun dan menulis file mapel berformat MAPEL FIX.xlsx.

import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { cariMapel } from './kamus';
import type { BarisMapel, HasilCocok, Kamus } from './tipe';

export const PREFIX = 'USBK';

/**
 * Hanya hasil berstatus `cocok` yang dipakai; `duplikat` dan `tidak-dikenal`
 * dilewati. Setiap shortname muncul sekali, urut berdasarkan category.
 */
export function susunBarisMapel(hasil: HasilCocok[], tingkat: string, kamus: Kamus): BarisMapel[] {
  const baris: BarisMapel[] = [];
  const ada = new Set<string>();
  for (const h of hasil) {
    if (h.status !== 'cocok') continue;
    for (const kode of h.kode) {
      const m = cariMapel(kamus, kode);
      if (!m) continue;
      const shortname = `${PREFIX}-${tingkat}-${m.kode}`;
      if (ada.has(shortname)) continue;
      ada.add(shortname);
      baris.push({ category: h.hariKe, format: 'singleactivity', shortname, fullname: `${m.namaLengkap} ${tingkat}`.toUpperCase() });
    }
  }
  // sort stabil: urutan kemunculan dipertahankan di dalam category yang sama
  return baris.sort((a, b) => a.category - b.category);
}

export async function tulisMapelXlsx(baris: BarisMapel[]): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.columns = [
    { header: 'category', key: 'category', width: 10 },
    { header: 'format', key: 'format', width: 16 },
    { header: 'shortname', key: 'shortname', width: 36 },
    { header: 'fullname', key: 'fullname', width: 32 },
  ];
  for (const b of baris) ws.addRow(b);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

/** Urutan kelas di dalam setiap category pada file gabungan (permintaan sekolah): XII, X, lalu XI. */
export const URUTAN_GABUNG = ['XII', 'X', 'XI'];

/** Tingkat yang dikonvert untuk "semua kelas": XII, X, XI dulu, tingkat lain menyusul sesuai urutan di file. */
export function urutGabung(tingkat: readonly string[]): string[] {
  return [...URUTAN_GABUNG.filter((t) => tingkat.includes(t)), ...tingkat.filter((t) => !URUTAN_GABUNG.includes(t))];
}

/**
 * Menggabungkan hasil semua kelas ke satu daftar mapel. Urut berdasarkan category (hari ke-N),
 * lalu kelas sesuai `urutGabung`, lalu urutan kemunculan di jadwal.
 */
export function susunBarisMapelSemua(perTingkat: { tingkat: string; hasil: HasilCocok[] }[], kamus: Kamus): BarisMapel[] {
  const urutan = urutGabung(perTingkat.map((p) => p.tingkat));
  const semua = urutan.flatMap((t, rank) => {
    const p = perTingkat.find((x) => x.tingkat === t)!;
    return susunBarisMapel(p.hasil, t, kamus).map((b, i) => ({ b, rank, i }));
  });
  return semua.sort((x, y) => x.b.category - y.b.category || x.rank - y.rank || x.i - y.i).map((x) => x.b);
}

/**
 * CSV untuk upload mapel (mis. Moodle "Upload courses"): header category,format,shortname,fullname,
 * pemisah koma, UTF-8 tanpa BOM, akhir baris CRLF. Nilai berisi koma/kutip otomatis dikutip.
 */
export function tulisMapelCsv(baris: BarisMapel[]): string {
  return Papa.unparse(
    { fields: ['category', 'format', 'shortname', 'fullname'], data: baris.map((b) => [b.category, b.format, b.shortname, b.fullname]) },
    { newline: '\r\n' },
  );
}

// ---------- edit operator di pratinjau ----------

export type KolomMapel = 'category' | 'format' | 'shortname' | 'fullname';

/** Perubahan operator per baris, dengan kunci shortname asli hasil konversi. */
export type EditMapel = Record<string, Partial<BarisMapel>>;

/**
 * Mengembalikan edit baru setelah satu sel diubah. Nilai yang sama dengan hasil konversi
 * menghapus editnya. Input tidak diubah.
 */
export function ubahSelMapel(edit: EditMapel, asli: BarisMapel, kolom: KolomMapel, nilai: string): EditMapel {
  const rapi = nilai.trim().replace(/\s+/g, ' ');
  const baru: Partial<BarisMapel> = { ...(edit[asli.shortname] ?? {}) };
  // category kosong atau bukan angka → NaN, ditolak oleh periksaEditMapel
  const isi: string | number = kolom === 'category' ? (rapi === '' ? Number.NaN : Number(rapi)) : rapi;
  if (isi === asli[kolom]) delete baru[kolom];
  else (baru as Record<KolomMapel, string | number>)[kolom] = isi;
  const hasil = { ...edit };
  if (Object.keys(baru).length) hasil[asli.shortname] = baru;
  else delete hasil[asli.shortname];
  return hasil;
}

export interface BarisDiedit {
  /** Baris hasil konversi (kunci edit = asli.shortname). */
  asli: BarisMapel;
  /** Baris setelah edit operator; inilah yang ditulis ke file. */
  hasil: BarisMapel;
}

/** Menerapkan edit operator; urutan dipertahankan, lalu diurutkan stabil menurut category. */
export function terapkanEditMapel(baris: BarisMapel[], edit: EditMapel): BarisDiedit[] {
  return baris
    .map((asli, i) => ({ asli, hasil: { ...asli, ...(edit[asli.shortname] ?? {}) }, i }))
    .sort((x, y) => (x.hasil.category || 0) - (y.hasil.category || 0) || x.i - y.i)
    .map(({ asli, hasil }) => ({ asli, hasil }));
}

/** Masalah pada hasil edit yang membuat file belum boleh diunduh. */
export function periksaEditMapel(baris: BarisMapel[]): string[] {
  const masalah: string[] = [];
  const kategoriSalah = baris.filter((b) => !Number.isInteger(b.category) || b.category < 1);
  if (kategoriSalah.length) masalah.push(`category harus angka bulat 1 atau lebih (${kategoriSalah.map((b) => b.shortname || '?').join(', ')})`);
  const kosong = baris.filter((b) => !b.format || !b.shortname || !b.fullname);
  if (kosong.length) masalah.push(`${kosong.length} baris punya format, shortname, atau fullname yang kosong`);
  const hitung = new Map<string, number>();
  for (const b of baris) if (b.shortname) hitung.set(b.shortname, (hitung.get(b.shortname) ?? 0) + 1);
  const kembar = [...hitung].filter(([, n]) => n > 1).map(([s]) => s);
  if (kembar.length) masalah.push(`shortname harus unik: ${kembar.join(', ')} dipakai lebih dari sekali`);
  return masalah;
}
