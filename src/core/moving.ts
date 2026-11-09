// Kelas moving (mapel pilihan): membaca file "DAFTAR HADIR KELAS MOVING XI <MAPEL>.xlsx",
// mencocokkan nama murid ke peserta (lewat nama, karena file moving tidak punya nomor ujian),
// dan menghasilkan daftar shortname moving per username.

import ExcelJS from 'exceljs';
import { teksSel } from './tanggal';
import { GalatFormat, type PesertaMasuk } from './tipe';

/** Singkatan mapel di file/judul moving → kode mapel di kamus (dikonfirmasi sekolah 2026-11-09). */
export const PETA_MAPEL_MOVING: Record<string, string> = {
  BING: 'BING LANJUT',
  BIING: 'BING LANJUT',
  BINDO: 'BINDO LANJUT',
  BIO: 'BIOLOGI LANJUTAN',
  BIOLOGI: 'BIOLOGI LANJUTAN',
  EKO: 'EKONOMI',
  EKONOMI: 'EKONOMI',
  FIS: 'FISIKA',
  FISIKA: 'FISIKA',
  GEO: 'GEOGRAFI',
  GEOGRAFI: 'GEOGRAFI',
  INFOR: 'INFORMATIKA',
  INFORMATIKA: 'INFORMATIKA',
  KIMIA: 'KIMIA LANJUT',
  MATEMATIKA: 'MATEMATIKA LANJUT',
  MTK: 'MATEMATIKA LANJUT',
  SOSIO: 'SOSIOLOGI LANJUTAN',
  SOSIOLOGI: 'SOSIOLOGI LANJUTAN',
};

export interface SiswaMoving {
  nama: string;
  kelas: string;
  /** Lokasi di file, mis. "BIO.xlsx › (2) baris 7". */
  lokasi: string;
}

export interface KelompokMoving {
  /** Judul di baris 2, mis. "BIOLOGI 2". */
  judul: string;
  /** Kode mapel di kamus, mis. "BIOLOGI LANJUTAN"; '' jika tidak dikenali. */
  kode: string;
  /** Singkatan mapel yang terbaca, mis. "BIOLOGI". */
  singkatan: string;
  /**
   * Tingkat kelas moving (XI, XII). Murid hanya dicocokkan dengan peserta tingkat ini,
   * dan mapelnya menjadi USBK-<tingkat>-<kode>.
   */
  tingkat: string;
  namaFile: string;
  sheet: string;
  siswa: SiswaMoving[];
  /** Keterangan jika tingkat dari nama file berbeda dengan kolom KELAS. */
  peringatan?: string;
}

const normalHeader = (s: string) => s.toUpperCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();

/** Singkatan mapel dari judul ("BIOLOGI 2" → "BIOLOGI") atau nama file ("… MOVING XI BIO.xlsx" → "BIO"). */
function singkatanMapel(judul: string, namaFile: string): string {
  const dariJudul = judul.toUpperCase().replace(/\d+/g, '').replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (dariJudul && PETA_MAPEL_MOVING[dariJudul]) return dariJudul;
  const m = /MOVING\s+[IVX]+\s+(.+?)\.xlsx$/i.exec(namaFile);
  const dariFile = m ? m[1].toUpperCase().replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim() : '';
  return dariFile && PETA_MAPEL_MOVING[dariFile] ? dariFile : dariJudul || dariFile;
}

function tingkatDariNamaFile(namaFile: string): string {
  const m = /MOVING\s+([IVX]+)\b/i.exec(namaFile);
  return m ? m[1].toUpperCase() : '';
}

/** Tingkat terbanyak di kolom KELAS ("XI 3" → XI, "XII-2" → XII); '' jika tidak terbaca. */
export function tingkatDariKelasMoving(kelas: string[]): string {
  const hitung = new Map<string, number>();
  for (const k of kelas) {
    const m = /^\s*([IVX]+)(?=$|[\s\-._/]|\d)/i.exec(k);
    if (m) hitung.set(m[1].toUpperCase(), (hitung.get(m[1].toUpperCase()) ?? 0) + 1);
  }
  return [...hitung].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

/** Membaca satu file daftar hadir moving; setiap sheet berisi murid = satu kelompok moving. */
export async function bacaFileMoving(file: ArrayBuffer, namaFile: string): Promise<KelompokMoving[]> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(file);
  } catch {
    throw new GalatFormat(`"${namaFile}" tidak bisa dibuka. Pastikan berformat .xlsx.`);
  }
  const hasil: KelompokMoving[] = [];
  const tingkatFile = tingkatDariNamaFile(namaFile);
  for (const ws of wb.worksheets) {
    let barisHeader = 0;
    let kolNama = 0;
    let kolKelas = 0;
    for (let r = 1; r <= Math.min(ws.rowCount, 15) && !barisHeader; r++) {
      for (let c = 1; c <= Math.min(ws.columnCount, 10); c++) {
        const h = normalHeader(teksSel(ws.getCell(r, c).value));
        if (h === 'NAMA MURID' || h === 'NAMA SISWA' || h === 'NAMA') kolNama = c;
        if (h === 'KELAS') kolKelas = c;
      }
      if (kolNama && kolKelas) barisHeader = r;
      else kolNama = kolKelas = 0;
    }
    if (!barisHeader) continue;

    // Judul kelompok: teks pertama di atas header yang bukan "DAFTAR HADIR …"
    let judul = '';
    for (let r = 1; r < barisHeader && !judul; r++) {
      const t = teksSel(ws.getCell(r, 1).value);
      if (t && !/daftar\s+hadir/i.test(t)) judul = t.replace(/\s+/g, ' ').trim();
    }

    const siswa: SiswaMoving[] = [];
    for (let r = barisHeader + 1; r <= ws.rowCount; r++) {
      const nama = teksSel(ws.getCell(r, kolNama).value).replace(/\s+/g, ' ').trim();
      if (!nama || normalHeader(nama) === 'NAMA MURID') continue;
      siswa.push({ nama, kelas: teksSel(ws.getCell(r, kolKelas).value).trim(), lokasi: `${namaFile} › ${ws.name} baris ${r}` });
    }
    if (siswa.length === 0) continue; // sheet cadangan kosong

    // Tingkat: dari nama file ("MOVING XI …"); jika tidak ada, dari kolom KELAS; terakhir XI.
    const tingkatKelas = tingkatDariKelasMoving(siswa.map((x) => x.kelas));
    const tingkat = tingkatFile || tingkatKelas || 'XI';
    const peringatan =
      tingkatFile && tingkatKelas && tingkatFile !== tingkatKelas
        ? `Nama file menyebut kelas ${tingkatFile}, tetapi kolom KELAS berisi kelas ${tingkatKelas}. Murid dicocokkan dengan siswa kelas ${tingkatFile}; ganti nama file jika salah.`
        : undefined;
    const singkatan = singkatanMapel(judul, namaFile);
    hasil.push({
      judul: judul || `${singkatan} (${ws.name})`,
      kode: PETA_MAPEL_MOVING[singkatan] ?? '',
      singkatan,
      tingkat,
      namaFile,
      sheet: ws.name,
      siswa,
      ...(peringatan ? { peringatan } : {}),
    });
  }
  if (hasil.length === 0) {
    throw new GalatFormat(`"${namaFile}" tidak berisi daftar murid (kolom NAMA MURID dan KELAS tidak ditemukan).`);
  }
  return hasil;
}

// ---------- pencocokan nama ----------

/** Huruf besar, hanya huruf A–Z, tanpa spasi — untuk membandingkan nama. */
export function kunciNama(nama: string): string {
  return nama.toUpperCase().replace(/[^A-Z]/g, '');
}

/** Nomor rombel: "XI 3" / "XI-3" / "X-3" → "3". */
export function nomorKelas(kelas: string): string {
  const m = /(\d+)\s*$/.exec(kelas.trim());
  return m ? m[1] : '';
}

function bigram(s: string): Map<string, number> {
  const b = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const k = s.slice(i, i + 2);
    b.set(k, (b.get(k) ?? 0) + 1);
  }
  return b;
}

/** Kemiripan Dice (0–1) antar dua nama, berdasarkan pasangan huruf. */
export function kemiripan(a: string, b: string): number {
  const x = kunciNama(a);
  const y = kunciNama(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const A = bigram(x);
  const B = bigram(y);
  let sama = 0;
  for (const [k, v] of A) sama += Math.min(v, B.get(k) ?? 0);
  return (2 * sama) / (Math.max(1, x.length - 1) + Math.max(1, y.length - 1));
}

export const AMBANG_MIRIP = 0.85;
export const SELISIH_MIRIP = 0.1;

export interface Kandidat {
  username: string;
  nama: string;
  kelas: string;
  skor: number;
}

export type StatusPasangan = 'persis' | 'mirip' | 'pilih';

export interface PasanganMoving {
  siswa: SiswaMoving;
  kelompok: KelompokMoving;
  status: StatusPasangan;
  /** Username peserta yang dipasangkan; '' jika belum. */
  username: string;
  /** Kandidat teratas (untuk dipilih operator). */
  kandidat: Kandidat[];
}

/**
 * Mencocokkan setiap murid di kelompok moving ke peserta tingkat yang sama.
 * - persis: nama sama (abaikan huruf besar/kecil, spasi, tanda baca)
 * - mirip: kemiripan ≥ 0.85, unggul ≥ 0.1 dari kandidat berikutnya, dan nomor rombel sama
 * - pilih: selain itu — operator memilih
 * Kandidat dengan nomor rombel sama diberi sedikit tambahan skor saat diurutkan.
 */
export function cocokkanMoving(kelompok: KelompokMoving[], peserta: PesertaMasuk[], jumlahKandidat = 5): PasanganMoving[] {
  const hasil: PasanganMoving[] = [];
  const indeks = new Map<string, PesertaMasuk[]>();
  for (const p of peserta) {
    const k = kunciNama(p.firstname);
    indeks.set(k, [...(indeks.get(k) ?? []), p]);
  }
  for (const kel of kelompok) {
    for (const s of kel.siswa) {
      const nomor = nomorKelas(s.kelas);
      // Nama sama persis; jika ada lebih dari satu siswa bernama sama, pakai nomor rombel untuk membedakan.
      const sama = indeks.get(kunciNama(s.nama)) ?? [];
      const persis = sama.length <= 1 ? sama : sama.filter((p) => nomorKelas(p.department) === nomor);
      const kandidat = peserta
        .map((p) => {
          const skor = kemiripan(s.nama, p.firstname);
          const bonus = nomor && nomorKelas(p.department) === nomor ? 0.03 : 0;
          return { username: p.username, nama: p.firstname, kelas: p.department, skor, urut: skor + bonus };
        })
        .sort((a, b) => b.urut - a.urut)
        .slice(0, jumlahKandidat)
        .map(({ urut: _, ...k }) => k);

      if (persis.length === 1) {
        hasil.push({ siswa: s, kelompok: kel, status: 'persis', username: persis[0].username, kandidat });
        continue;
      }
      const [a, b] = kandidat;
      const kelasSama = a && (!nomor || nomorKelas(a.kelas) === nomor);
      if (a && a.skor >= AMBANG_MIRIP && a.skor - (b?.skor ?? 0) >= SELISIH_MIRIP && kelasSama) {
        hasil.push({ siswa: s, kelompok: kel, status: 'mirip', username: a.username, kandidat });
      } else {
        hasil.push({ siswa: s, kelompok: kel, status: 'pilih', username: '', kandidat });
      }
    }
  }
  return hasil;
}

/** Kunci untuk menyimpan pilihan operator atas satu baris file moving. */
export function kunciPasangan(p: Pick<PasanganMoving, 'siswa' | 'kelompok'>): string {
  return `${p.kelompok.judul}|${kunciNama(p.siswa.nama)}|${nomorKelas(p.siswa.kelas)}`;
}

export interface TambahanManual {
  username: string;
  /** Shortname moving, mis. USBK-XI-FISIKA. */
  shortname: string;
}

/**
 * Shortname moving per username: dari pasangan (dengan pilihan operator yang menimpa)
 * ditambah entri manual. Pilihan '' berarti baris itu diabaikan.
 */
export function movingPerSiswa(
  pasangan: PasanganMoving[],
  pilihan: Record<string, string>,
  manual: TambahanManual[],
  prefix = 'USBK',
): Map<string, string[]> {
  const hasil = new Map<string, Set<string>>();
  const tambah = (u: string, s: string) => {
    if (!u || !s) return;
    if (!hasil.has(u)) hasil.set(u, new Set());
    hasil.get(u)!.add(s);
  };
  for (const p of pasangan) {
    const k = kunciPasangan(p);
    const username = k in pilihan ? pilihan[k] : p.username;
    if (p.kelompok.kode) tambah(username, `${prefix}-${p.kelompok.tingkat}-${p.kelompok.kode}`);
  }
  for (const m of manual) tambah(m.username, m.shortname);
  return new Map([...hasil].map(([u, s]) => [u, [...s]]));
}

export interface PasanganGanda {
  username: string;
  kode: string;
  baris: PasanganMoving[];
}

/**
 * Siswa yang terpasang lebih dari sekali ke mapel yang sama (mis. muncul di dua kelompok,
 * atau dua nama berbeda dicocokkan ke siswa yang sama). Perlu dicek operator.
 */
export function pasanganGanda(pasangan: PasanganMoving[], pilihan: Record<string, string>): PasanganGanda[] {
  const grup = new Map<string, PasanganMoving[]>();
  for (const p of pasangan) {
    const k = kunciPasangan(p);
    const u = k in pilihan ? pilihan[k] : p.username;
    if (!u || !p.kelompok.kode) continue;
    const g = `${u}|${p.kelompok.tingkat}|${p.kelompok.kode}`;
    grup.set(g, [...(grup.get(g) ?? []), p]);
  }
  return [...grup]
    .filter(([, b]) => b.length > 1)
    .map(([g, baris]) => ({ username: g.split('|')[0], kode: g.split('|')[2], baris }));
}
