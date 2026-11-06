// Menyusun dan menulis file mapel berformat MAPEL FIX.xlsx.

import ExcelJS from 'exceljs';
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
