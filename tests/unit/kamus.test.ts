import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { cariAlias, kamusAwal, kodeTerbaru, lengkapiKamus, normalisasiNama, shortnameTerbaru, tambahAlias } from '../../src/core/kamus';
import { GalatFormat, type Kamus } from '../../src/core/tipe';

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

  it('berisi mapel dari MAPEL FIX.xlsx (kode dan nama lengkap sama), dengan KIMIA LANJUT diganti KIMIA', async () => {
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
    expect(kamus.mapel.find((m) => m.kode === 'KIMIA LANJUT')).toBeUndefined();
    expect(kamus.mapel.find((m) => m.kode === 'KIMIA')!.namaLengkap).toBe('KIMIA');
    for (const f of dariFile.filter((x) => x.kode !== 'KIMIA LANJUT')) {
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
    expect(cariAlias(kamus, 'PJOK')).toEqual(['PJOK']);
  });

  it('hanya BINDO, BING, MATEMATIKA yang punya kode lanjut; "… Lanjutan" lain memakai kode biasa', () => {
    expect(cariAlias(kamus, 'Kimia Lanjutan')).toEqual(['KIMIA']);
    expect(cariAlias(kamus, 'Kimia Lanjut')).toEqual(['KIMIA']);
    expect(cariAlias(kamus, 'Kimia')).toEqual(['KIMIA']);
    expect(cariAlias(kamus, 'Biologi Lanjutan')).toEqual(['BIOLOGI']);
    expect(cariAlias(kamus, 'Sosiologi Lanjutan')).toEqual(['SOSIOLOGI']);
    expect(cariAlias(kamus, 'Geografi Lanjutan')).toEqual(['GEOGRAFI']);
    expect(cariAlias(kamus, 'Informatika Lanjutan')).toEqual(['INFORMATIKA']);
    expect(cariAlias(kamus, 'Biologi')).toEqual(['BIOLOGI']);
    expect(cariAlias(kamus, 'Sosiologi')).toEqual(['SOSIOLOGI']);
    expect(kamus.mapel.map((m) => m.kode).filter((k) => /LANJUT/.test(k)).sort()).toEqual(['BINDO LANJUT', 'BING LANJUT', 'MATEMATIKA LANJUT']);
  });

  it('punya grup Pendidikan Agama → PAI dan PAK', () => {
    expect(cariAlias(kamus, 'Pendidikan Agama')).toEqual(['PAI', 'PAK']);
    expect(cariAlias(kamus, 'PENDIDIKAN AGAMA')).toEqual(['PAI', 'PAK']);
  });

  it('tidak mengenali mapel yang tidak ada di kamus awal', () => {
    for (const n of ['KKA', 'Ekonomi Lanjutan']) {
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
    const baru = tambahAlias(asli, 'Ekonomi Lanjutan', 'EKONOMI');
    expect(cariAlias(baru, 'Ekonomi Lanjutan')).toEqual(['EKONOMI']);
    expect(cariAlias(asli, 'Ekonomi Lanjutan')).toBeNull();
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

describe('lengkapiKamus', () => {
  /** Kamus tersimpan dari versi 2026-11-09: KIMIA LANJUT, BIOLOGI LANJUTAN, SOSIOLOGI LANJUTAN. */
  const lama = (): Kamus => {
    const k = kamusAwal();
    const buang = new Set(['kimia lanjutan', 'biologi lanjutan', 'sosiologi lanjutan', 'geografi lanjutan']);
    return {
      ...k,
      mapel: [
        ...k.mapel.filter((m) => m.kode !== 'KIMIA').map((m) => ({ ...m, alias: m.alias.filter((a) => !buang.has(a)) })),
        { kode: 'KIMIA LANJUT', namaLengkap: 'Kimia Lanjut', alias: ['kimia lanjutan'] },
        { kode: 'BIOLOGI LANJUTAN', namaLengkap: 'BIOLOGI LANJUTAN', alias: ['biologi lanjutan'] },
        { kode: 'SOSIOLOGI LANJUTAN', namaLengkap: 'SOSIOLOGI LANJUTAN', alias: ['sosiologi lanjutan'] },
      ],
    };
  };

  it('membuang kode lama dan memindahkan nama "… Lanjutan" ke kode biasa', () => {
    const k = lengkapiKamus(lama());
    expect(cariAlias(k, 'Kimia Lanjutan')).toEqual(['KIMIA']);
    expect(cariAlias(k, 'Biologi Lanjutan')).toEqual(['BIOLOGI']);
    expect(cariAlias(k, 'Sosiologi Lanjutan')).toEqual(['SOSIOLOGI']);
    expect(cariAlias(k, 'Geografi Lanjutan')).toEqual(['GEOGRAFI']);
    expect(k.mapel.map((m) => m.kode).filter((x) => /LANJUT/.test(x)).sort()).toEqual(['BINDO LANJUT', 'BING LANJUT', 'MATEMATIKA LANJUT']);
    expect(k.mapel).toHaveLength(20);
  });

  it('tidak menimpa alias yang sudah dipilih operator, dan tidak mengubah input', () => {
    const asli = lama();
    const operator = tambahAlias(asli, 'Geografi Lanjutan', 'EKONOMI');
    const k = lengkapiKamus(operator);
    expect(cariAlias(k, 'Geografi Lanjutan')).toEqual(['EKONOMI']);
    expect(operator.mapel.find((m) => m.kode === 'KIMIA LANJUT')).toBeDefined();
    const semua = [...k.mapel.flatMap((m) => m.alias), ...k.grup.flatMap((g) => g.alias)];
    expect(new Set(semua).size).toBe(semua.length);
  });

  it('tetap menyimpan mapel tambahan operator (mis. KKA)', () => {
    const k = lengkapiKamus({ ...lama(), mapel: [...lama().mapel, { kode: 'KKA', namaLengkap: 'KKA', alias: ['kka'] }] });
    expect(cariAlias(k, 'KKA')).toEqual(['KKA']);
    expect(lengkapiKamus(kamusAwal())).toEqual(kamusAwal());
  });
});

describe('kode lama di data tersimpan', () => {
  it('kodeTerbaru dan shortnameTerbaru', () => {
    expect(kodeTerbaru('KIMIA LANJUT')).toBe('KIMIA');
    expect(kodeTerbaru('BING LANJUT')).toBe('BING LANJUT');
    expect(shortnameTerbaru('USBK-XI-BIOLOGI LANJUTAN')).toBe('USBK-XI-BIOLOGI');
    expect(shortnameTerbaru('USBK-XII-SOSIOLOGI LANJUTAN')).toBe('USBK-XII-SOSIOLOGI');
    expect(shortnameTerbaru('USBK-XI-MATEMATIKA LANJUT')).toBe('USBK-XI-MATEMATIKA LANJUT');
  });
});
