import { describe, expect, it } from 'vitest';
import { bacaUser, keCbt } from '../../src/core/user';
import type { PesertaMasuk } from '../../src/core/tipe';
import { bacaFixture } from './bantu';

const { peserta } = await bacaUser(bacaFixture('users-sample.csv'), 'users-sample.csv');

const masuk = (ubah: Partial<PesertaMasuk>): PesertaMasuk => ({
  username: 'u1',
  password: 'p1',
  firstname: 'Nama',
  lastname: '',
  department: 'XII-1',
  address: '1',
  course: [],
  baris: 2,
  ...ubah,
});

describe('keCbt', () => {
  it('baris 1 sesuai contoh di contracts/file-formats.md', () => {
    expect(keCbt(peserta, { kelasJurusan: 'tingkat' })[0]).toEqual({
      namaPeserta: 'Siswa Contoh Satu',
      namaRombel: 'XII-1',
      kelasJurusan: 'XII',
      ruang: 1,
      kelSesi: null,
      username: '00-000-0001',
      password: 'AB12CD',
    });
  });

  it('pengaturan rombel mengisi Kelas / Jurusan dengan nama rombel', () => {
    expect(keCbt(peserta, { kelasJurusan: 'rombel' })[0].kelasJurusan).toBe('XII-1');
  });

  it('tingkat diambil dari bagian romawi rombel', () => {
    const t = (department: string) => keCbt([masuk({ department })], { kelasJurusan: 'tingkat' })[0].kelasJurusan;
    expect(t('XII-1')).toBe('XII');
    expect(t('X 3')).toBe('X');
    expect(t('XI.IPA.2')).toBe('XI');
    expect(t('Kelas Khusus')).toBe('Kelas Khusus');
  });

  it('Ruang angka bulat → angka; selain itu kosong', () => {
    const r = (address: string) => keCbt([masuk({ address })], { kelasJurusan: 'tingkat' })[0].ruang;
    expect(r('1')).toBe(1);
    expect(r(' 12 ')).toBe(12);
    expect(r('')).toBeNull();
    expect(r('Jl. Mawar')).toBeNull();
    expect(r('1.5')).toBeNull();
  });

  it('nama berakhiran titik tidak diubah', () => {
    expect(keCbt(peserta, { kelasJurusan: 'tingkat' })[3].namaPeserta).toBe('SISWA CONTOH EMPAT.');
  });

  it('lastname yang sama dengan rombel tidak ditambahkan; lastname lain ditambahkan', () => {
    const k = (lastname: string) => keCbt([masuk({ firstname: 'Budi', lastname })], { kelasJurusan: 'tingkat' })[0].namaPeserta;
    expect(k('XII-1')).toBe('Budi');
    expect(k('')).toBe('Budi');
    expect(k('Santoso')).toBe('Budi Santoso');
  });

  it('password dan username tetap teks apa adanya', () => {
    const c = keCbt(peserta, { kelasJurusan: 'tingkat' });
    expect(c[1].password).toBe('07AB12');
    expect(c.every((p) => p.kelSesi === null)).toBe(true);
  });
});
