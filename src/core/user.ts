// Konversi file peserta ke template upload user CBTAdmin.
// Format utama: "DATA PESERTA NO UJIAN" (.xlsx, satu sheet per tingkat, kolom UJIAN, NAMA SISWA, KELAS, RG.).
// Format lama: CSV/XLSX seperti USER MOODLE.csv (kolom username, password, firstname, department, address).

import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { teksSel } from './tanggal';
import { GalatFormat, type PesertaCBT, type PesertaMasuk, type Peringatan } from './tipe';

const KOLOM_WAJIB = ['username', 'firstname', 'department'] as const;
const BATAS_CARI_HEADER = 20;
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

async function muatXlsx(buf: ArrayBuffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buf);
  } catch {
    throw new GalatFormat('File Excel tidak bisa dibuka. Simpan ulang sebagai .xlsx atau .csv.');
  }
  if (wb.worksheets.length === 0) throw new GalatFormat('File Excel tidak berisi sheet.');
  return wb;
}

function barisSheet(ws: ExcelJS.Worksheet): string[][] {
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

export interface HasilBacaUser {
  peserta: PesertaMasuk[];
  peringatan: Peringatan[];
  /** Sheet yang berisi peserta (format DATA PESERTA); kosong untuk format lama. */
  sheet: string[];
}

const normalHeader = (s: string) => s.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();

/** Bagian romawi di depan nama rombel: "XII-1" → "XII". Jika tidak ada, '' . */
function tingkatDariRombel(rombel: string): string {
  const m = /^([IVX]+)(?=$|[\s\-._/])/i.exec(rombel.trim());
  return m ? m[1].toUpperCase() : '';
}

/** "KLS. XI" → "XI"; '' jika nama sheet tidak berakhir dengan angka romawi. */
function tingkatDariSheet(nama: string): string {
  const m = /(?:^|[\s.])([IVX]+)\s*$/i.exec(nama.trim());
  return m ? m[1].toUpperCase() : '';
}

interface HeaderPeserta {
  baris: number;
  ujian: number;
  nama: number;
  kelas: number;
  rg: number;
}

function cariHeaderPeserta(b: string[][]): HeaderPeserta | null {
  for (let i = 0; i < Math.min(b.length, BATAS_CARI_HEADER); i++) {
    const h = b[i].map(normalHeader);
    const ujian = h.indexOf('ujian');
    const nama = h.findIndex((x) => x === 'nama siswa' || x === 'nama');
    const kelas = h.indexOf('kelas');
    if (ujian >= 0 && nama >= 0 && kelas >= 0) {
      return { baris: i, ujian, nama, kelas, rg: h.findIndex((x) => x === 'rg' || x === 'ruang') };
    }
  }
  return null;
}

/** Format DATA PESERTA NO UJIAN: setiap sheet yang punya header UJIAN, NAMA SISWA, KELAS. */
function bacaDataPeserta(wb: ExcelJS.Workbook): HasilBacaUser | null {
  const peserta: PesertaMasuk[] = [];
  const peringatan: Peringatan[] = [];
  const sheet: string[] = [];

  for (const ws of wb.worksheets) {
    const b = barisSheet(ws);
    const h = cariHeaderPeserta(b);
    if (!h) continue;
    sheet.push(ws.name);
    const tingkatSheet = tingkatDariSheet(ws.name);
    const kelasBeda = new Set<string>();

    for (let i = h.baris + 1; i < b.length; i++) {
      const ujian = (b[i][h.ujian] ?? '').trim();
      const nama = (b[i][h.nama] ?? '').trim().replace(/\s+/g, ' ');
      const kelas = (b[i][h.kelas] ?? '').trim();
      if (!ujian || normalHeader(ujian) === 'ujian') continue; // baris kosong atau header berulang
      const lokasi = `${ws.name} baris ${i + 1}`;
      if (!nama) {
        peringatan.push({ tingkat: 'info', pesan: `Nomor ujian ${ujian} tidak punya nama siswa, dilewati`, lokasi });
        continue;
      }
      const tk = tingkatDariRombel(kelas);
      if (tingkatSheet && tk && tk !== tingkatSheet) kelasBeda.add(kelas);
      peserta.push({
        username: ujian,
        password: '',
        firstname: nama,
        lastname: '',
        department: kelas,
        address: h.rg >= 0 ? (b[i][h.rg] ?? '').trim() : '',
        course: [],
        baris: i + 1,
        sheet: ws.name,
      });
    }
    if (kelasBeda.size) {
      const daftar = [...kelasBeda].sort((x, y) => x.localeCompare(y, 'id', { numeric: true }));
      peringatan.push({
        tingkat: 'peringatan',
        pesan: `Kolom KELAS berisi ${daftar.join(', ')}, padahal sheet ini untuk kelas ${tingkatSheet}. Periksa apakah kolom KELAS sudah diperbarui; nilai ini dipakai apa adanya untuk Nama Rombel dan Kelas / Jurusan`,
        lokasi: ws.name,
      });
    }
  }
  if (sheet.length === 0) return null;
  if (peserta.length === 0) throw new GalatFormat('Tabel peserta ditemukan, tetapi tidak ada siswa yang bernama.');
  return { peserta, peringatan, sheet };
}

export async function bacaUser(file: ArrayBuffer, namaFile: string): Promise<HasilBacaUser> {
  let semua: string[][];
  if (apakahXlsx(file, namaFile)) {
    const wb = await muatXlsx(file);
    const dataPeserta = bacaDataPeserta(wb);
    if (dataPeserta) return dataPeserta;
    semua = barisSheet(wb.worksheets[0]);
    const header = (semua.find((b) => b.some((s) => s.trim())) ?? []).map((s) => s.trim().toLowerCase());
    if (!header.includes('username')) {
      throw new GalatFormat(
        'Tabel peserta tidak ditemukan. File harus seperti "DATA PESERTA NO UJIAN" (kolom UJIAN, NAMA SISWA, KELAS, RG.) atau berisi kolom username, firstname, department.',
      );
    }
  } else {
    semua = barisCsv(file);
  }
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
  return { peserta, peringatan, sheet: [] };
}

// ---------- password ----------

const HURUF = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ANGKA = '0123456789';

/** Angka acak [0, 1) dari crypto (lebih aman daripada Math.random untuk password). */
export function acakKripto(): number {
  const u = new Uint32Array(1);
  crypto.getRandomValues(u);
  return u[0] / 2 ** 32;
}

/** Password 6 karakter: 2 huruf kapital, 2 angka, 2 huruf kapital — mis. HJ86KL. */
export function buatPassword(acak: () => number = acakKripto): string {
  const ambil = (dari: string) => dari[Math.min(dari.length - 1, Math.floor(acak() * dari.length))];
  return ambil(HURUF) + ambil(HURUF) + ambil(ANGKA) + ambil(ANGKA) + ambil(HURUF) + ambil(HURUF);
}

/**
 * Mengisi password yang kosong dengan password acak, tanpa ada yang sama dalam satu file.
 * Password yang sudah ada (format lama) dipertahankan. Input tidak diubah.
 */
export function isiPassword(peserta: PesertaMasuk[], acak: () => number = acakKripto): PesertaMasuk[] {
  const dipakai = new Set(peserta.map((p) => p.password).filter(Boolean));
  return peserta.map((p) => {
    if (p.password) return { ...p };
    let pw = buatPassword(acak);
    for (let coba = 0; dipakai.has(pw) && coba < 1000; coba++) pw = buatPassword(acak);
    dipakai.add(pw);
    return { ...p, password: pw };
  });
}

// ---------- pemetaan ke CBTAdmin ----------

/**
 * Aturan sekolah: Nama Rombel dan Kelas / Jurusan = kolom KELAS, Ruang = kolom RG.,
 * Kel. Sesi = 1 untuk semua, Username = nomor UJIAN.
 */
export function keCbt(peserta: PesertaMasuk[]): PesertaCBT[] {
  return peserta.map((p) => {
    const rombel = p.department.trim();
    const nama = p.firstname.trim().replace(/\s+/g, ' ');
    const belakang = p.lastname.trim();
    const ruang = p.address.trim();
    return {
      namaPeserta: belakang && belakang !== rombel ? `${nama} ${belakang}` : nama,
      namaRombel: rombel,
      kelasJurusan: rombel,
      ruang: /^\d+$/.test(ruang) ? Number(ruang) : null,
      kelSesi: 1,
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
