import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { bacaUser, buatPassword, isiPassword, keCbt, tulisCbtXlsx } from '../../src/core/user';
import { bacaFixture } from './bantu';
import { bukuContohPeserta } from './contoh-peserta';

const buku = await bukuContohPeserta();
const hasil = await bacaUser(buku, 'DATA PESERTA NO UJIAN.xlsx');

/** Sumber acak tetap untuk tes: berputar pada daftar angka. */
function acakTetap(angka: number[]): () => number {
  let i = 0;
  return () => angka[i++ % angka.length];
}

describe('bacaUser — format DATA PESERTA NO UJIAN', () => {
  it('membaca semua sheet peserta, urut sesuai file', () => {
    expect(hasil.sheet).toEqual(['KLS. X', 'KLS. XI', 'KLS. XII']);
    expect(hasil.peserta.map((p) => p.username)).toEqual([
      '91-26-0001', '91-26-0002', '91-26-0004', '92-26-0001', '92-26-0002', '93-26-0001',
    ]);
  });

  it('memetakan NAMA SISWA, KELAS, RG., dan nomor UJIAN', () => {
    expect(hasil.peserta[0]).toMatchObject({
      username: '91-26-0001',
      password: '',
      firstname: 'Siswa Contoh Satu',
      department: 'X-1',
      address: '1',
      sheet: 'KLS. X',
      baris: 8,
    });
    expect(hasil.peserta[2].address).toBe('2'); // RG. berupa teks juga terbaca
  });

  it('melewati nomor ujian tanpa nama, dengan keterangan', () => {
    const info = hasil.peringatan.filter((p) => p.tingkat === 'info');
    expect(info).toHaveLength(2);
    expect(info[0]).toMatchObject({ lokasi: 'KLS. X baris 10' });
    expect(info[0].pesan).toMatch(/91-26-0003/);
  });

  it('memperingatkan jika KELAS tidak cocok dengan nama sheet', () => {
    const p = hasil.peringatan.filter((x) => x.tingkat === 'peringatan');
    expect(p).toHaveLength(1);
    expect(p[0].lokasi).toBe('KLS. XI');
    expect(p[0].pesan).toMatch(/X-1, X-2/);
    expect(p[0].pesan).toMatch(/kelas XI/);
  });

  it('mengabaikan tabel bantu di kanan tabel peserta', () => {
    expect(hasil.peserta.filter((p) => p.sheet === 'KLS. X')).toHaveLength(3);
  });

  it('menolak file Excel tanpa tabel peserta yang dikenal', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Data').addRow(['Nama', 'Alamat']);
    await expect(bacaUser((await wb.xlsx.writeBuffer()) as ArrayBuffer, 'x.xlsx')).rejects.toThrow(/UJIAN/);
  });
});

describe('buatPassword', () => {
  it('2 huruf kapital, 2 angka, 2 huruf kapital — mis. HJ86KL', () => {
    for (let i = 0; i < 200; i++) expect(buatPassword()).toMatch(/^[A-Z]{2}[0-9]{2}[A-Z]{2}$/);
  });

  it('memakai sumber acak yang diberikan', () => {
    // 0 → A / 0, 0.999 → Z / 9
    expect(buatPassword(acakTetap([0, 0.999, 0, 0.999, 0, 0.999]))).toBe('AZ09AZ');
  });
});

describe('isiPassword', () => {
  it('mengisi password kosong saja dan tidak mengubah input', () => {
    const awal = [{ ...hasil.peserta[0] }, { ...hasil.peserta[1], password: 'LAMA01' }];
    const isi = isiPassword(awal);
    expect(isi[0].password).toMatch(/^[A-Z]{2}[0-9]{2}[A-Z]{2}$/);
    expect(isi[1].password).toBe('LAMA01');
    expect(awal[0].password).toBe('');
  });

  it('tidak menghasilkan password ganda dalam satu file', () => {
    // sumber acak yang selalu sama dulu, lalu berubah: password kedua harus dibuat ulang
    const acak = acakTetap([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
    const isi = isiPassword(hasil.peserta.slice(0, 2), acak);
    expect(isi[0].password).toBe('AA00AA');
    expect(isi[1].password).not.toBe('AA00AA');
  });
});

describe('keCbt — aturan sekolah', () => {
  const cbt = keCbt(isiPassword(hasil.peserta, acakTetap([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7])));

  it('Nama Rombel dan Kelas / Jurusan sama-sama dari kolom KELAS; Kel. Sesi = 1', () => {
    expect(cbt[0]).toMatchObject({
      namaPeserta: 'Siswa Contoh Satu',
      namaRombel: 'X-1',
      kelasJurusan: 'X-1',
      ruang: 1,
      kelSesi: 1,
      username: '91-26-0001',
    });
    expect(cbt.every((p) => p.kelSesi === 1)).toBe(true);
  });

  it('spasi berlebih di nama dirapikan', () => {
    expect(cbt[1].namaPeserta).toBe('SISWA CONTOH DUA');
  });

  it('file CBTAdmin berisi Kel. Sesi angka 1 dan password teks', async () => {
    const buf = await tulisCbtXlsx(cbt, bacaFixture('template-cbtadmin.xlsx'));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    const ws = wb.worksheets[0];
    expect(ws.getCell('E10').value).toBe(1);
    expect(ws.getCell('B10').value).toBe('X-1');
    expect(ws.getCell('C10').value).toBe('X-1');
    expect(ws.getCell('F10').value).toBe('91-26-0001');
    expect(String(ws.getCell('G10').value)).toMatch(/^[A-Z]{2}[0-9]{2}[A-Z]{2}$/);
    expect(ws.rowCount).toBe(9 + cbt.length);
  });
});
