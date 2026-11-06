import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { bacaJadwal } from '../../src/core/jadwal';
import { cocokkanJadwal, kamusAwal, tambahAlias } from '../../src/core/kamus';
import { susunBarisMapel, tulisMapelXlsx } from '../../src/core/mapel';
import type { BarisMapel } from '../../src/core/tipe';
import { bacaFixture, SHEET_2026 } from './bantu';

const jadwal = await bacaJadwal(bacaFixture('jadwal-2026.xlsx'), SHEET_2026);

let kamus = kamusAwal();
for (const [teks, kode] of [
  ['Geografi Lanjutan', 'GEOGRAFI'],
  ['Sosiologi Lanjutan', 'SOSIOLOGI'],
  ['Biologi Lanjutan', 'BIOLOGI'],
  ['Informatika Lanjutan', 'INFORMATIKA'],
] as const) {
  kamus = tambahAlias(kamus, teks, kode);
}
const baris = susunBarisMapel(cocokkanJadwal(jadwal, 'XII', kamus), 'XII', kamus);

describe('susunBarisMapel — XII', () => {
  it('7 baris pertama sama dengan contoh di contracts/file-formats.md', () => {
    const r = (category: number, shortname: string, fullname: string): BarisMapel => ({
      category,
      format: 'singleactivity',
      shortname,
      fullname,
    });
    expect(baris.slice(0, 7)).toEqual([
      r(1, 'USBK-XII-MATEMATIKA', 'Matematika XII'),
      r(1, 'USBK-XII-BINDO', 'BHS INDONESIA XII'),
      r(2, 'USBK-XII-PENDIDIKAN PANCASILA', 'PENDIDIKAN PANCASILA XII'),
      r(2, 'USBK-XII-SENI BUDAYA', 'SENI BUDAYA XII'),
      r(3, 'USBK-XII-PAI', 'AGAMA ISLAM XII'),
      r(3, 'USBK-XII-PAK', 'AGAMA KRISTEN XII'),
      r(3, 'USBK-XII-BING', 'BHS INGGRIS XII'),
    ]);
  });

  it('19 baris, duplikat dibuang, shortname unik', () => {
    expect(baris).toHaveLength(19);
    expect(new Set(baris.map((b) => b.shortname)).size).toBe(19);
    expect(baris.filter((b) => b.shortname === 'USBK-XII-BING')).toHaveLength(1);
  });

  it('urut berdasarkan category', () => {
    const c = baris.map((b) => b.category);
    expect(c).toEqual([...c].sort((a, b) => a - b));
    expect(c.at(-1)).toBe(8);
  });

  it('nama lengkap tidak "diperbaiki"', () => {
    expect(baris.find((b) => b.shortname === 'USBK-XII-BINDO LANJUT')!.fullname).toBe('BHS INDONESIA LANJT XII');
  });

  it('tingkat lain memakai tingkatnya sendiri', () => {
    const x = susunBarisMapel(cocokkanJadwal(jadwal, 'XI', kamus), 'XI', kamus);
    expect(x[0]).toEqual({ category: 1, format: 'singleactivity', shortname: 'USBK-XI-MATEMATIKA', fullname: 'Matematika XI' });
  });
});

describe('tulisMapelXlsx', () => {
  it('round-trip: satu sheet, header & tipe sesuai MAPEL FIX.xlsx', async () => {
    const buf = await tulisMapelXlsx(baris);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    expect(wb.worksheets).toHaveLength(1);
    const ws = wb.worksheets[0];

    const acuan = new ExcelJS.Workbook();
    await acuan.xlsx.load(bacaFixture('mapel-fix.xlsx'));
    const headerAcuan = (acuan.worksheets[0].getRow(1).values as unknown[]).slice(1);
    expect((ws.getRow(1).values as unknown[]).slice(1)).toEqual(headerAcuan);
    expect(headerAcuan).toEqual(['category', 'format', 'shortname', 'fullname']);

    expect(ws.rowCount).toBe(baris.length + 1);
    expect(ws.columnCount).toBe(4);
    const dibaca = [];
    for (let r = 2; r <= ws.rowCount; r++) {
      const v = ws.getRow(r).values as unknown[];
      expect(typeof v[1]).toBe('number');
      dibaca.push({ category: v[1], format: v[2], shortname: v[3], fullname: v[4] });
    }
    expect(dibaca).toEqual(baris);
  });
});
