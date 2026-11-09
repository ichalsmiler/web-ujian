// Penyimpanan kamus & pengaturan di localStorage, serta unduhan file.
// Data siswa dan file jadwal TIDAK pernah disimpan di sini.

import { kamusAwal, lengkapiKamus } from '../core/kamus';
import type { Kamus, PesertaMasuk, PilihanMapel } from '../core/tipe';

const KUNCI_KAMUS = 'web-ujian.kamus';

type Pendengar = (kamus: Kamus) => void;
const pendengar = new Set<Pendengar>();

function kamusValid(x: unknown): x is Kamus {
  if (!x || typeof x !== 'object') return false;
  const k = x as Kamus;
  return (
    k.versi === 1 &&
    Array.isArray(k.mapel) &&
    Array.isArray(k.grup) &&
    k.mapel.every((m) => typeof m.kode === 'string' && typeof m.namaLengkap === 'string' && Array.isArray(m.alias))
  );
}

export function muatKamus(): Kamus {
  try {
    const teks = localStorage.getItem(KUNCI_KAMUS);
    if (teks) {
      const data: unknown = JSON.parse(teks);
      if (kamusValid(data)) return lengkapiKamus(data);
    }
  } catch {
    // Data rusak atau localStorage tidak tersedia: pakai kamus awal.
  }
  return kamusAwal();
}

export function simpanKamus(kamus: Kamus): void {
  try {
    localStorage.setItem(KUNCI_KAMUS, JSON.stringify(kamus));
  } catch {
    // Tetap jalan meski tidak bisa disimpan (mis. mode privat).
  }
  for (const f of pendengar) f(kamus);
}

/** Dipanggil setiap kali kamus berubah, agar tab lain ikut memperbarui tampilan. */
export function saatKamusBerubah(f: Pendengar): () => void {
  pendengar.add(f);
  return () => pendengar.delete(f);
}

const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Unduh teks CSV (UTF-8). */
export function unduhCsv(nama: string, isi: string): void {
  unduhFile(nama, new TextEncoder().encode(isi), 'text/csv;charset=utf-8');
}

export function unduhFile(nama: string, isi: ArrayBuffer | Uint8Array, mime = MIME_XLSX): void {
  const blob = new Blob([isi as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nama;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Pilihan operator (nama tidak dikenal/duplikat) per sheet jadwal, diingat untuk upload berikutnya. */
export function muatPilihan(namaSheet: string): Record<string, PilihanMapel> {
  try {
    const data = JSON.parse(localStorage.getItem(`web-ujian.pilihan.${namaSheet}`) ?? '{}') as unknown;
    if (data && typeof data === 'object') return data as Record<string, PilihanMapel>;
  } catch {
    // abaikan
  }
  return {};
}

export function simpanPilihan(namaSheet: string, pilihan: Record<string, PilihanMapel>): void {
  try {
    localStorage.setItem(`web-ujian.pilihan.${namaSheet}`, JSON.stringify(pilihan));
  } catch {
    // abaikan
  }
}

// ---- Hasil konversi mapel terakhir (hanya di memori), dipakai tab User untuk cek kode mapel ----

type PendengarMapel = (hasil: ReadonlyMap<string, readonly string[]>) => void;
const hasilMapel = new Map<string, string[]>();
const pendengarMapel = new Set<PendengarMapel>();

/** Tingkat yang hasil konversinya masih punya nama mapel belum dikenal (baris merah). */
const mapelBelumLengkap = new Set<string>();

/** Dicatat tab Jadwal setiap kali pratinjau mapel suatu tingkat dibuat. */
export function catatHasilMapel(tingkat: string, shortname: string[], lengkap = true): void {
  const lama = hasilMapel.get(tingkat);
  const sama = lama && lama.length === shortname.length && lama.every((s, i) => s === shortname[i]);
  if (sama && mapelBelumLengkap.has(tingkat) === !lengkap) return;
  hasilMapel.set(tingkat, [...shortname]);
  if (lengkap) mapelBelumLengkap.delete(tingkat);
  else mapelBelumLengkap.add(tingkat);
  for (const f of pendengarMapel) f(hasilMapel);
}

export function mapelLengkap(tingkat: string): boolean {
  return hasilMapel.has(tingkat) && !mapelBelumLengkap.has(tingkat);
}

export function ambilHasilMapel(): ReadonlyMap<string, readonly string[]> {
  return hasilMapel;
}

export function saatHasilMapelBerubah(f: PendengarMapel): () => void {
  pendengarMapel.add(f);
  return () => pendengarMapel.delete(f);
}

// ---- Peserta CBTAdmin terakhir (hanya di memori, tidak pernah disimpan), dipakai tab User Moodle ----

export interface DataPeserta {
  namaFile: string;
  /** Peserta dengan password yang sudah dibuat (sama dengan file CBTAdmin). */
  peserta: PesertaMasuk[];
}

type PendengarPeserta = (d: DataPeserta | null) => void;
let dataPeserta: DataPeserta | null = null;
const pendengarPeserta = new Set<PendengarPeserta>();

export function catatPeserta(d: DataPeserta | null): void {
  dataPeserta = d;
  for (const f of pendengarPeserta) f(d);
}

export function ambilPeserta(): DataPeserta | null {
  return dataPeserta;
}

export function saatPesertaBerubah(f: PendengarPeserta): () => void {
  pendengarPeserta.add(f);
  return () => pendengarPeserta.delete(f);
}

// ---- Mapel pilihan yang dikecualikan di tab User Moodle (disimpan) ----

// v2: PKWU & SEJARAH INDO bukan mapel pilihan (2026-11-09); daftar versi lama diabaikan.
const KUNCI_KECUALI = 'web-ujian.moodle.kecuali.v2';

export function muatPengecualian(awal: Record<string, string[]>): Record<string, string[]> {
  try {
    const data = JSON.parse(localStorage.getItem(KUNCI_KECUALI) ?? 'null') as unknown;
    if (data && typeof data === 'object' && Object.values(data).every((v) => Array.isArray(v) && v.every((x) => typeof x === 'string'))) {
      return { ...awal, ...(data as Record<string, string[]>) };
    }
  } catch {
    // abaikan
  }
  return awal;
}

export function simpanPengecualian(k: Record<string, string[]>): void {
  try {
    localStorage.setItem(KUNCI_KECUALI, JSON.stringify(k));
  } catch {
    // abaikan
  }
}

// ---- Mapel moving per username (hanya di memori), dari tab Kelas Moving untuk tab User Moodle ----

type PendengarMoving = (m: ReadonlyMap<string, readonly string[]>) => void;
let dataMoving: ReadonlyMap<string, readonly string[]> = new Map();
const pendengarMoving = new Set<PendengarMoving>();

export function catatMoving(m: ReadonlyMap<string, readonly string[]>): void {
  dataMoving = m;
  for (const f of pendengarMoving) f(m);
}

export function ambilMoving(): ReadonlyMap<string, readonly string[]> {
  return dataMoving;
}

export function saatMovingBerubah(f: PendengarMoving): () => void {
  pendengarMoving.add(f);
  return () => pendengarMoving.delete(f);
}

// ---- Pilihan kelas moving (disimpan atas permintaan sekolah 2026-11-09) ----
// Berisi nomor ujian dan kunci nama siswa, hanya di browser komputer ini. Ada tombol untuk menghapusnya.

const KUNCI_MOVING = 'web-ujian.moving.v1';

export interface SimpananMoving {
  pilihan: Record<string, string>;
  manual: { username: string; shortname: string }[];
  kodeDiganti: Record<string, string>;
}

const kosongMoving = (): SimpananMoving => ({ pilihan: {}, manual: [], kodeDiganti: {} });

function rekamanTeks(x: unknown): x is Record<string, string> {
  return !!x && typeof x === 'object' && !Array.isArray(x) && Object.values(x).every((v) => typeof v === 'string');
}

export function muatMoving(): SimpananMoving {
  try {
    const d = JSON.parse(localStorage.getItem(KUNCI_MOVING) ?? 'null') as Partial<SimpananMoving> | null;
    if (!d) return kosongMoving();
    return {
      pilihan: rekamanTeks(d.pilihan) ? d.pilihan : {},
      manual: Array.isArray(d.manual)
        ? d.manual.filter((m): m is SimpananMoving['manual'][number] => !!m && typeof m.username === 'string' && typeof m.shortname === 'string')
        : [],
      kodeDiganti: rekamanTeks(d.kodeDiganti) ? d.kodeDiganti : {},
    };
  } catch {
    return kosongMoving();
  }
}

export function simpanMoving(d: SimpananMoving): void {
  try {
    if (!Object.keys(d.pilihan).length && !d.manual.length && !Object.keys(d.kodeDiganti).length) localStorage.removeItem(KUNCI_MOVING);
    else localStorage.setItem(KUNCI_MOVING, JSON.stringify(d));
  } catch {
    // abaikan (mis. mode privat)
  }
}
