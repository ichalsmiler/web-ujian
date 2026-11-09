import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { bacaUser, keCbt, tulisCbtXlsx } from '../../src/core/user';
import { bacaFixture } from './bantu';

const template = bacaFixture('template-cbtadmin.xlsx');
const { peserta } = await bacaUser(bacaFixture('users-sample.csv'), 'users-sample.csv');
const cbt = keCbt(peserta);

async function muat(buf: ArrayBuffer): Promise<ExcelJS.Worksheet> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  expect(wb.worksheets).toHaveLength(1);
  return wb.worksheets[0];
}

describe('tulisCbtXlsx', async () => {
  const hasil = await muat(await tulisCbtXlsx(cbt, template));
  const acuan = await muat(template);

  it('memakai sheet template_dokumen_aiocbt', () => {
    expect(hasil.name).toBe('template_dokumen_aiocbt');
  });

  it('baris 1–9 sama persis dengan template', () => {
    for (let r = 1; r <= 9; r++) {
      expect(hasil.getRow(r).values, `baris ${r}`).toEqual(acuan.getRow(r).values);
    }
    expect(hasil.getCell('A1').value).toBe('[[ Template Upload User CBTAdmin ]]');
    expect((hasil.getRow(9).values as unknown[]).slice(1)).toEqual([
      'Nama Peserta', 'Nama Rombel', 'Kelas / Jurusan', 'Ruang', 'Kel. Sesi', 'Username', 'Password',
    ]);
  });

  it('A1 tetap tebal dan lebar kolom tetap', () => {
    expect(hasil.getCell('A1').font?.bold).toBe(true);
    for (const k of ['A', 'B', 'C', 'D', 'F', 'G']) {
      expect(hasil.getColumn(k).width, k).toBe(acuan.getColumn(k).width);
    }
  });

  it('data mulai baris 10, urut sesuai input', () => {
    expect(hasil.rowCount).toBe(9 + cbt.length);
    expect((hasil.getRow(10).values as unknown[]).slice(1)).toEqual([
      'Siswa Contoh Satu', 'XII-1', 'XII-1', 1, 1, '00-000-0001', 'AB12CD',
    ]);
    for (let i = 0; i < cbt.length; i++) {
      expect(hasil.getCell(10 + i, 6).value).toBe(cbt[i].username);
    }
  });

  it('Ruang bertipe angka, Password bertipe teks', () => {
    expect(typeof hasil.getCell('D10').value).toBe('number');
    expect(hasil.getCell('G11').value).toBe('07AB12');
    expect(hasil.getCell('G11').numFmt).toBe('@');
    expect(hasil.getCell('F11').numFmt).toBe('@');
  });

  it('tidak mengubah buffer template asli', async () => {
    const lagi = await muat(template);
    expect(lagi.rowCount).toBeLessThanOrEqual(9);
  });
});
