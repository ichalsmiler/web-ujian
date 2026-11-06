import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { bacaJadwal, daftarSheet } from '../../src/core/jadwal';
import { GalatFormat } from '../../src/core/tipe';
import { bacaFixture, SHEET_2025, SHEET_2026, utc } from './bantu';

const file = bacaFixture('jadwal-2026.xlsx');

describe('daftarSheet', () => {
  it('menampilkan kedua sheet', async () => {
    expect(await daftarSheet(file)).toEqual([SHEET_2026, SHEET_2025]);
  });
});

describe('bacaJadwal — sheet 2026', async () => {
  const j = await bacaJadwal(file, SHEET_2026);

  it('membaca tingkat dari header, urut sesuai kolom', () => {
    expect(j.tingkat).toEqual(['XII', 'X', 'XI']);
    expect(j.kolomTingkat).toEqual({ XII: 'D', X: 'F', XI: 'H' });
  });

  it('membaca 9 hari dari 23 Nov sampai 4 Des 2026', () => {
    expect(j.hari).toHaveLength(9);
    expect(j.hari.map((h) => h.tanggal)).toEqual([
      utc(2026, 11, 23), utc(2026, 11, 24), utc(2026, 11, 26), utc(2026, 11, 27), utc(2026, 11, 30),
      utc(2026, 12, 1), utc(2026, 12, 2), utc(2026, 12, 3), utc(2026, 12, 4),
    ]);
    expect(j.hari.map((h) => h.namaHari)).toEqual(['Senin', 'Selasa', 'Kamis', 'Jumat', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']);
  });

  it('hanya 4 Des yang bertanda susulan', () => {
    expect(j.hari.map((h) => h.susulan)).toEqual([false, false, false, false, false, false, false, false, true]);
  });

  it('membaca sesi I dan II beserta mapel per tingkat', () => {
    const [s1, s2] = j.hari[0].sesi;
    expect(s1).toMatchObject({ nomor: 'I', baris: 5, mapelPerTingkat: { XII: ['Matematika'], X: ['Matematika'], XI: ['Matematika'] } });
    expect(s2).toMatchObject({ nomor: 'II', baris: 6, mapelPerTingkat: { XII: ['Bahasa Indonesia'] } });
  });

  it('memecah sel berisi beberapa mapel', () => {
    expect(j.hari[3].sesi[1].mapelPerTingkat.XII).toEqual(['Fisika', 'Kimia Lanjutan']);
    expect(j.hari[3].sesi[1].mapelPerTingkat.X).toEqual(['Fisika']);
    expect(j.hari[4].sesi[1].mapelPerTingkat.XII).toEqual(['Bhs. Inggris', 'Bhs. Indonesia Lanjutan']);
  });

  it('tidak membaca blok tanda tangan sebagai hari', () => {
    expect(j.hari.flatMap((h) => h.sesi).every((s) => s.baris <= 22)).toBe(true);
    expect(j.peringatan.filter((p) => p.tingkat === 'galat')).toEqual([]);
  });
});

describe('bacaJadwal — sheet 2025', async () => {
  const j = await bacaJadwal(file, SHEET_2025);

  it('membaca 8 hari, termasuk tanggal berupa teks', () => {
    expect(j.hari).toHaveLength(8);
    expect(j.hari[0].tanggal).toEqual(utc(2025, 11, 26));
    expect(j.hari[7].tanggal).toEqual(utc(2025, 12, 5));
    expect(j.hari.some((h) => h.susulan)).toBe(false);
  });

  it('membaca nama mapel panjang dipisah koma', () => {
    expect(j.hari[4].sesi[1].mapelPerTingkat.XII).toEqual([
      'Bahasa Inggris Tingkat Lanjut',
      'Bahasa Indonesia Tingkat Lanjut',
    ]);
  });
});

describe('bacaJadwal — galat', () => {
  it('menolak workbook tanpa header HARI/TGL', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Data').addRow(['Nama', 'Kelas']);
    const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    await expect(bacaJadwal(buf, 'Data')).rejects.toThrow(GalatFormat);
    await expect(bacaJadwal(buf, 'Data')).rejects.toThrow(/HARI\/TGL/);
  });

  it('menolak header tanpa kolom KELAS', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Data').addRow(['HARI/TGL', 'JAM', 'WAKTU']);
    const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    await expect(bacaJadwal(buf, 'Data')).rejects.toThrow(/KELAS/);
  });

  it('menolak sheet yang tidak ada', async () => {
    await expect(bacaJadwal(file, 'Tidak Ada')).rejects.toThrow(GalatFormat);
  });

  it('memberi peringatan jika tanggal tidak terbaca', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data');
    ws.addRow(['HARI/TGL', 'JAM', 'WAKTU', 'KELAS XII']);
    ws.addRow(['Senin', 'I', '07.30', 'Matematika']);
    ws.addRow(['besok', 'II', '08.30', 'Fisika']);
    const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    const j = await bacaJadwal(buf, 'Data');
    expect(j.hari).toHaveLength(1);
    expect(j.hari[0].tanggal).toBeNull();
    expect(j.peringatan.some((p) => p.tingkat === 'peringatan' && /tanggal/i.test(p.pesan))).toBe(true);
  });
});
