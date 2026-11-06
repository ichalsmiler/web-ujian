import { describe, expect, it } from 'vitest';
import { bacaUser, kodeTidakCocok } from '../../src/core/user';
import { bacaFixture } from './bantu';

const { peserta } = await bacaUser(bacaFixture('users-sample.csv'), 'users-sample.csv');

describe('kodeTidakCocok', () => {
  it('tidak memeriksa apa pun jika jadwal tingkat itu belum dikonvert', () => {
    expect(kodeTidakCocok(peserta, new Map([['X', ['USBK-X-MATEMATIKA']]]))).toEqual({ diperiksa: [], tidakCocok: [] });
  });

  it('menemukan kode di file user yang tidak ada di hasil mapel', () => {
    const mapel = new Map([
      ['XII', ['USBK-XII-MATEMATIKA', 'USBK-XII-MATEMATIKA LANJUT', 'USBK-XII-SEJARAH INDO', 'USBK-XII-PAI', 'USBK-XII-PAK']],
    ]);
    const { diperiksa, tidakCocok } = kodeTidakCocok(peserta, mapel);
    expect(diperiksa).toEqual(['XII']);
    const kode = tidakCocok.map((t) => t.kode);
    // contoh nyata dari spec: MATEMATIKA-L vs MATEMATIKA LANJUT, SEJARAH vs SEJARAH INDO
    expect(kode).toContain('USBK-XII-MATEMATIKA-L');
    expect(kode).toContain('USBK-XII-SEJARAH');
    expect(kode).not.toContain('USBK-XII-MATEMATIKA');
    expect(tidakCocok.find((t) => t.kode === 'USBK-XII-MATEMATIKA-L')!.jumlahPeserta).toBe(2);
    expect(tidakCocok.find((t) => t.kode === 'USBK-XII-SEJARAH')!.jumlahPeserta).toBe(8);
  });
});
