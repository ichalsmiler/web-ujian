import { describe, expect, it } from 'vitest';
import Papa from 'papaparse';
import { tulisMapelCsv } from '../../src/core/mapel';
import { bacaUser, HEADER_CBT, isiPassword, keCbt, tulisCbtCsv } from '../../src/core/user';
import type { BarisMapel } from '../../src/core/tipe';
import { bukuContohPeserta } from './contoh-peserta';

describe('tulisMapelCsv', () => {
  const baris: BarisMapel[] = [
    { category: 1, format: 'singleactivity', shortname: 'USBK-XII-MATEMATIKA', fullname: 'Matematika XII' },
    { category: 1, format: 'singleactivity', shortname: 'USBK-XII-SENI BUDAYA', fullname: 'SENI BUDAYA, TARI XII' },
  ];
  const csv = tulisMapelCsv(baris);

  it('header dan baris sesuai, pemisah koma, akhir baris CRLF, tanpa BOM', () => {
    expect(csv.split('\r\n')).toEqual([
      'category,format,shortname,fullname',
      '1,singleactivity,USBK-XII-MATEMATIKA,Matematika XII',
      '1,singleactivity,USBK-XII-SENI BUDAYA,"SENI BUDAYA, TARI XII"',
    ]);
    expect(csv.charCodeAt(0)).not.toBe(0xfeff);
  });

  it('bisa dibaca ulang tanpa kehilangan data', () => {
    const balik = Papa.parse<string[]>(csv).data;
    expect(balik.slice(1).map((r) => r[3])).toEqual(['Matematika XII', 'SENI BUDAYA, TARI XII']);
  });
});

describe('tulisCbtCsv', async () => {
  const { peserta } = await bacaUser(await bukuContohPeserta(), 'DATA PESERTA.xlsx');
  const cbt = keCbt(isiPassword(peserta));
  const csv = tulisCbtCsv(cbt);
  const baris = Papa.parse<string[]>(csv).data;

  it('baris pertama = header template CBTAdmin', () => {
    expect(baris[0]).toEqual(HEADER_CBT);
    expect(HEADER_CBT).toEqual(['Nama Peserta', 'Nama Rombel', 'Kelas / Jurusan', 'Ruang', 'Kel. Sesi', 'Username', 'Password']);
  });

  it('satu baris per peserta dengan nilai yang sama seperti pratinjau', () => {
    expect(baris).toHaveLength(1 + cbt.length);
    expect(baris[1]).toEqual(['Siswa Contoh Satu', 'X-1', 'X-1', '1', '1', '91-26-0001', cbt[0].password]);
    expect(baris.slice(1).map((r) => r[6])).toEqual(cbt.map((c) => c.password));
  });

  it('ruang kosong ditulis sebagai sel kosong', () => {
    const satu = tulisCbtCsv([{ ...cbt[0], ruang: null }]);
    expect(satu.split('\r\n')[1].split(',')[3]).toBe('');
  });
});
