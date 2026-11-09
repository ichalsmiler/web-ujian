// Penyimpanan kamus & pengaturan di localStorage, serta unduhan file.
// Data siswa dan file jadwal TIDAK pernah disimpan di sini.

import { kamusAwal } from '../core/kamus';
import type { Kamus, PilihanMapel } from '../core/tipe';

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
      if (kamusValid(data)) return data;
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

/** Dicatat tab Jadwal setiap kali pratinjau mapel suatu tingkat dibuat. */
export function catatHasilMapel(tingkat: string, shortname: string[]): void {
  const lama = hasilMapel.get(tingkat);
  if (lama && lama.length === shortname.length && lama.every((s, i) => s === shortname[i])) return;
  hasilMapel.set(tingkat, [...shortname]);
  for (const f of pendengarMapel) f(hasilMapel);
}

export function ambilHasilMapel(): ReadonlyMap<string, readonly string[]> {
  return hasilMapel;
}

export function saatHasilMapelBerubah(f: PendengarMapel): () => void {
  pendengarMapel.add(f);
  return () => pendengarMapel.delete(f);
}
