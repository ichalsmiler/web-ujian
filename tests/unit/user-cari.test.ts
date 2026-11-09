import { describe, expect, it } from 'vitest';
import { cariPeserta } from '../../src/core/user';
import type { PesertaCBT } from '../../src/core/tipe';

const p = (namaPeserta: string, username: string, namaRombel: string): PesertaCBT => ({
  namaPeserta,
  namaRombel,
  kelasJurusan: namaRombel,
  ruang: 1,
  kelSesi: 1,
  username,
  password: 'AB12CD',
});

const DATA = [
  p('Siswa Contoh Satu', '91-26-0001', 'X-1'),
  p('SISWA CONTOH DUA', '91-26-0002', 'X-2'),
  p('A. Budi Santoso', '92-26-0001', 'XI-3'),
  p('Budi Hartono', '93-26-0001', 'XII-3'),
];
const user = (k: string) => cariPeserta(DATA, k).map((x) => x.username);

describe('cariPeserta', () => {
  it('kueri kosong = semua', () => {
    expect(user('')).toHaveLength(4);
    expect(user('   ')).toHaveLength(4);
  });
  it('nama, tidak peka huruf besar/kecil dan tanda baca', () => {
    expect(user('contoh dua')).toEqual(['91-26-0002']);
    expect(user('a. budi santoso')).toEqual(['92-26-0001']);
    expect(user('BUDI')).toEqual(['92-26-0001', '93-26-0001']);
  });
  it('nomor ujian, dengan atau tanpa tanda hubung', () => {
    expect(user('92-26-0001')).toEqual(['92-26-0001']);
    expect(user('9226')).toEqual(['92-26-0001']);
  });
  it('kelas, dan gabungan beberapa kata', () => {
    expect(user('budi xii-3')).toEqual(['93-26-0001']);
    expect(user('x-2')).toEqual(['91-26-0002']);
  });
  it('tidak ada yang cocok', () => {
    expect(user('zzz')).toEqual([]);
  });
});
