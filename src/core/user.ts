// Konversi file peserta (format seperti USER MOODLE.csv) ke template upload user CBTAdmin.

import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { teksSel } from './tanggal';
import { GalatFormat, type Pengaturan, type PesertaCBT, type PesertaMasuk, type Peringatan } from './tipe';

const KOLOM_WAJIB = ['username', 'firstname', 'department'] as const;
const BARIS_HEADER_CBT = 9;
const KOLOM_TEKS_CBT = [6, 7]; // Username, Password

/** UTF-8 (dengan/tanpa BOM); jika bukan UTF-8 yang sah, dianggap Windows-1252 (ANSI dari Excel). */
function dekode(buf: ArrayBuffer): string {
  let teks: string;
  try {
    teks = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    teks = new TextDecoder('windows-1252').decode(buf);
  }
  return teks.replace(/^﻿/, '');
}

function apakahXlsx(buf: ArrayBuffer, namaFile: string): boolean {
  const u8 = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
  return /\.xlsx$/i.test(namaFile) || (u8[0] === 0x50 && u8[1] === 0x4b); // "PK" = zip
}

async function barisXlsx(buf: ArrayBuffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf);
  } catch {
    throw new GalatFormat('File Excel tidak bisa dibuka. Simpan ulang sebagai .xlsx atau .csv.');
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new GalatFormat('File Excel tidak berisi sheet.');
  const hasil: string[][] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const sel: string[] = [];
    for (let c = 1; c <= ws.columnCount; c++) sel.push(teksSel(row.getCell(c).value));
    hasil.push(sel);
  }
  return hasil;
}

function barisCsv(buf: ArrayBuffer): string[][] {
  const hasil = Papa.parse<string[]>(dekode(buf), {
    delimitersToGuess: [';', ',', '\t'],
    skipEmptyLines: false,
  });
  return hasil.data;
}

export async function bacaUser(
  file: ArrayBuffer,
  namaFile: string,
): Promise<{ peserta: PesertaMasuk[]; peringatan: Peringatan[] }> {
  const semua = apakahXlsx(file, namaFile) ? await barisXlsx(file) : barisCsv(file);
  const kosong = (b: string[]) => b.every((s) => (s ?? '').trim() === '');

  const iHeader = semua.findIndex((b) => !kosong(b));
  if (iHeader < 0) throw new GalatFormat('File tidak berisi data.');

  const header = semua[iHeader].map((h) => (h ?? '').trim().toLowerCase());
  const hilang = KOLOM_WAJIB.filter((k) => !header.includes(k));
  if (hilang.length) {
    throw new GalatFormat(
      `Kolom wajib tidak ditemukan: ${hilang.join(', ')}. Baris pertama file harus berisi nama kolom seperti username;password;firstname;lastname;email;department;address.`,
    );
  }
  const idx = (k: string) => header.indexOf(k);
  const ambil = (b: string[], k: string) => (idx(k) >= 0 ? (b[idx(k)] ?? '').trim() : '');
  const kolomCourse = header.map((h, i) => (/^course\d+$/.test(h) ? i : -1)).filter((i) => i >= 0);

  const peserta: PesertaMasuk[] = [];
  const peringatan: Peringatan[] = [];
  for (let i = iHeader + 1; i < semua.length; i++) {
    const b = semua[i];
    if (kosong(b)) continue;
    const baris = i + 1;
    const username = ambil(b, 'username');
    if (!username) {
      peringatan.push({ tingkat: 'peringatan', pesan: 'Baris dilewati karena username kosong', lokasi: `baris ${baris}` });
      continue;
    }
    peserta.push({
      username,
      password: ambil(b, 'password'),
      firstname: ambil(b, 'firstname'),
      lastname: ambil(b, 'lastname'),
      department: ambil(b, 'department'),
      address: ambil(b, 'address'),
      course: kolomCourse.map((c) => (b[c] ?? '').trim()).filter(Boolean),
      baris,
    });
  }
  if (peserta.length === 0) throw new GalatFormat('File tidak berisi data peserta (hanya baris judul kolom).');
  return { peserta, peringatan };
}

/** Bagian romawi di depan nama rombel: "XII-1" → "XII". Jika tidak ada, rombel apa adanya. */
function tingkatDariRombel(rombel: string): string {
  const m = /^([IVX]+)(?=$|[\s\-._/])/i.exec(rombel);
  return m ? m[1].toUpperCase() : rombel;
}

export function keCbt(peserta: PesertaMasuk[], pengaturan: Pengaturan): PesertaCBT[] {
  return peserta.map((p) => {
    const rombel = p.department.trim();
    const nama = p.firstname.trim().replace(/\s+/g, ' ');
    const belakang = p.lastname.trim();
    const alamat = p.address.trim();
    return {
      namaPeserta: belakang && belakang !== rombel ? `${nama} ${belakang}` : nama,
      namaRombel: rombel,
      kelasJurusan: pengaturan.kelasJurusan === 'rombel' ? rombel : tingkatDariRombel(rombel),
      ruang: /^\d+$/.test(alamat) ? Number(alamat) : null,
      kelSesi: null,
      username: p.username.trim(),
      password: p.password.trim(),
    };
  });
}

/** Mengisi template CBTAdmin mulai baris 10; baris 1–9 (judul, petunjuk, header) tidak diubah. */
export async function tulisCbtXlsx(peserta: PesertaCBT[], template: ArrayBuffer): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(template.slice(0));
  const ws = wb.worksheets[0];
  if (!ws) throw new GalatFormat('Template CBTAdmin rusak: sheet tidak ditemukan.');

  for (let r = ws.rowCount; r > BARIS_HEADER_CBT; r--) ws.spliceRows(r, 1);

  peserta.forEach((p, i) => {
    const row = ws.getRow(BARIS_HEADER_CBT + 1 + i);
    row.values = [p.namaPeserta, p.namaRombel, p.kelasJurusan, p.ruang, p.kelSesi, p.username, p.password].map((v) =>
      v === null ? undefined : v,
    ) as ExcelJS.CellValue[];
    for (const c of KOLOM_TEKS_CBT) row.getCell(c).numFmt = '@';
    row.commit();
  });
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export interface KodeTidakCocok {
  kode: string;
  /** Jumlah peserta yang terdaftar ke kode ini. */
  jumlahPeserta: number;
}

/**
 * Membandingkan kode course1..14 peserta dengan shortname hasil konversi jadwal.
 * Hanya kode untuk tingkat yang sudah dikonvert yang diperiksa (tingkat = bagian ke-2 kode,
 * mis. USBK-XII-BINDO → XII). Hasil diurutkan menurut kode.
 */
export function kodeTidakCocok(
  peserta: PesertaMasuk[],
  hasilMapel: ReadonlyMap<string, readonly string[]>,
): { diperiksa: string[]; tidakCocok: KodeTidakCocok[] } {
  const ada = new Set([...hasilMapel.values()].flat());
  const hitung = new Map<string, number>();
  const diperiksa = new Set<string>();
  for (const p of peserta) {
    for (const kode of new Set(p.course)) {
      const tingkat = kode.split('-')[1] ?? '';
      if (!hasilMapel.has(tingkat)) continue;
      diperiksa.add(tingkat);
      if (!ada.has(kode)) hitung.set(kode, (hitung.get(kode) ?? 0) + 1);
    }
  }
  return {
    diperiksa: [...diperiksa].sort(),
    tidakCocok: [...hitung].map(([kode, jumlahPeserta]) => ({ kode, jumlahPeserta })).sort((a, b) => a.kode.localeCompare(b.kode)),
  };
}
