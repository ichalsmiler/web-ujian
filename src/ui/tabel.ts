// Komponen DOM sederhana: tabel pratinjau dan daftar pesan.

import type { Peringatan } from '../core/tipe';

export type IsiSel = string | number | null | Node;

export interface Kolom {
  judul: string;
  angka?: boolean;
}

export interface BarisTabel {
  sel: IsiSel[];
  /** Warna baris: merah = harus diperbaiki, kuning = perlu dicek, abu = diabaikan. */
  tanda?: 'merah' | 'kuning' | 'abu';
}

/** Membuat elemen dengan atribut dan anak secara ringkas. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attr: Record<string, string | boolean | undefined> = {},
  ...anak: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attr)) {
    if (v === undefined || v === false) continue;
    if (k === 'class') e.className = String(v);
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, v);
  }
  for (const a of anak) if (a !== null && a !== undefined && a !== false) e.append(a);
  return e;
}

export function tabel(kolom: Kolom[], baris: BarisTabel[], keterangan?: string): HTMLElement {
  const thead = el('thead', {}, el('tr', {}, ...kolom.map((k) => el('th', { scope: 'col' }, k.judul))));
  const tbody = el('tbody');
  for (const b of baris) {
    const tr = el('tr', { class: b.tanda });
    b.sel.forEach((isi, i) => {
      const td = el('td', { class: kolom[i]?.angka ? 'angka' : undefined });
      if (isi instanceof Node) td.append(isi);
      else td.textContent = isi === null ? '' : String(isi);
      tr.append(td);
    });
    tbody.append(tr);
  }
  const t = el('table', {}, keterangan ? el('caption', { class: 'sr-only' }, keterangan) : null, thead, tbody);
  return el('div', { class: 'tabel-bungkus' }, t);
}

export function daftarPesan(pesan: Peringatan[]): HTMLElement | null {
  if (pesan.length === 0) return null;
  return el(
    'ul',
    { class: 'pesan', role: 'status' },
    ...pesan.map((p) => el('li', { class: p.tingkat }, p.lokasi ? `${p.pesan} (${p.lokasi})` : p.pesan)),
  );
}
