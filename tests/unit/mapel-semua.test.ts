import { describe, expect, it } from 'vitest';
import { bacaJadwal } from '../../src/core/jadwal';
import { cocokkanJadwal, kamusAwal, tambahAlias, tambahMapel } from '../../src/core/kamus';
import { susunBarisMapel, susunBarisMapelSemua, urutGabung } from '../../src/core/mapel';
import type { JadwalUjian } from '../../src/core/tipe';
import { bacaFixture, SHEET_2026 } from './bantu';

const jadwal = await bacaJadwal(bacaFixture('jadwal-2026.xlsx'), SHEET_2026);

let kamus = kamusAwal();
kamus = tambahMapel(kamus, 'KKA', 'KKA', 'KKA');
kamus = tambahMapel(kamus, 'KIMIA', 'KIMIA', 'Kimia');
for (const [teks, kode] of [
  ['Geografi Lanjutan', 'GEOGRAFI'],
  ['Sosiologi Lanjutan', 'SOSIOLOGI'],
  ['Biologi Lanjutan', 'BIOLOGI'],
  ['Informatika Lanjutan', 'INFORMATIKA'],
] as const) {
  kamus = tambahAlias(kamus, teks, kode);
}

const perTingkat = jadwal.tingkat.map((t) => ({ tingkat: t, hasil: cocokkanJadwal(jadwal, t, kamus) }));
const semua = susunBarisMapelSemua(perTingkat, kamus);

describe('urutGabung', () => {
  it('XII, lalu X, lalu XI', () => {
    expect(urutGabung(['X', 'XI', 'XII'])).toEqual(['XII', 'X', 'XI']);
    expect(urutGabung(['XI', 'X'])).toEqual(['X', 'XI']);
  });
});

describe('susunBarisMapelSemua', () => {
  it('category 1 berisi XII dulu, lalu X, lalu XI', () => {
    expect(semua.filter((b) => b.category === 1).map((b) => b.shortname)).toEqual([
      'USBK-XII-MATEMATIKA',
      'USBK-XII-BINDO',
      'USBK-X-MATEMATIKA',
      'USBK-X-BINDO',
      'USBK-XI-MATEMATIKA',
      'USBK-XI-BINDO',
    ]);
  });

  it('setiap category mengikuti urutan XII → X → XI', () => {
    const rank = (s: string) => ({ XII: 0, X: 1, XI: 2 })[s.split('-')[1] as 'XII' | 'X' | 'XI'];
    for (let c = 1; c <= 8; c++) {
      const r = semua.filter((b) => b.category === c).map((b) => rank(b.shortname));
      expect(r, `category ${c}`).toEqual([...r].sort((a, b) => a - b));
    }
  });

  it('category = hari ke-N: 23 Nov = 1 … 3 Des = 8, untuk semua kelas', () => {
    expect([...new Set(semua.map((b) => b.category))]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(semua.find((b) => b.shortname === 'USBK-X-KKA')!.category).toBe(5); // Senin 30 Nov
    expect(semua.find((b) => b.shortname === 'USBK-XI-BIOLOGI')!.category).toBe(8); // Kamis 3 Des
  });

  it('berisi semua baris dari ketiga kelas, tanpa kehilangan atau ganda', () => {
    const jumlah = perTingkat.reduce((n, p) => n + susunBarisMapel(p.hasil, p.tingkat, kamus).length, 0);
    expect(semua).toHaveLength(jumlah);
    expect(new Set(semua.map((b) => b.shortname)).size).toBe(jumlah);
  });
});

describe('category memakai nomor hari jadwal, bukan hitungan per kelas', () => {
  it('kelas yang kosong di suatu hari tetap memakai nomor hari berikutnya yang sama', () => {
    const j: JadwalUjian = {
      namaSheet: 'uji',
      tingkat: ['XII', 'X'],
      kolomTingkat: { XII: 'D', X: 'F' },
      peringatan: [],
      hari: [
        { namaHari: 'Senin', tanggal: null, susulan: false, sesi: [{ nomor: 'I', baris: 5, mapelPerTingkat: { XII: ['Matematika'], X: [] } }] },
        { namaHari: 'Selasa', tanggal: null, susulan: false, sesi: [{ nomor: 'I', baris: 6, mapelPerTingkat: { XII: ['PJOK'], X: ['PJOK'] } }] },
      ],
    };
    const x = cocokkanJadwal(j, 'X', kamusAwal());
    expect(x).toHaveLength(1);
    expect(x[0].hariKe).toBe(2);
  });
});
