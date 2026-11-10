// Kelas moving (mapel pilihan): membaca file "DAFTAR HADIR KELAS MOVING XI <MAPEL>.xlsx",
// mencocokkan nama murid ke peserta (lewat nama, karena file moving tidak punya nomor ujian),
// dan menghasilkan daftar shortname moving per username.

import ExcelJS from 'exceljs';
import { teksSel } from './tanggal';
import { GalatFormat, type PesertaMasuk } from './tipe';

/** Singkatan mapel di file/judul moving → kode mapel di kamus (dikonfirmasi sekolah 2026-11-09;
 * KIMIA, BIOLOGI, SOSIOLOGI tanpa "lanjut" sejak 2026-11-10). */
export const PETA_MAPEL_MOVING: Record<string, string> = {
  BING: 'BING LANJUT',
  BIING: 'BING LANJUT',
  BINDO: 'BINDO LANJUT',
  BIO: 'BIOLOGI',
  BIOLOGI: 'BIOLOGI',
  EKO: 'EKONOMI',
  EKONOMI: 'EKONOMI',
  FIS: 'FISIKA',
  FISIKA: 'FISIKA',
  GEO: 'GEOGRAFI',
  GEOGRAFI: 'GEOGRAFI',
  INFOR: 'INFORMATIKA',
  INFORMATIKA: 'INFORMATIKA',
  KIMIA: 'KIMIA',
  MATEMATIKA: 'MATEMATIKA LANJUT',
  MTK: 'MATEMATIKA LANJUT',
  SOSIO: 'SOSIOLOGI',
  SOSIOLOGI: 'SOSIOLOGI',
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
  /** Kode mapel di kamus, mis. "BIOLOGI"; '' jika tidak dikenali. */
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
/**
 * Kandidat teratas di rombel yang sama dipasangkan otomatis jika kemiripannya minimal ini dan
 * unggul jauh dari siswa lain di rombel itu (nama salah ketik di beberapa kata).
 */
export const AMBANG_UNGGUL = 0.65;
export const SELISIH_UNGGUL = 0.2;

/** Jumlah huruf yang harus diubah agar `a` menjadi `b` (jarak Levenshtein). */
function jarakEdit(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** Salah ketik dalam satu kata: 1 huruf untuk kata 4–6 huruf, 2 huruf untuk kata ≥ 7 huruf. */
function salahKetik(a: string, b: string): boolean {
  const n = Math.min(a.length, b.length);
  if (n < 4) return false;
  return jarakEdit(a, b) <= (n >= 7 ? 2 : 1);
}

/** Penulisan "Muhammad" yang sering dipakai; semuanya dianggap kata yang sama. */
const VARIAN_MUHAMMAD = /^(MUH|MUHD|MHD|MHMD|MOH|MOHD|MOCH|MUCH|MUHAMAD|MUHAMMAD|MUHAMMED|MUHAMED|MOHAMAD|MOHAMMAD|MOHAMMED|MOCHAMAD|MOCHAMMAD|MUCHAMAD|MUCHAMMAD)$/;

/** Kata-kata nama: huruf A–Z saja; "A.K" → A, K; varian Muhammad disamakan. */
export function kataNama(nama: string): string[] {
  return nama
    .toUpperCase()
    .replace(/['’`]/g, '') // NUR'AINI → NURAINI
    .split(/[^A-Z]+/)
    .filter(Boolean)
    .map((k) => (VARIAN_MUHAMMAD.test(k) ? 'MUHAMMAD' : k));
}

type JenisKata = 'penuh' | 'singkat';

/** Apakah kata `a` (dari nama yang lebih pendek) bisa berarti kata `b`. */
function cocokKata(a: string, b: string): JenisKata | null {
  if (a === b) return 'penuh';
  if (a.length === 1) return b[0] === a ? 'singkat' : null; // inisial: B → BINTANG
  if (a.length >= 3 && b.startsWith(a)) return 'singkat'; // terpotong: SEKAR → SEKARWANGI
  if (salahKetik(a, b)) return 'penuh'; // salah ketik: BAYU ~ BAYI, KIRANA ~ KHIRANNA
  return null;
}

/** Setiap kata `pendek` cocok dengan kata `panjang` secara berurutan; minimal satu kata utuh ≥ 3 huruf. */
function urutanCocok(pendek: string[], panjang: string[]): boolean {
  let j = 0;
  let utuh = 0;
  for (const a of pendek) {
    while (j < panjang.length && !cocokKata(a, panjang[j])) j++;
    if (j === panjang.length) return false;
    if (cocokKata(a, panjang[j]) === 'penuh' && a.length >= 3) utuh++;
    j++;
  }
  return utuh >= 1;
}

/**
 * Nama di file moving bisa berarti nama peserta: kata-katanya sama berurutan, tetapi boleh
 * disingkat (inisial, terpotong), salah ketik sedikit, atau sebagian kata tidak ditulis.
 * Contoh (nama karangan): "Siswa Contoh B.S" ~ "SISWA CONTOH BINTANG SEKARWANGI", "Muh Contoh" ~ "MUHAMMAD CONTOH".
 */
export function namaSesuai(a: string, b: string): boolean {
  const x = kataNama(a);
  const y = kataNama(b);
  if (!x.length || !y.length) return false;
  return x.length <= y.length ? urutanCocok(x, y) : urutanCocok(y, x);
}

/** Kandidat paling mirip di satu rombel cukup mirip dan unggul jauh dari siswa lain di rombel itu. */
function unggulDiRombel(diRombel: { skor: number }[]): boolean {
  const [a, b] = [...diRombel].sort((x, y) => y.skor - x.skor);
  return !!a && a.skor >= AMBANG_UNGGUL && a.skor - (b?.skor ?? 0) >= SELISIH_UNGGUL;
}

export interface Kandidat {
  username: string;
  nama: string;
  kelas: string;
  skor: number;
  /** Kata-kata namanya sesuai (lihat `namaSesuai`). */
  sesuai: boolean;
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
 * - mirip: kemiripan ≥ 0.85, unggul ≥ 0.1 dari kandidat berikutnya, dan nomor rombel sama;
 *   atau hanya satu siswa di rombel itu yang namanya sesuai (nama disingkat/terpotong, lihat `namaSesuai`)
 * - pilih: selain itu — operator memilih
 * Urutan kandidat: nama sesuai dulu, lalu rombel sama, lalu kemiripan.
 */
export function cocokkanMoving(kelompok: KelompokMoving[], peserta: PesertaMasuk[], jumlahKandidat = 5): PasanganMoving[] {
  const indeks = new Map<string, PesertaMasuk[]>();
  for (const p of peserta) {
    const k = kunciNama(p.firstname);
    indeks.set(k, [...(indeks.get(k) ?? []), p]);
  }
  // Satu murid biasanya ada di beberapa file moving: hitung sekali per (nama, rombel).
  const sudah = new Map<string, Pick<PasanganMoving, 'status' | 'username' | 'kandidat'>>();

  const pasangkan = (nama: string, nomor: string): Pick<PasanganMoving, 'status' | 'username' | 'kandidat'> => {
    // Nama sama persis; jika ada lebih dari satu siswa bernama sama, pakai nomor rombel untuk membedakan.
    const sama = indeks.get(kunciNama(nama)) ?? [];
    const persis = sama.length <= 1 ? sama : sama.filter((p) => nomorKelas(p.department) === nomor);
    const rombelSama = (kelas: string) => !nomor || nomorKelas(kelas) === nomor;
    const semua = peserta
      .map((p) => {
        const skor = kemiripan(nama, p.firstname);
        const sesuai = namaSesuai(nama, p.firstname);
        const urut = skor + (nomor && nomorKelas(p.department) === nomor ? 0.15 : 0) + (sesuai ? 0.5 : 0);
        return { username: p.username, nama: p.firstname, kelas: p.department, skor, sesuai, urut };
      })
      .sort((a, b) => b.urut - a.urut);
    const kandidat = semua.slice(0, jumlahKandidat).map(({ urut: _, ...k }) => k);
    if (persis.length === 1) return { status: 'persis', username: persis[0].username, kandidat };

    // Paling mirip (salah ketik kecil)
    const [a, b] = [...kandidat].sort((x, y) => y.skor - x.skor);
    if (a && a.skor >= AMBANG_MIRIP && a.skor - (b?.skor ?? 0) >= SELISIH_MIRIP && rombelSama(a.kelas)) {
      return { status: 'mirip', username: a.username, kandidat };
    }
    // Nama disingkat/terpotong: tepat satu siswa di rombel itu yang namanya sesuai
    const sesuaiDiRombel = semua.filter((k) => k.sesuai && rombelSama(k.kelas));
    if (sesuaiDiRombel.length === 1) return { status: 'mirip', username: sesuaiDiRombel[0].username, kandidat };
    // Beberapa kata salah ketik: kandidat teratas di rombel itu jauh lebih mirip daripada yang lain
    const diRombel = semua.filter((k) => rombelSama(k.kelas)).sort((x, y) => y.skor - x.skor);
    if (nomor && sesuaiDiRombel.length === 0 && unggulDiRombel(diRombel)) {
      return { status: 'mirip', username: diRombel[0].username, kandidat };
    }
    return { status: 'pilih', username: '', kandidat };
  };

  return kelompok.flatMap((kel) =>
    kel.siswa.map((s) => {
      const nomor = nomorKelas(s.kelas);
      const kunci = `${kunciNama(s.nama)}|${nomor}`;
      if (!sudah.has(kunci)) sudah.set(kunci, pasangkan(s.nama, nomor));
      return { siswa: s, kelompok: kel, ...sudah.get(kunci)! };
    }),
  );
}

/**
 * Kunci untuk menyimpan pilihan operator atas satu baris file moving. Memuat tingkat, karena
 * file moving XI dan XII bisa punya judul kelompok yang sama (mis. "FISIKA 1").
 */
export function kunciPasangan(p: Pick<PasanganMoving, 'siswa' | 'kelompok'>): string {
  return `${p.kelompok.tingkat}|${p.kelompok.judul}|${kunciNama(p.siswa.nama)}|${nomorKelas(p.siswa.kelas)}`;
}

/** Kunci versi lama (tanpa tingkat), yang mungkin masih tersimpan di browser. */
function kunciPasanganLama(p: Pick<PasanganMoving, 'siswa' | 'kelompok'>): string {
  return `${p.kelompok.judul}|${kunciNama(p.siswa.nama)}|${nomorKelas(p.siswa.kelas)}`;
}

/**
 * Pilihan operator untuk satu baris: username, '' (diabaikan), atau undefined (belum dipilih).
 * Kunci baru didahulukan; kunci lama tetap dibaca supaya pilihan tersimpan tidak hilang.
 */
export function pilihanPasangan(p: Pick<PasanganMoving, 'siswa' | 'kelompok'>, pilihan: Readonly<Record<string, string>>): string | undefined {
  const k = kunciPasangan(p);
  if (k in pilihan) return pilihan[k];
  const lama = kunciPasanganLama(p);
  return lama in pilihan ? pilihan[lama] : undefined;
}

/** Kunci untuk kode mapel yang diganti operator, per tingkat dan singkatan mapel. */
export function kunciKodeMoving(k: Pick<KelompokMoving, 'tingkat' | 'singkatan'>): string {
  return `${k.tingkat}|${k.singkatan}`;
}

/**
 * Kode mapel kelompok setelah penggantian operator. Kunci lama (hanya singkatan, berlaku
 * untuk semua tingkat) tetap dibaca jika belum ada penggantian untuk tingkat ini.
 */
export function kodeMovingAktif(k: Pick<KelompokMoving, 'tingkat' | 'singkatan' | 'kode'>, diganti: Readonly<Record<string, string>>): string {
  return diganti[kunciKodeMoving(k)] ?? diganti[k.singkatan] ?? k.kode;
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
    const username = pilihanPasangan(p, pilihan) ?? p.username;
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
    const u = pilihanPasangan(p, pilihan) ?? p.username;
    if (!u || !p.kelompok.kode) continue;
    const g = `${u}|${p.kelompok.tingkat}|${p.kelompok.kode}`;
    grup.set(g, [...(grup.get(g) ?? []), p]);
  }
  return [...grup]
    .filter(([, b]) => b.length > 1)
    .map(([g, baris]) => ({ username: g.split('|')[0], kode: g.split('|')[2], baris }));
}

// ---------- rekap per siswa (file cek untuk operator) ----------

/** Jumlah mapel moving yang seharusnya dimiliki setiap siswa (aturan sekolah 2026-11-09). */
export const JUMLAH_MOVING = 4;

export interface BarisRekapMoving {
  username: string;
  nama: string;
  kelas: string;
  /** Kode mapel tanpa awalan, mis. "BING LANJUT". */
  mapel: string[];
}

/** Satu baris per siswa (urutan sama dengan file peserta), dengan mapel moving-nya. */
export function rekapMoving(peserta: PesertaMasuk[], moving: ReadonlyMap<string, readonly string[]>): BarisRekapMoving[] {
  return peserta.map((p) => ({
    username: p.username,
    nama: p.firstname,
    kelas: p.department,
    mapel: (moving.get(p.username) ?? []).map((s) => s.replace(/^[^-]+-[^-]+-/, '')).sort((a, b) => a.localeCompare(b)),
  }));
}

/** Keterangan untuk siswa yang jumlah mapel moving-nya tidak sesuai; '' jika sesuai. */
export function keteranganRekap(jumlah: number, wajib = JUMLAH_MOVING): string {
  if (jumlah === wajib) return '';
  if (jumlah === 0) return 'Belum punya mapel moving';
  return jumlah < wajib ? `Kurang ${wajib - jumlah} mapel` : `Lebih ${jumlah - wajib} mapel`;
}

const MERAH_ISI = 'FFFFC7CE';
const MERAH_TEKS = 'FF9C0006';

/**
 * File Excel untuk mengecek kelas moving: semua siswa dan mapel moving-nya.
 * Baris siswa yang jumlah mapel moving-nya bukan `wajib` diwarnai merah.
 */
export async function tulisRekapMovingXlsx(baris: BarisRekapMoving[], wajib = JUMLAH_MOVING): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Rekap moving', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'No. Ujian', key: 'username', width: 14 },
    { header: 'Nama Siswa', key: 'nama', width: 38 },
    { header: 'Kelas', key: 'kelas', width: 9 },
    { header: 'Jumlah Mapel Moving', key: 'jumlah', width: 12 },
    { header: 'Mapel Moving', key: 'mapel', width: 70 },
    { header: 'Keterangan', key: 'ket', width: 26 },
  ];
  const header = ws.getRow(1);
  header.font = { bold: true };
  header.alignment = { vertical: 'middle', wrapText: true };
  for (const b of baris) {
    const row = ws.addRow({ username: b.username, nama: b.nama, kelas: b.kelas, jumlah: b.mapel.length, mapel: b.mapel.join(', '), ket: keteranganRekap(b.mapel.length, wajib) });
    row.getCell('username').numFmt = '@';
    if (b.mapel.length !== wajib) {
      row.eachCell({ includeEmpty: true }, (c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MERAH_ISI } };
        c.font = { color: { argb: MERAH_TEKS } };
      });
    }
  }
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 6 } };
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
