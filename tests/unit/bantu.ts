import { readFileSync } from 'node:fs';

/** Membaca file fixture sebagai ArrayBuffer (seperti hasil File.arrayBuffer() di browser). */
export function bacaFixture(nama: string): ArrayBuffer {
  const b = readFileSync(`tests/fixtures/${nama}`);
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

export const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

export const SHEET_2026 = 'Jadwal SMT Gsl 2026 EDIT';
export const SHEET_2025 = 'Jadwal SMT Gsl 2025';
