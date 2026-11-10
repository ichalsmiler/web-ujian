import { describe, expect, it } from 'vitest';
import { bacaJadwal } from '../../src/core/jadwal';
import { cocokkanJadwal, kamusAwal, kunciPilihan } from '../../src/core/kamus';
import { bacaFixture, SHEET_2026 } from './bantu';

const jadwal = await bacaJadwal(bacaFixture('jadwal-2026.xlsx'), SHEET_2026);
const kamus = kamusAwal();

describe('cocokkanJadwal — XII', () => {
  const hasil = cocokkanJadwal(jadwal, 'XII', kamus);
  const cari = (teks: string) => hasil.filter((h) => h.teksAsli === teks);

  it('category = urutan hari ujian 1–8, susulan tidak dihitung', () => {
    expect([...new Set(hasil.map((h) => h.hariKe))]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(hasil.some((h) => /susulan/i.test(h.teksAsli))).toBe(false);
  });

  it('mencatat lokasi sel sumber', () => {
    expect(hasil[0]).toMatchObject({ teksAsli: 'Matematika', lokasi: 'D5', hariKe: 1, status: 'cocok', kode: ['MATEMATIKA'] });
  });

  it('Pendidikan Agama → PAI dan PAK', () => {
    expect(cari('Pendidikan Agama')[0]).toMatchObject({ status: 'cocok', kode: ['PAI', 'PAK'], hariKe: 3 });
  });

  it('Bhs. Inggris di hari ke-5 → duplikat (BING sudah di hari ke-3)', () => {
    expect(cari('Bahasa Inggris')[0]).toMatchObject({ status: 'cocok', kode: ['BING'], hariKe: 3 });
    expect(cari('Bhs. Inggris')[0]).toMatchObject({ status: 'duplikat', kode: ['BING'], hariKe: 5, lokasi: 'D14' });
  });

  it('mapel pilihan "… Lanjutan" dikenali kamus awal, jadi tidak ada yang tidak-dikenal', () => {
    expect(hasil.filter((h) => h.status === 'tidak-dikenal').map((h) => h.teksAsli)).toEqual([]);
    expect(cari('Biologi Lanjutan')[0]).toMatchObject({ status: 'cocok', kode: ['BIOLOGI'] });
    expect(cari('Sosiologi Lanjutan')[0]).toMatchObject({ status: 'cocok', kode: ['SOSIOLOGI'] });
    expect(cari('Geografi Lanjutan')[0]).toMatchObject({ status: 'cocok', kode: ['GEOGRAFI'] });
    expect(cari('Informatika Lanjutan')[0]).toMatchObject({ status: 'cocok', kode: ['INFORMATIKA'] });
  });

  it('pilihan operator menimpa hasil pencocokan', () => {
    const lokasiBing = cari('Bhs. Inggris')[0].lokasi;
    const pilihan = { [kunciPilihan(lokasiBing, 'Bhs. Inggris')]: ['BING LANJUT'] };
    const h = cocokkanJadwal(jadwal, 'XII', kamus, pilihan).find((x) => x.teksAsli === 'Bhs. Inggris')!;
    expect(h).toMatchObject({ status: 'cocok', kode: ['BING LANJUT'], dipilih: true });
  });

  it('pilihan kosong berarti diabaikan', () => {
    const pilihan = { [kunciPilihan('D14', 'Bhs. Inggris')]: [] };
    const h = cocokkanJadwal(jadwal, 'XII', kamus, pilihan).find((x) => x.teksAsli === 'Bhs. Inggris')!;
    expect(h).toMatchObject({ status: 'cocok', kode: [], dipilih: true });
  });
});

describe('cocokkanJadwal — X', () => {
  it('KKA → tidak-dikenal; Kimia → KIMIA', () => {
    const hasil = cocokkanJadwal(jadwal, 'X', kamusAwal());
    expect(hasil.filter((h) => h.status === 'tidak-dikenal').map((h) => h.teksAsli)).toEqual(['KKA']);
    expect(hasil.find((h) => h.teksAsli === 'Kimia')).toMatchObject({ status: 'cocok', kode: ['KIMIA'] });
    expect(hasil.find((h) => h.teksAsli === 'KKA')!.lokasi).toBe('F13');
  });
});
