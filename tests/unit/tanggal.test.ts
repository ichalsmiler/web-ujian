import { describe, expect, it } from 'vitest';
import { uraiTanggal, nilaiSel } from '../../src/core/tanggal';

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

describe('nilaiSel', () => {
  it('mengambil hasil rumus', () => {
    expect(nilaiSel({ formula: 'A6+1', result: utc(2026, 11, 24) })).toEqual(utc(2026, 11, 24));
  });
  it('menggabungkan rich text', () => {
    expect(nilaiSel({ richText: [{ text: 'Bahasa ' }, { text: 'Inggris' }] })).toBe('Bahasa Inggris');
  });
  it('null untuk sel kosong', () => {
    expect(nilaiSel(null)).toBeNull();
    expect(nilaiSel(undefined)).toBeNull();
  });
});

describe('uraiTanggal', () => {
  it('menerima nilai Date', () => {
    expect(uraiTanggal(utc(2026, 11, 23))).toEqual(utc(2026, 11, 23));
  });
  it('menerima hasil rumus ExcelJS', () => {
    expect(uraiTanggal({ formula: 'A6+1', result: utc(2026, 11, 24) })).toEqual(utc(2026, 11, 24));
  });
  it('menerima teks dengan nama bulan Indonesia', () => {
    expect(uraiTanggal('05 Desember 2025')).toEqual(utc(2025, 12, 5));
    expect(uraiTanggal('23 November 2026')).toEqual(utc(2026, 11, 23));
    expect(uraiTanggal(' 1 agustus 2026 ')).toEqual(utc(2026, 8, 1));
  });
  it('menerima nomor seri Excel', () => {
    expect(uraiTanggal(46349)).toEqual(utc(2026, 11, 23));
  });
  it('null untuk teks yang bukan tanggal', () => {
    expect(uraiTanggal('Senin')).toBeNull();
    expect(uraiTanggal('32 Desember 2025')).toBeNull();
    expect(uraiTanggal(null)).toBeNull();
  });
});
