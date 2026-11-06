import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { cariAlias, kamusAwal, normalisasiNama, tambahAlias } from '../../src/core/kamus';
import { GalatFormat } from '../../src/core/tipe';

describe('normalisasiNama', () => {
  it('menyamakan singkatan dan huruf besar/kecil', () => {
    expect(normalisasiNama('Bhs. Inggris')).toBe('bahasa inggris');
    expect(normalisasiNama('BAHASA INGGRIS')).toBe('bahasa inggris');
    expect(normalisasiNama('  Bahasa   Inggris ')).toBe('bahasa inggris');
  });
  it('menyamakan variasi "lanjut"', () => {
    expect(normalisasiNama('Kimia Lanjut')).toBe('kimia lanjutan');
    expect(normalisasiNama('Kimia Lanjutan')).toBe('kimia lanjutan');
    expect(normalisasiNama('Matematika Tingkat Lanjut')).toBe('matematika lanjutan');
  });
});

describe('kamusAwal', () => {
  const kamus = kamusAwal();

  it('berisi 20 mapel dari MAPEL FIX.xlsx dengan kode dan nama lengkap yang sama', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile('tests/fixtures/mapel-fix.xlsx');
    const ws = wb.worksheets[0];
    const dariFile: { kode: string; nama: string }[] = [];
    ws.eachRow((row, n) => {
      if (n === 1) return;
      const short = String(row.getCell(3).value);
      const full = String(row.getCell(4).value);
      dariFile.push({ kode: short.replace(/^USBK-XII-/, ''), nama: full.replace(/ XII$/, '') });
    });
    expect(dariFile).toHaveLength(20);
    expect(kamus.mapel).toHaveLength(20);
    for (const f of dariFile) {
      const m = kamus.mapel.find((x) => x.kode === f.kode);
      expect(m, f.kode).toBeDefined();
      expect(m!.namaLengkap).toBe(f.nama);
    }
  });

  it('nama lengkap disalin apa adanya, termasuk salah ketik LANJT', () => {
    expect(kamus.mapel.find((m) => m.kode === 'BINDO LANJUT')!.namaLengkap).toBe('BHS INDONESIA LANJT');
  });

  it('punya alias tambahan untuk nama di jadwal', () => {
    expect(cariAlias(kamus, 'Bhs. Indonesia Lanjutan')).toEqual(['BINDO LANJUT']);
    expect(cariAlias(kamus, 'Bahasa Inggris Tingkat Lanjut')).toEqual(['BING LANJUT']);
    expect(cariAlias(kamus, 'Sejarah')).toEqual(['SEJARAH INDO']);
    expect(cariAlias(kamus, 'SEJARAH INDONESIA')).toEqual(['SEJARAH INDO']);
    expect(cariAlias(kamus, 'Bahasa Indonesia')).toEqual(['BINDO']);
    expect(cariAlias(kamus, 'Matematika Lanjutan')).toEqual(['MATEMATIKA LANJUT']);
    expect(cariAlias(kamus, 'Kimia Lanjutan')).toEqual(['KIMIA LANJUT']);
    expect(cariAlias(kamus, 'PJOK')).toEqual(['PJOK']);
  });

  it('punya grup Pendidikan Agama → PAI dan PAK', () => {
    expect(cariAlias(kamus, 'Pendidikan Agama')).toEqual(['PAI', 'PAK']);
    expect(cariAlias(kamus, 'PENDIDIKAN AGAMA')).toEqual(['PAI', 'PAK']);
  });

  it('tidak mengenali mapel yang tidak ada di MAPEL FIX', () => {
    for (const n of ['KKA', 'Kimia', 'Geografi Lanjutan', 'Sosiologi Lanjutan', 'Biologi Lanjutan', 'Informatika Lanjutan']) {
      expect(cariAlias(kamus, n), n).toBeNull();
    }
  });

  it('setiap alias hanya menunjuk ke satu entri', () => {
    const semua = [...kamus.mapel.flatMap((m) => m.alias), ...kamus.grup.flatMap((g) => g.alias)];
    expect(new Set(semua).size).toBe(semua.length);
  });
});

describe('tambahAlias', () => {
  it('menambah alias tanpa mengubah kamus asli', () => {
    const asli = kamusAwal();
    const baru = tambahAlias(asli, 'Geografi Lanjutan', 'GEOGRAFI');
    expect(cariAlias(baru, 'Geografi Lanjutan')).toEqual(['GEOGRAFI']);
    expect(cariAlias(asli, 'Geografi Lanjutan')).toBeNull();
  });

  it('menolak alias yang sudah menunjuk ke kode lain', () => {
    expect(() => tambahAlias(kamusAwal(), 'Bahasa Inggris', 'BING LANJUT')).toThrow(GalatFormat);
  });

  it('menolak kode yang tidak ada di kamus', () => {
    expect(() => tambahAlias(kamusAwal(), 'KKA', 'KKA')).toThrow(GalatFormat);
  });

  it('tidak menggandakan alias yang sudah ada untuk kode yang sama', () => {
    const k = tambahAlias(kamusAwal(), 'BAHASA INDONESIA', 'BINDO');
    expect(k.mapel.find((m) => m.kode === 'BINDO')!.alias.filter((a) => a === 'bahasa indonesia')).toHaveLength(1);
  });
});
