// Membaca nilai sel ExcelJS dan mengurai tanggal (termasuk nama bulan Indonesia).
// Semua tanggal dikembalikan sebagai Date pada tengah malam UTC.

const BULAN: Record<string, number> = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, agu: 8, agt: 8, ags: 8,
  sep: 9, okt: 10, nov: 11, des: 12,
};

/** Epoch nomor seri Excel (sistem 1900, termasuk bug tahun kabisat 1900). */
const EPOCH_EXCEL = Date.UTC(1899, 11, 30);
const SEHARI = 86_400_000;

type NilaiPolos = string | number | boolean | Date | null;

/**
 * Mengubah nilai sel ExcelJS (rumus, rich text, hyperlink, dll.) menjadi nilai
 * polos. Rumus memakai hasil yang tersimpan di file.
 */
export function nilaiSel(v: unknown): NilaiPolos {
  if (v === null || v === undefined) return null;
  if (v instanceof Date || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    return v;
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('result' in o) return nilaiSel(o.result);
    if ('formula' in o || 'sharedFormula' in o) return null; // rumus tanpa hasil tersimpan
    if (Array.isArray(o.richText)) {
      return (o.richText as { text: string }[]).map((r) => r.text).join('');
    }
    if ('text' in o) return nilaiSel(o.text);
    if ('error' in o) return null;
  }
  return null;
}

/** Teks sel yang sudah di-trim; '' untuk sel kosong. */
export function teksSel(v: unknown): string {
  const n = nilaiSel(v);
  if (n === null) return '';
  if (n instanceof Date) return n.toISOString().slice(0, 10);
  return String(n).trim();
}

function tanggalValid(y: number, m: number, d: number): Date | null {
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return t;
}

/** Mengurai nilai sel menjadi tanggal; null jika tidak bisa dibaca. */
export function uraiTanggal(v: unknown): Date | null {
  const n = nilaiSel(v);
  if (n === null || typeof n === 'boolean') return null;
  if (n instanceof Date) {
    return isNaN(n.getTime()) ? null : new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
  }
  if (typeof n === 'number') {
    // Rentang wajar nomor seri: tahun 1990–2100.
    if (n < 32_874 || n > 73_051) return null;
    return new Date(EPOCH_EXCEL + Math.floor(n) * SEHARI);
  }
  const teks = n.trim().toLowerCase().replace(/\s+/g, ' ');
  const cocok = /^(\d{1,2})[\s\-/.]+([a-z]+)[\s\-/.]+(\d{4})$/.exec(teks);
  if (cocok) {
    const bulan = BULAN[cocok[2]];
    if (!bulan) return null;
    return tanggalValid(Number(cocok[3]), bulan, Number(cocok[1]));
  }
  const angka = /^(\d{1,2})[\-/.](\d{1,2})[\-/.](\d{4})$/.exec(teks); // 23/11/2026
  if (angka) return tanggalValid(Number(angka[3]), Number(angka[2]), Number(angka[1]));
  return null;
}

/** Format tampilan: "23 Nov 2026". */
export function formatTanggal(t: Date | null): string {
  if (!t) return '—';
  const nama = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${t.getUTCDate()} ${nama[t.getUTCMonth()]} ${t.getUTCFullYear()}`;
}
