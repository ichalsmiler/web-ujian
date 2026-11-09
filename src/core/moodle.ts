// Konversi data user CBTAdmin ke format upload user Moodle (seperti USER MOODLE.csv).
//
// username, password, firstname = sama dengan file CBTAdmin
// lastname = department = kelas, email = username@<domain>, address = ruang
// course1..N = shortname mapel tingkat siswa (hasil tab Jadwal), dikurangi mapel pilihan yang dikecualikan.

import Papa from 'papaparse';
import type { PesertaCBT, PesertaMasuk, Peringatan } from './tipe';
import { tingkatDariRombel, tingkatDariSheet } from './user';

export const DOMAIN_EMAIL = 'smada.id';
const MIN_KOLOM_COURSE = 14;

/** Mapel pilihan kelas XI dari sekolah (2026-11-09); tidak didaftarkan untuk semua siswa. */
const PILIHAN_XI = [
  'FISIKA',
  'KIMIA LANJUT',
  'PKWU',
  'BING LANJUT',
  'BINDO LANJUT',
  'SEJARAH INDO',
  'EKONOMI',
  'GEOGRAFI',
  'MATEMATIKA LANJUT',
  'INFORMATIKA',
  'BIOLOGI LANJUTAN',
  'SOSIOLOGI LANJUTAN',
];

/** Shortname yang dikecualikan per tingkat. X: tidak ada; XI dan XII: mapel pilihan. */
export function pengecualianAwal(): Record<string, string[]> {
  return {
    X: [],
    XI: PILIHAN_XI.map((k) => `USBK-XI-${k}`),
    XII: PILIHAN_XI.map((k) => `USBK-XII-${k}`),
  };
}

/** Mengubah teks (satu shortname per baris) menjadi daftar yang rapi dan unik. */
export function uraiDaftarShortname(teks: string): string[] {
  return [...new Set(teks.split(/\r?\n|;|,/).map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean))];
}

/** Tingkat siswa: dari nama sheet (KLS. XI) jika ada, selain itu dari kelas (XI-3). */
export function tingkatPeserta(p: Pick<PesertaMasuk, 'sheet' | 'department'>): string {
  return (p.sheet && tingkatDariSheet(p.sheet)) || tingkatDariRombel(p.department);
}

export interface BarisMoodle {
  username: string;
  password: string;
  firstname: string;
  lastname: string;
  email: string;
  department: string;
  address: string;
  course: string[];
  tingkat: string;
}

export interface HasilMoodle {
  baris: BarisMoodle[];
  peringatan: Peringatan[];
  /** Tingkat siswa yang belum punya daftar mapel (jadwal belum dikonvert). */
  tingkatTanpaMapel: string[];
}

/**
 * @param peserta  data peserta (urutan sama dengan `cbt`) — untuk menentukan tingkat
 * @param cbt      hasil keCbt: sumber username, password, nama, kelas, ruang
 * @param mapel    shortname per tingkat dari tab Jadwal, urut seperti file mapel
 * @param kecuali  shortname yang tidak didaftarkan, per tingkat
 */
export function keMoodle(
  peserta: PesertaMasuk[],
  cbt: PesertaCBT[],
  mapel: ReadonlyMap<string, readonly string[]>,
  kecuali: Record<string, readonly string[]>,
  domain = DOMAIN_EMAIL,
): HasilMoodle {
  const tanpaMapel = new Set<string>();
  const baris = cbt.map((c, i) => {
    const tingkat = tingkatPeserta(peserta[i]);
    const daftar = mapel.get(tingkat);
    if (!daftar) tanpaMapel.add(tingkat || '(tidak diketahui)');
    const buang = new Set(kecuali[tingkat] ?? []);
    return {
      username: c.username,
      password: c.password,
      firstname: c.namaPeserta,
      lastname: c.namaRombel,
      email: `${c.username}@${domain}`,
      department: c.namaRombel,
      address: c.ruang === null ? '' : String(c.ruang),
      course: (daftar ?? []).filter((s) => !buang.has(s)),
      tingkat,
    };
  });

  const peringatan: Peringatan[] = [];
  for (const t of [...tanpaMapel]) {
    const n = baris.filter((b) => (b.tingkat || '(tidak diketahui)') === t).length;
    peringatan.push({
      tingkat: 'galat',
      pesan: `${n} siswa kelas ${t} belum punya daftar mapel. Konvert jadwal kelas ${t} (atau "Konvert semua kelas") di tab Jadwal → Mapel`,
    });
  }
  // Pengecualian yang tidak ada di daftar mapel kemungkinan salah ketik.
  for (const [t, daftar] of Object.entries(kecuali)) {
    const ada = mapel.get(t);
    if (!ada || !baris.some((b) => b.tingkat === t)) continue;
    const tidakAda = daftar.filter((s) => !ada.includes(s));
    if (tidakAda.length) {
      peringatan.push({
        tingkat: 'peringatan',
        pesan: `Mapel pilihan kelas ${t} ini tidak ada di hasil konversi jadwal, jadi tidak berpengaruh: ${tidakAda.join(', ')}. Periksa penulisannya`,
      });
    }
  }
  return { baris, peringatan, tingkatTanpaMapel: [...tanpaMapel] };
}

/**
 * CSV persis seperti USER MOODLE.csv: pemisah titik koma, akhir baris CRLF, baris terakhir
 * diakhiri CRLF, UTF-8 tanpa BOM. Kolom course1..N dengan N ≥ 14 (sebanyak course terbanyak).
 */
export function tulisMoodleCsv(baris: BarisMoodle[]): string {
  const n = Math.max(MIN_KOLOM_COURSE, ...baris.map((b) => b.course.length));
  const fields = ['username', 'password', 'firstname', 'lastname', 'email', 'department', 'address', ...Array.from({ length: n }, (_, i) => `course${i + 1}`)];
  const data = baris.map((b) => [b.username, b.password, b.firstname, b.lastname, b.email, b.department, b.address, ...Array.from({ length: n }, (_, i) => b.course[i] ?? '')]);
  return Papa.unparse({ fields, data }, { delimiter: ';', newline: '\r\n' }) + '\r\n';
}
