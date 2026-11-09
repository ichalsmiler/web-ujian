import { describe, expect, it } from 'vitest';
import { keMoodle, pengecualianAwal, tingkatPeserta, tulisMoodleCsv, uraiDaftarShortname } from '../../src/core/moodle';
import { bacaUser, isiPassword, keCbt } from '../../src/core/user';
import { bukuContohPeserta } from './contoh-peserta';

const { peserta: mentah } = await bacaUser(await bukuContohPeserta(), 'DATA PESERTA.xlsx');
const peserta = isiPassword(mentah);
const cbt = keCbt(peserta);

const MAPEL = new Map<string, string[]>([
  ['X', ['USBK-X-MATEMATIKA', 'USBK-X-BINDO', 'USBK-X-PAI', 'USBK-X-PAK', 'USBK-X-KKA']],
  ['XI', ['USBK-XI-MATEMATIKA', 'USBK-XI-BINDO', 'USBK-XI-PAI', 'USBK-XI-PAK', 'USBK-XI-FISIKA', 'USBK-XI-KIMIA LANJUT', 'USBK-XI-PKWU', 'USBK-XI-BIOLOGI LANJUTAN']],
  ['XII', ['USBK-XII-MATEMATIKA', 'USBK-XII-PJOK', 'USBK-XII-SEJARAH INDO', 'USBK-XII-EKONOMI']],
]);

describe('pengecualianAwal', () => {
  it('X tidak ada; XI berisi 12 mapel pilihan dari sekolah; XII sama dengan awalan XII', () => {
    const k = pengecualianAwal();
    expect(k.X).toEqual([]);
    expect(k.XI).toEqual([
      'USBK-XI-FISIKA', 'USBK-XI-KIMIA LANJUT', 'USBK-XI-PKWU', 'USBK-XI-BING LANJUT', 'USBK-XI-BINDO LANJUT', 'USBK-XI-SEJARAH INDO',
      'USBK-XI-EKONOMI', 'USBK-XI-GEOGRAFI', 'USBK-XI-MATEMATIKA LANJUT', 'USBK-XI-INFORMATIKA', 'USBK-XI-BIOLOGI LANJUTAN', 'USBK-XI-SOSIOLOGI LANJUTAN',
    ]);
    expect(k.XII).toEqual(k.XI.map((s) => s.replace('USBK-XI-', 'USBK-XII-')));
  });
});

describe('uraiDaftarShortname', () => {
  it('satu per baris, spasi dirapikan, baris kosong dan ganda dibuang', () => {
    expect(uraiDaftarShortname(' USBK-XI-FISIKA \r\n\nUSBK-XI-KIMIA  LANJUT\nUSBK-XI-FISIKA')).toEqual(['USBK-XI-FISIKA', 'USBK-XI-KIMIA LANJUT']);
  });
});

describe('tingkatPeserta', () => {
  it('dari nama sheet dulu, baru dari kelas', () => {
    expect(tingkatPeserta({ sheet: 'KLS. XI', department: 'X-1' })).toBe('XI');
    expect(tingkatPeserta({ department: 'XII-3' })).toBe('XII');
  });
});

describe('keMoodle', () => {
  const hasil = keMoodle(peserta, cbt, MAPEL, pengecualianAwal());

  it('username, password, firstname sama dengan CBTAdmin; lastname = department = kelas; email; address = ruang', () => {
    expect(hasil.baris[0]).toMatchObject({
      username: '91-26-0001',
      password: cbt[0].password,
      firstname: 'Siswa Contoh Satu',
      lastname: 'X-1',
      email: '91-26-0001@smada.id',
      department: 'X-1',
      address: '1',
      tingkat: 'X',
    });
    expect(hasil.baris.map((b) => b.password)).toEqual(cbt.map((c) => c.password));
  });

  it('kelas X mendapat semua shortname X', () => {
    expect(hasil.baris[0].course).toEqual(MAPEL.get('X'));
  });

  it('kelas XI mendapat semua shortname XI kecuali mapel pilihan', () => {
    const xi = hasil.baris.find((b) => b.tingkat === 'XI')!;
    expect(xi.course).toEqual(['USBK-XI-MATEMATIKA', 'USBK-XI-BINDO', 'USBK-XI-PAI', 'USBK-XI-PAK']);
  });

  it('tingkat diambil dari sheet walau KELAS masih kelas lama', () => {
    const xi = hasil.baris.find((b) => b.username === '92-26-0001')!;
    expect(xi.lastname).toBe('X-1');
    expect(xi.tingkat).toBe('XI');
  });

  it('kelas XII mengikuti aturan XI', () => {
    expect(hasil.baris.find((b) => b.tingkat === 'XII')!.course).toEqual(['USBK-XII-MATEMATIKA', 'USBK-XII-PJOK']);
  });

  it('memperingatkan pengecualian yang tidak ada di daftar mapel', () => {
    const p = hasil.peringatan.filter((x) => x.tingkat === 'peringatan');
    expect(p.some((x) => /kelas XI /.test(x.pesan) && x.pesan.includes('USBK-XI-GEOGRAFI'))).toBe(true);
  });

  it('galat jika tingkat siswa belum punya daftar mapel', () => {
    const h = keMoodle(peserta, cbt, new Map([['X', ['USBK-X-MATEMATIKA']]]), pengecualianAwal());
    expect(h.tingkatTanpaMapel.sort()).toEqual(['XI', 'XII']);
    expect(h.peringatan.filter((x) => x.tingkat === 'galat')).toHaveLength(2);
  });
});

describe('tulisMoodleCsv', () => {
  const { baris } = keMoodle(peserta, cbt, MAPEL, pengecualianAwal());
  const csv = tulisMoodleCsv(baris);
  const lines = csv.split('\r\n');

  it('header seperti USER MOODLE.csv: 7 kolom + course1..course14, pemisah titik koma', () => {
    expect(lines[0]).toBe(
      'username;password;firstname;lastname;email;department;address;' + Array.from({ length: 14 }, (_, i) => `course${i + 1}`).join(';'),
    );
  });

  it('baris data, CRLF, diakhiri baris baru, tanpa BOM', () => {
    expect(lines[1]).toBe(`91-26-0001;${cbt[0].password};Siswa Contoh Satu;X-1;91-26-0001@smada.id;X-1;1;USBK-X-MATEMATIKA;USBK-X-BINDO;USBK-X-PAI;USBK-X-PAK;USBK-X-KKA;;;;;;;;;`);
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(lines).toHaveLength(baris.length + 2);
    expect(csv.charCodeAt(0)).not.toBe(0xfeff);
  });

  it('menambah kolom course jika ada siswa dengan lebih dari 14 course', () => {
    const banyak = Array.from({ length: 17 }, (_, i) => `USBK-X-M${i}`);
    const h = tulisMoodleCsv([{ ...baris[0], course: banyak }]).split('\r\n');
    expect(h[0].split(';')).toHaveLength(7 + 17);
    expect(h[0].endsWith('course17')).toBe(true);
  });
});
