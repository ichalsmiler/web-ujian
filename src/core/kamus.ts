import { GalatFormat, type HasilCocok, type JadwalUjian, type Kamus, type Mapel, type PilihanMapel } from './tipe';

/**
 * Menyamakan penulisan nama mapel agar bisa dicocokkan persis:
 * huruf kecil, `bhs.` → `bahasa`, `tingkat lanjut` / `lanjut` → `lanjutan`,
 * tanda baca dibuang, spasi dirapikan.
 */
export function normalisasiNama(teks: string): string {
  return teks
    .toLowerCase()
    .replace(/[.,;:()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\bbhs\b/g, 'bahasa')
    .replace(/\btingkat lanjut(an)?\b/g, 'lanjutan')
    .replace(/\blanjut\b/g, 'lanjutan');
}

/** Kode dan nama lengkap dari MAPEL FIX.xlsx (tanpa awalan USBK-XII- dan akhiran XII). */
const MAPEL_AWAL: [kode: string, namaLengkap: string][] = [
  ['PAI', 'AGAMA ISLAM'],
  ['PAK', 'AGAMA KRISTEN'],
  ['BING', 'BHS INGGRIS'],
  ['MATEMATIKA LANJUT', 'MATEMATIKA LANJUT'],
  ['PENDIDIKAN PANCASILA', 'PENDIDIKAN PANCASILA'],
  ['MATEMATIKA', 'Matematika'],
  ['BIOLOGI', 'BIOLOGI'],
  ['BINDO', 'BHS INDONESIA'],
  ['PKWU', 'PKWU'],
  ['BING LANJUT', 'BHS INGGRIS LANJUT'],
  ['SEJARAH INDO', 'Sejarah Indonesia'],
  ['INFORMATIKA', 'Informatika'],
  ['SOSIOLOGI', 'SOSIOLOGI'],
  ['PJOK', 'PJOK'],
  ['KIMIA LANJUT', 'Kimia Lanjut'],
  ['BINDO LANJUT', 'BHS INDONESIA LANJT'],
  ['GEOGRAFI', 'GEOGRAFI'],
  ['SENI BUDAYA', 'SENI BUDAYA'],
  ['EKONOMI', 'EKONOMI'],
  ['FISIKA', 'FISIKA'],
];

/**
 * Mapel pilihan yang tidak ada di MAPEL FIX.xlsx. Kodenya harus sama dengan kode kelas moving
 * dan daftar mapel pilihan di tab User → Moodle (dikonfirmasi sekolah 2026-11-09).
 */
const MAPEL_TAMBAHAN: [kode: string, namaLengkap: string][] = [
  ['BIOLOGI LANJUTAN', 'BIOLOGI LANJUTAN'],
  ['SOSIOLOGI LANJUTAN', 'SOSIOLOGI LANJUTAN'],
];

/** Alias tambahan karena nama di jadwal berbeda dengan nama lengkap (research.md §6). */
const ALIAS_TAMBAHAN: Record<string, string[]> = {
  // Di jadwal tertulis "… Lanjutan", tetapi kode mapel pilihannya tetap GEOGRAFI / INFORMATIKA.
  GEOGRAFI: ['geografi lanjutan'],
  INFORMATIKA: ['informatika lanjutan'],
  'BINDO LANJUT': ['bahasa indonesia lanjutan'],
  'SEJARAH INDO': ['sejarah'],
  PAI: ['pendidikan agama islam'],
  PAK: ['pendidikan agama kristen'],
};

export function kamusAwal(): Kamus {
  const mapel: Mapel[] = [...MAPEL_AWAL, ...MAPEL_TAMBAHAN].map(([kode, namaLengkap]) => {
    const alias = new Set([normalisasiNama(namaLengkap), normalisasiNama(kode), ...(ALIAS_TAMBAHAN[kode] ?? [])]);
    return { kode, namaLengkap, alias: [...alias] };
  });
  // Alias dari kode (mis. "bindo") tidak boleh bentrok dengan nama lengkap mapel lain.
  return {
    versi: 1,
    mapel: buangAliasGanda(mapel),
    grup: [{ alias: ['pendidikan agama'], kodeAnggota: ['PAI', 'PAK'] }],
  };
}

function buangAliasGanda(mapel: Mapel[]): Mapel[] {
  const pemilik = new Map<string, string>();
  for (const m of mapel) for (const a of m.alias) if (!pemilik.has(a)) pemilik.set(a, m.kode);
  return mapel.map((m) => ({ ...m, alias: m.alias.filter((a) => pemilik.get(a) === m.kode) }));
}

/**
 * Melengkapi kamus tersimpan (dari browser) dengan mapel dan alias kamus awal yang belum ada,
 * mis. setelah aplikasi diperbarui. Isian operator tidak diubah: alias yang sudah dipakai
 * mapel atau grup lain tidak ditambahkan. Input tidak diubah.
 */
export function lengkapiKamus(kamus: Kamus): Kamus {
  const awal = kamusAwal();
  const dipakai = new Set([...kamus.mapel.flatMap((m) => m.alias), ...kamus.grup.flatMap((g) => g.alias)]);
  const ambilBaru = (alias: string[]) => alias.filter((a) => !dipakai.has(a) && (dipakai.add(a), true));
  const mapel = kamus.mapel.map((m) => {
    const dariAwal = cariMapel(awal, m.kode);
    return { ...m, alias: [...m.alias, ...(dariAwal ? ambilBaru(dariAwal.alias) : [])] };
  });
  for (const m of awal.mapel) {
    if (!cariMapel(kamus, m.kode)) mapel.push({ ...m, alias: ambilBaru(m.alias) });
  }
  return { ...kamus, grup: kamus.grup.map((g) => ({ ...g, alias: [...g.alias], kodeAnggota: [...g.kodeAnggota] })), mapel };
}

/** Kode untuk sebuah nama di jadwal (lebih dari satu untuk grup), atau null jika tidak dikenal. */
export function cariAlias(kamus: Kamus, teks: string): string[] | null {
  const n = normalisasiNama(teks);
  if (!n) return null;
  const grup = kamus.grup.find((g) => g.alias.includes(n));
  if (grup) return [...grup.kodeAnggota];
  const m = kamus.mapel.find((x) => x.alias.includes(n));
  return m ? [m.kode] : null;
}

export function cariMapel(kamus: Kamus, kode: string): Mapel | undefined {
  return kamus.mapel.find((m) => m.kode === kode);
}

/** Mengembalikan kamus baru dengan alias `teksAsli` → `kode`. Kamus asli tidak diubah. */
export function tambahAlias(kamus: Kamus, teksAsli: string, kode: string): Kamus {
  const alias = normalisasiNama(teksAsli);
  if (!alias) throw new GalatFormat('Nama mapel kosong tidak bisa dijadikan alias.');
  if (!cariMapel(kamus, kode)) throw new GalatFormat(`Kode mapel "${kode}" belum ada di kamus.`);
  const sudah = cariAlias(kamus, teksAsli);
  if (sudah && !(sudah.length === 1 && sudah[0] === kode)) {
    throw new GalatFormat(`"${teksAsli}" sudah terdaftar untuk ${sudah.join(', ')} di kamus.`);
  }
  return {
    ...kamus,
    grup: kamus.grup.map((g) => ({ ...g, alias: [...g.alias], kodeAnggota: [...g.kodeAnggota] })),
    mapel: kamus.mapel.map((m) =>
      m.kode === kode && !m.alias.includes(alias) ? { ...m, alias: [...m.alias, alias] } : { ...m, alias: [...m.alias] },
    ),
  };
}

/** Mengembalikan kamus baru dengan mapel tambahan (mis. KKA). */
export function tambahMapel(kamus: Kamus, kode: string, namaLengkap: string, teksAsli?: string): Kamus {
  const k = kode.trim().toUpperCase().replace(/\s+/g, ' ');
  const nama = namaLengkap.trim().replace(/\s+/g, ' ');
  if (!k || !nama) throw new GalatFormat('Kode dan nama lengkap mapel wajib diisi.');
  if (cariMapel(kamus, k)) throw new GalatFormat(`Kode mapel "${k}" sudah ada di kamus.`);
  const alias = normalisasiNama(nama);
  const pakaiAliasNama = cariAlias(kamus, nama) === null;
  let hasil: Kamus = {
    ...kamus,
    mapel: [...kamus.mapel.map((m) => ({ ...m, alias: [...m.alias] })), { kode: k, namaLengkap: nama, alias: pakaiAliasNama ? [alias] : [] }],
  };
  if (teksAsli) hasil = tambahAlias(hasil, teksAsli, k);
  return hasil;
}

/** Kunci untuk menyimpan pilihan operator atas satu nama di satu sel jadwal. */
export function kunciPilihan(lokasi: string, teksAsli: string): string {
  return `${lokasi}|${normalisasiNama(teksAsli)}`;
}

/**
 * Mencocokkan semua mapel untuk satu tingkat ke kamus.
 * `hariKe` = urutan hari ujian di jadwal (hari non-susulan yang berisi mapel untuk
 * tingkat mana pun), sama untuk semua kelas: hari ke-1 = category 1.
 * Kode yang sudah muncul sebelumnya di tingkat yang sama ditandai `duplikat`.
 */
export function cocokkanJadwal(
  jadwal: JadwalUjian,
  tingkat: string,
  kamus: Kamus,
  pilihan: PilihanMapel = {},
): HasilCocok[] {
  const hasil: HasilCocok[] = [];
  const sudah = new Set<string>();
  const kolom = jadwal.kolomTingkat[tingkat] ?? '';
  let hariKe = 0;

  const bukanSusulan = (t: string) => !/^susulan$/i.test(t);

  for (const hari of jadwal.hari) {
    if (hari.susulan) continue;
    const adaUjian = hari.sesi.some((s) => Object.values(s.mapelPerTingkat).some((m) => m.some(bukanSusulan)));
    if (!adaUjian) continue;
    hariKe++;
    const isi = hari.sesi.flatMap((s) =>
      (s.mapelPerTingkat[tingkat] ?? []).filter(bukanSusulan).map((t) => ({ teks: t, lokasi: `${kolom}${s.baris}` })),
    );

    for (const { teks, lokasi } of isi) {
      const dipilih = pilihan[kunciPilihan(lokasi, teks)];
      if (dipilih) {
        hasil.push({ teksAsli: teks, status: 'cocok', kode: [...dipilih], hariKe, lokasi, dipilih: true });
        dipilih.forEach((k) => sudah.add(k));
        continue;
      }
      const kode = cariAlias(kamus, teks);
      if (!kode) {
        hasil.push({ teksAsli: teks, status: 'tidak-dikenal', kode: [], hariKe, lokasi });
      } else if (kode.some((k) => sudah.has(k))) {
        hasil.push({ teksAsli: teks, status: 'duplikat', kode, hariKe, lokasi });
      } else {
        hasil.push({ teksAsli: teks, status: 'cocok', kode, hariKe, lokasi });
        kode.forEach((k) => sudah.add(k));
      }
    }
  }
  return hasil;
}
