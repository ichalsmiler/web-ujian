import { describe, expect, it } from 'vitest';
import {
  bacaFileMoving,
  cocokkanMoving,
  kemiripan,
  kunciPasangan,
  movingPerSiswa,
  nomorKelas,
  PETA_MAPEL_MOVING,
} from '../../src/core/moving';
import { GalatFormat, type PesertaMasuk } from '../../src/core/tipe';
import { bukuContohMoving } from './contoh-moving';

const p = (username: string, firstname: string, department: string): PesertaMasuk => ({
  username,
  password: 'AB12CD',
  firstname,
  lastname: '',
  department,
  address: '1',
  course: [],
  baris: 8,
  sheet: 'KLS. XI',
});

// Peserta kelas XI palsu (KELAS masih kelas lama "X-…", seperti data sekolah)
const PESERTA = [
  p('92-26-0001', 'Siswa Contoh Satu', 'X-1'),
  p('92-26-0002', 'Siswa Contoh Dua', 'X-1'),
  p('92-26-0003', 'Andi Murid Bernama Panjang', 'X-2'),
  p('92-26-0004', 'Budi Santoso', 'X-2'),
  p('92-26-0005', 'Budi Santoso', 'X-3'), // nama kembar, beda rombel
  p('92-26-0006', 'Citra Lestari', 'X-3'),
];

const buku = await bukuContohMoving([
  {
    judul: 'BIOLOGI 1',
    siswa: [
      ['SISWA CONTOH SATU', 'XI 1'], // persis (beda huruf besar)
      ['Siswa  Contoh Dua.', 'XI 1'], // persis (spasi & titik)
      ['Andi Murid Bernama Panjanq', 'XI 2'], // salah ketik 1 huruf → mirip
      ['Budi Santoso', 'XI 3'], // kembar → dibedakan rombel
      ['Orang Tidak Dikenal', 'XI 4'], // tidak ada → pilih
    ],
  },
  { judul: 'BIOLOGI 2', siswa: [['C. Lestari', 'XI 3']] }, // singkatan → pilih
]);
const kelompok = await bacaFileMoving(buku, 'DAFTAR HADIR KELAS MOVING XI BIO.xlsx');

describe('bacaFileMoving', () => {
  it('satu kelompok per sheet berisi murid; sheet kosong dilewati', () => {
    expect(kelompok.map((k) => [k.judul, k.siswa.length])).toEqual([
      ['BIOLOGI 1', 5],
      ['BIOLOGI 2', 1],
    ]);
  });

  it('mengenali mapel dari judul dan memetakan ke kode kamus', () => {
    expect(kelompok[0]).toMatchObject({ singkatan: 'BIOLOGI', kode: 'BIOLOGI LANJUTAN', tingkat: 'XI', sheet: '1' });
    expect(kelompok[0].siswa[1]).toMatchObject({ nama: 'Siswa Contoh Dua.', kelas: 'XI 1' });
    expect(kelompok[0].siswa[0].lokasi).toBe('DAFTAR HADIR KELAS MOVING XI BIO.xlsx › 1 baris 5');
  });

  it('jika judul tidak dikenal, mapel diambil dari nama file', async () => {
    const b = await bukuContohMoving([{ judul: 'KELOMPOK A', siswa: [['Siswa Contoh Satu', 'XI 1']] }], false);
    const [k] = await bacaFileMoving(b, 'DAFTAR HADIR KELAS MOVING XI INFOR.xlsx');
    expect(k).toMatchObject({ singkatan: 'INFOR', kode: 'INFORMATIKA' });
  });

  it('pemetaan sesuai keputusan sekolah', () => {
    expect(PETA_MAPEL_MOVING).toMatchObject({
      BING: 'BING LANJUT',
      BIING: 'BING LANJUT',
      BINDO: 'BINDO LANJUT',
      BIOLOGI: 'BIOLOGI LANJUTAN',
      EKONOMI: 'EKONOMI',
      FISIKA: 'FISIKA',
      GEOGRAFI: 'GEOGRAFI',
      INFORMATIKA: 'INFORMATIKA',
      KIMIA: 'KIMIA LANJUT',
      MATEMATIKA: 'MATEMATIKA LANJUT',
      SOSIOLOGI: 'SOSIOLOGI LANJUTAN',
    });
  });

  it('menolak file tanpa daftar murid', async () => {
    const b = await bukuContohMoving([], true);
    await expect(bacaFileMoving(b, 'x.xlsx')).rejects.toThrow(GalatFormat);
  });
});

describe('alat bantu nama', () => {
  it('nomorKelas', () => {
    expect(nomorKelas('XI 3')).toBe('3');
    expect(nomorKelas('XI-12')).toBe('12');
    expect(nomorKelas('X-3')).toBe('3');
    expect(nomorKelas('')).toBe('');
  });
  it('kemiripan mengabaikan huruf besar, spasi, tanda baca', () => {
    expect(kemiripan('Siswa  Contoh Dua.', 'SISWA CONTOH DUA')).toBe(1);
    expect(kemiripan('Andi Murid Bernama Panjanq', 'Andi Murid Bernama Panjang')).toBeGreaterThan(0.9);
    expect(kemiripan('Budi Santoso', 'Citra Lestari')).toBeLessThan(0.3);
  });
});

describe('cocokkanMoving', () => {
  const hasil = cocokkanMoving(kelompok, PESERTA);
  const status = hasil.map((h) => [h.siswa.nama, h.status, h.username]);

  it('persis, mirip, dan pilih', () => {
    expect(status).toEqual([
      ['SISWA CONTOH SATU', 'persis', '92-26-0001'],
      ['Siswa  Contoh Dua.'.replace(/\s+/g, ' '), 'persis', '92-26-0002'],
      ['Andi Murid Bernama Panjanq', 'mirip', '92-26-0003'],
      ['Budi Santoso', 'persis', '92-26-0005'],
      ['Orang Tidak Dikenal', 'pilih', ''],
      ['C. Lestari', 'pilih', ''],
    ]);
  });

  it('kandidat untuk dipilih: yang paling mirip di atas, rombel sama didahulukan', () => {
    const lestari = hasil.find((h) => h.siswa.nama === 'C. Lestari')!;
    expect(lestari.kandidat[0].username).toBe('92-26-0006');
    expect(lestari.kandidat.length).toBeLessThanOrEqual(5);
  });
});

describe('movingPerSiswa', () => {
  const hasil = cocokkanMoving(kelompok, PESERTA);

  it('shortname moving per username', () => {
    const m = movingPerSiswa(hasil, {}, []);
    expect(m.get('92-26-0001')).toEqual(['USBK-XI-BIOLOGI LANJUTAN']);
    expect(m.get('92-26-0003')).toEqual(['USBK-XI-BIOLOGI LANJUTAN']); // hasil "mirip" ikut
    expect(m.has('92-26-0006')).toBe(false); // belum dipilih
  });

  it('pilihan operator menimpa; pilihan kosong = diabaikan', () => {
    const lestari = hasil.find((h) => h.siswa.nama === 'C. Lestari')!;
    const mirip = hasil.find((h) => h.status === 'mirip')!;
    const m = movingPerSiswa(hasil, { [kunciPasangan(lestari)]: '92-26-0006', [kunciPasangan(mirip)]: '' }, []);
    expect(m.get('92-26-0006')).toEqual(['USBK-XI-BIOLOGI LANJUTAN']);
    expect(m.has('92-26-0003')).toBe(false);
  });

  it('entri manual ditambahkan tanpa ganda', () => {
    const m = movingPerSiswa(hasil, {}, [
      { username: '92-26-0001', shortname: 'USBK-XI-FISIKA' },
      { username: '92-26-0001', shortname: 'USBK-XI-BIOLOGI LANJUTAN' },
    ]);
    expect(m.get('92-26-0001')).toEqual(['USBK-XI-BIOLOGI LANJUTAN', 'USBK-XI-FISIKA']);
  });
});

describe('pasanganGanda', async () => {
  const { pasanganGanda } = await import('../../src/core/moving');
  const b = await bukuContohMoving([
    { judul: 'FISIKA 1', siswa: [['Siswa Contoh Satu', 'XI 1']] },
    { judul: 'FISIKA 2', siswa: [['Siswa Contoh Satu', 'XI 1'], ['Citra Lestari', 'XI 3']] },
  ]);
  const kel = await bacaFileMoving(b, 'DAFTAR HADIR KELAS MOVING XI FIS.xlsx');
  const hasil = cocokkanMoving(kel, PESERTA);

  it('menemukan siswa yang terpasang dua kali ke mapel yang sama', () => {
    const g = pasanganGanda(hasil, {});
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ username: '92-26-0001', kode: 'FISIKA' });
    expect(g[0].baris.map((x) => x.kelompok.judul)).toEqual(['FISIKA 1', 'FISIKA 2']);
  });

  it('hilang setelah salah satu baris diabaikan', () => {
    expect(pasanganGanda(hasil, { [kunciPasangan(hasil[1])]: '' })).toEqual([]);
  });
});

describe('tingkat kelas moving: XI hanya dengan XI, XII hanya dengan XII', async () => {
  const { tingkatDariKelasMoving } = await import('../../src/core/moving');
  const { tingkatPeserta } = await import('../../src/core/moodle');

  // Siswa XI dan XII bernama sama persis (pada data asli, KELAS di sheet KLS. XII masih "XI-…")
  const SEMUA = [
    { ...p('92-26-0101', 'Nama Kembar Sekolah', 'X-1'), sheet: 'KLS. XI' },
    { ...p('93-26-0101', 'Nama Kembar Sekolah', 'XI-1'), sheet: 'KLS. XII' },
  ];
  const cocokPerTingkat = (kel: Awaited<ReturnType<typeof bacaFileMoving>>) =>
    [...new Set(kel.map((k) => k.tingkat))].flatMap((t) =>
      cocokkanMoving(kel.filter((k) => k.tingkat === t), SEMUA.filter((q) => tingkatPeserta(q) === t)),
    );

  it('tingkatDariKelasMoving membaca XI / XII dari kolom KELAS', () => {
    expect(tingkatDariKelasMoving(['XI 1', 'XI 2', 'XI-3'])).toBe('XI');
    expect(tingkatDariKelasMoving(['XII 1', 'XII2'])).toBe('XII');
    expect(tingkatDariKelasMoving(['', 'kelas khusus'])).toBe('');
  });

  it('file moving XI dicocokkan dengan siswa XI', async () => {
    const b = await bukuContohMoving([{ judul: 'FISIKA 1', siswa: [['Nama Kembar Sekolah', 'XI 1']] }], false);
    const kel = await bacaFileMoving(b, 'DAFTAR HADIR KELAS MOVING XI FIS.xlsx');
    expect(kel[0].tingkat).toBe('XI');
    const hasil = cocokPerTingkat(kel);
    expect(hasil.map((h) => h.username)).toEqual(['92-26-0101']);
    expect(movingPerSiswa(hasil, {}, []).get('92-26-0101')).toEqual(['USBK-XI-FISIKA']);
  });

  it('file moving XII dicocokkan dengan siswa XII dan memberi mapel USBK-XII-…', async () => {
    const b = await bukuContohMoving([{ judul: 'FISIKA 1', siswa: [['Nama Kembar Sekolah', 'XII 1']] }], false);
    const kel = await bacaFileMoving(b, 'DAFTAR HADIR KELAS MOVING XII FIS.xlsx');
    expect(kel[0].tingkat).toBe('XII');
    const hasil = cocokPerTingkat(kel);
    expect(hasil.map((h) => h.username)).toEqual(['93-26-0101']);
    expect(hasil[0].kandidat.every((k) => k.username.startsWith('93-'))).toBe(true);
    expect(movingPerSiswa(hasil, {}, []).get('93-26-0101')).toEqual(['USBK-XII-FISIKA']);
  });

  it('nama file tanpa tingkat → tingkat dari kolom KELAS', async () => {
    const b = await bukuContohMoving([{ judul: 'FISIKA 1', siswa: [['Nama Kembar Sekolah', 'XII 1']] }], false);
    const [k] = await bacaFileMoving(b, 'DAFTAR HADIR FISIKA.xlsx');
    expect(k.tingkat).toBe('XII');
    expect(k.peringatan).toBeUndefined();
  });

  it('nama file dan kolom KELAS berbeda → tetap ikut nama file, dengan peringatan', async () => {
    const b = await bukuContohMoving([{ judul: 'FISIKA 1', siswa: [['Nama Kembar Sekolah', 'XII 1']] }], false);
    const [k] = await bacaFileMoving(b, 'DAFTAR HADIR KELAS MOVING XI FIS.xlsx');
    expect(k.tingkat).toBe('XI');
    expect(k.peringatan).toMatch(/kelas XI.*kolom KELAS berisi kelas XII/);
  });
});
