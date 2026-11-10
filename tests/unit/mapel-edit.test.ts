import { describe, expect, it } from 'vitest';
import { periksaEditMapel, terapkanEditMapel, tulisMapelCsv, ubahSelMapel } from '../../src/core/mapel';
import type { BarisMapel } from '../../src/core/tipe';

const r = (category: number, shortname: string, fullname: string): BarisMapel => ({ category, format: 'singleactivity', shortname, fullname });
const BARIS = [r(1, 'USBK-XI-MATEMATIKA', 'MATEMATIKA XI'), r(1, 'USBK-XI-BINDO', 'BHS INDONESIA XI'), r(2, 'USBK-XI-PJOK', 'PJOK XI')];

describe('ubahSelMapel', () => {
  it('mencatat perubahan per shortname asli dan merapikan spasi', () => {
    const e = ubahSelMapel({}, BARIS[1], 'fullname', '  BAHASA   INDONESIA XI ');
    expect(e).toEqual({ 'USBK-XI-BINDO': { fullname: 'BAHASA INDONESIA XI' } });
  });

  it('category dibaca sebagai angka; kosong menjadi tidak valid', () => {
    expect(ubahSelMapel({}, BARIS[0], 'category', '3')['USBK-XI-MATEMATIKA'].category).toBe(3);
    expect(ubahSelMapel({}, BARIS[0], 'category', '')['USBK-XI-MATEMATIKA'].category).toBeNaN();
  });

  it('mengembalikan nilai asli menghapus editnya; input tidak diubah', () => {
    const e1 = ubahSelMapel({}, BARIS[0], 'shortname', 'USBK-XI-MTK');
    const e2 = ubahSelMapel(e1, BARIS[0], 'shortname', 'USBK-XI-MATEMATIKA');
    expect(e2).toEqual({});
    expect(e1).toEqual({ 'USBK-XI-MATEMATIKA': { shortname: 'USBK-XI-MTK' } });
    expect(ubahSelMapel({}, BARIS[0], 'category', '1')).toEqual({});
  });
});

describe('terapkanEditMapel', () => {
  it('menerapkan edit, menyimpan baris asli, dan mengurutkan ulang menurut category', () => {
    const e = { 'USBK-XI-MATEMATIKA': { category: 2, shortname: 'USBK-XI-MTK' } };
    const d = terapkanEditMapel(BARIS, e);
    expect(d.map((x) => x.hasil.shortname)).toEqual(['USBK-XI-BINDO', 'USBK-XI-MTK', 'USBK-XI-PJOK']);
    expect(d[1].asli.shortname).toBe('USBK-XI-MATEMATIKA');
    expect(BARIS[0].shortname).toBe('USBK-XI-MATEMATIKA');
  });

  it('hasil edit yang dipakai di file unduhan', () => {
    const baris = terapkanEditMapel(BARIS, { 'USBK-XI-PJOK': { fullname: 'PENJASKES XI' } }).map((x) => x.hasil);
    expect(tulisMapelCsv(baris).split('\r\n')[3]).toBe('2,singleactivity,USBK-XI-PJOK,PENJASKES XI');
  });
});

describe('periksaEditMapel', () => {
  it('tidak ada masalah untuk hasil konversi biasa', () => {
    expect(periksaEditMapel(BARIS)).toEqual([]);
  });

  it('menolak shortname kembar, isian kosong, dan category tidak valid', () => {
    const kembar = periksaEditMapel(terapkanEditMapel(BARIS, { 'USBK-XI-PJOK': { shortname: 'USBK-XI-BINDO' } }).map((x) => x.hasil));
    expect(kembar.join()).toContain('USBK-XI-BINDO');
    expect(periksaEditMapel([{ ...BARIS[0], fullname: '' }])).toHaveLength(1);
    expect(periksaEditMapel([{ ...BARIS[0], category: Number.NaN }])).toHaveLength(1);
    expect(periksaEditMapel([{ ...BARIS[0], category: 1.5 }])).toHaveLength(1);
  });
});
