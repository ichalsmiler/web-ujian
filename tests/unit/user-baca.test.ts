import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { bacaUser } from '../../src/core/user';
import { GalatFormat } from '../../src/core/tipe';
import { bacaFixture } from './bantu';

const csv = bacaFixture('users-sample.csv');
const teks = new TextDecoder().decode(csv);
const keBuffer = (u8: Uint8Array) => u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
const dariTeks = (t: string) => keBuffer(new TextEncoder().encode(t));

describe('bacaUser — CSV', () => {
  it('membaca 8 peserta dari users-sample.csv', async () => {
    const { peserta, peringatan } = await bacaUser(csv, 'users-sample.csv');
    expect(peserta).toHaveLength(8);
    expect(peringatan).toEqual([]);
    expect(peserta[0]).toMatchObject({
      username: '00-000-0001',
      password: 'AB12CD',
      firstname: 'Siswa Contoh Satu',
      lastname: 'XII-1',
      department: 'XII-1',
      address: '1',
      baris: 2,
    });
    expect(peserta[0].course).toHaveLength(14);
    expect(peserta[0].course[0]).toBe('USBK-XII-INFORMATIKA');
  });

  it('pemisah koma menghasilkan data yang sama', async () => {
    const koma = teks.replace(/;/g, ',');
    const a = await bacaUser(csv, 'a.csv');
    const b = await bacaUser(dariTeks(koma), 'b.csv');
    expect(b.peserta).toEqual(a.peserta);
  });

  it('BOM UTF-8 tidak merusak nama kolom pertama', async () => {
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...new Uint8Array(csv)]);
    const { peserta } = await bacaUser(keBuffer(bom), 'bom.csv');
    expect(peserta[0].username).toBe('00-000-0001');
  });

  it('file Windows-1252 (ANSI) tetap terbaca tanpa huruf rusak', async () => {
    const ansi = teks.replace('Siswa Contoh Satu', 'Siswa Contoh Rene');
    const u8 = new TextEncoder().encode(ansi);
    // ganti "e" terakhir pada "Rene" dengan byte 0xE9 (é dalam Windows-1252)
    const posisi = ansi.indexOf('Rene') + 3;
    u8[posisi] = 0xe9;
    const { peserta } = await bacaUser(keBuffer(u8), 'ansi.csv');
    expect(peserta[0].firstname).toBe('Siswa Contoh René');
  });

  it('nama kolom tidak peka huruf besar/kecil dan spasi', async () => {
    const ubah = teks.replace('username;password;firstname', ' USERNAME ;Password; FirstName');
    const { peserta } = await bacaUser(dariTeks(ubah), 'x.csv');
    expect(peserta[0].username).toBe('00-000-0001');
    expect(peserta[0].firstname).toBe('Siswa Contoh Satu');
  });

  it('menolak file tanpa kolom wajib dan menyebut namanya', async () => {
    const tanpa = teks.replace(';department;', ';kelas;');
    await expect(bacaUser(dariTeks(tanpa), 'x.csv')).rejects.toThrow(GalatFormat);
    await expect(bacaUser(dariTeks(tanpa), 'x.csv')).rejects.toThrow(/department/);
  });

  it('menolak file kosong', async () => {
    await expect(bacaUser(dariTeks(''), 'x.csv')).rejects.toThrow(GalatFormat);
    await expect(bacaUser(dariTeks('username;firstname;department\n'), 'x.csv')).rejects.toThrow(/tidak berisi/);
  });

  it('melewati baris dengan username kosong dan memberi peringatan', async () => {
    const baris = teks.trimEnd().split(/\r?\n/);
    baris[3] = baris[3].replace(/^[^;]*/, '');
    const { peserta, peringatan } = await bacaUser(dariTeks(baris.join('\n')), 'x.csv');
    expect(peserta).toHaveLength(7);
    expect(peringatan).toEqual([expect.objectContaining({ tingkat: 'peringatan', lokasi: 'baris 4' })]);
  });

  it('mengabaikan baris yang benar-benar kosong', async () => {
    const { peserta, peringatan } = await bacaUser(dariTeks(teks + '\n\n;;;\n'), 'x.csv');
    expect(peserta).toHaveLength(8);
    expect(peringatan).toEqual([]);
  });
});

describe('bacaUser — XLSX', () => {
  it('membaca sheet pertama file Excel', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data');
    for (const b of teks.trimEnd().split(/\r?\n/)) ws.addRow(b.split(';'));
    // password berawalan nol yang tersimpan sebagai teks harus tetap utuh
    const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    const { peserta } = await bacaUser(buf, 'user.xlsx');
    expect(peserta).toHaveLength(8);
    expect(peserta[1].password).toBe('07AB12');
    expect(peserta[0].department).toBe('XII-1');
  });
});
