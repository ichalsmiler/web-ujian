import { describe, expect, it } from 'vitest';
import { bacaUser, keCbt } from '../../src/core/user';
import type { PesertaMasuk } from '../../src/core/tipe';
import { bacaFixture } from './bantu';

// Format lama (USER MOODLE.csv) tetap didukung, dengan aturan pemetaan yang sama.
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

describe('keCbt — format lama', () => {
  it('baris 1: Nama Rombel = Kelas / Jurusan = kelas, Kel. Sesi = 1', () => {
    expect(keCbt(peserta)[0]).toEqual({
      namaPeserta: 'Siswa Contoh Satu',
      namaRombel: 'XII-1',
      kelasJurusan: 'XII-1',
      ruang: 1,
      kelSesi: 1,
      username: '00-000-0001',
      password: 'AB12CD',
    });
  });

  it('Kelas / Jurusan selalu sama dengan Nama Rombel', () => {
    for (const department of ['XII-1', 'X 3', 'Kelas Khusus']) {
      const [c] = keCbt([masuk({ department })]);
      expect(c.kelasJurusan).toBe(c.namaRombel);
    }
  });

  it('Ruang angka bulat → angka; selain itu kosong', () => {
    const r = (address: string) => keCbt([masuk({ address })])[0].ruang;
    expect(r('1')).toBe(1);
    expect(r(' 12 ')).toBe(12);
    expect(r('')).toBeNull();
    expect(r('Jl. Mawar')).toBeNull();
    expect(r('1.5')).toBeNull();
  });

  it('nama berakhiran titik tidak diubah', () => {
    expect(keCbt(peserta)[3].namaPeserta).toBe('SISWA CONTOH EMPAT.');
  });

  it('lastname yang sama dengan rombel tidak ditambahkan; lastname lain ditambahkan', () => {
    const k = (lastname: string) => keCbt([masuk({ firstname: 'Budi', lastname })])[0].namaPeserta;
    expect(k('XII-1')).toBe('Budi');
    expect(k('')).toBe('Budi');
    expect(k('Santoso')).toBe('Budi Santoso');
  });

  it('password yang sudah ada di file dipertahankan', () => {
    const c = keCbt(peserta);
    expect(c[1].password).toBe('07AB12');
    expect(c.every((p) => p.kelSesi === 1)).toBe(true);
  });
});
