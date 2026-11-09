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
      baris.push({ category: h.hariKe, format: 'singleactivity', shortname, fullname: `${m.namaLengkap} ${tingkat}` });
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
