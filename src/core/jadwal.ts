// Membaca file jadwal ujian (.xlsx) seperti jadwal.xlsx.
// Struktur dicari dari teks header, bukan dari posisi kolom tetap (FR-001).

import ExcelJS from 'exceljs';
import { teksSel, uraiTanggal } from './tanggal';
import { GalatFormat, type HariUjian, type JadwalUjian, type Peringatan, type Sesi } from './tipe';

const NAMA_HARI = ['senin', 'selasa', 'rabu', 'kamis', 'jumat', "jum'at", 'sabtu', 'minggu'];
const BATAS_CARI_HEADER = 40;

async function muat(file: ArrayBuffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(file);
  } catch {
    throw new GalatFormat('File tidak bisa dibuka. Pastikan file berformat Excel (.xlsx), bukan .xls atau PDF.');
  }
  return wb;
}

export async function daftarSheet(file: ArrayBuffer): Promise<string[]> {
  const wb = await muat(file);
  return wb.worksheets.map((ws) => ws.name);
}

/** Nilai sel; sel "anak" dari sel gabungan (merge) dianggap kosong agar tidak terbaca dua kali. */
function teks(ws: ExcelJS.Worksheet, baris: number, kolom: number): string {
  const c = ws.getCell(baris, kolom);
  if (c.isMerged && c.master.address !== c.address) return '';
  return teksSel(c.value);
}

interface Header {
  baris: number;
  kolomHari: number;
  kolomJam: number | null;
  tingkat: { nama: string; kolom: number }[];
}

function cariHeader(ws: ExcelJS.Worksheet): Header {
  const maks = Math.min(ws.rowCount, BATAS_CARI_HEADER);
  for (let r = 1; r <= maks; r++) {
    const row = ws.getRow(r);
    let kolomHari = 0;
    row.eachCell((cell, c) => {
      if (!kolomHari && /^hari\s*\/\s*(tgl|tanggal)$/i.test(teksSel(cell.value))) kolomHari = c;
    });
    if (!kolomHari) continue;

    let kolomJam: number | null = null;
    const tingkat: Header['tingkat'] = [];
    row.eachCell((cell, c) => {
      const t = teksSel(cell.value).replace(/\s+/g, ' ');
      if (/^jam$/i.test(t)) kolomJam = c;
      const k = /^kelas\s+([ivx]+)$/i.exec(t);
      if (k) tingkat.push({ nama: k[1].toUpperCase(), kolom: c });
    });
    if (tingkat.length === 0) {
      throw new GalatFormat(
        `Header jadwal ditemukan di baris ${r}, tetapi tidak ada kolom "KELAS X", "KELAS XI", atau "KELAS XII".`,
      );
    }
    return { baris: r, kolomHari, kolomJam, tingkat };
  }
  throw new GalatFormat(
    'Ini sepertinya bukan file jadwal: sel "HARI/TGL" tidak ditemukan. Header jadwal harus berisi HARI/TGL, JAM, WAKTU, dan KELAS ….',
  );
}

function pecahMapel(isi: string): string[] {
  return isi
    .split(',')
    .map((s) => s.trim().replace(/\s+/g, ' '))
    .filter((s) => s.length > 0);
}

export async function bacaJadwal(file: ArrayBuffer, namaSheet: string): Promise<JadwalUjian> {
  const wb = await muat(file);
  const ws = wb.getWorksheet(namaSheet);
  if (!ws) throw new GalatFormat(`Sheet "${namaSheet}" tidak ada di file ini.`);

  const h = cariHeader(ws);
  const peringatan: Peringatan[] = [];
  const hari: (HariUjian & { barisAwal: number })[] = [];
  const kolomTingkat = Object.fromEntries(h.tingkat.map((t) => [t.nama, ws.getColumn(t.kolom).letter]));

  for (let r = h.baris + 1; r <= ws.rowCount; r++) {
    const isiHari = teks(ws, r, h.kolomHari);
    const jam = h.kolomJam ? teks(ws, r, h.kolomJam).toUpperCase() : '';
    const mapelPerTingkat: Record<string, string[]> = {};
    let adaMapel = false;
    for (const t of h.tingkat) {
      const m = pecahMapel(teks(ws, r, t.kolom));
      mapelPerTingkat[t.nama] = m;
      if (m.length) adaMapel = true;
    }

    if (!isiHari && !jam && !adaMapel) {
      if (hari.length) break; // akhir tabel jadwal
      continue;
    }

    const namaHari = NAMA_HARI.includes(isiHari.toLowerCase()) ? isiHari : '';
    const tanggal = uraiTanggal(ws.getCell(r, h.kolomHari).value);
    const hariBaru = namaHari !== '' || jam === 'I' || hari.length === 0;
    if (hariBaru) {
      hari.push({ namaHari, tanggal: null, susulan: false, sesi: [], barisAwal: r });
    }
    const kini = hari[hari.length - 1];
    if (namaHari && !kini.namaHari) kini.namaHari = namaHari;
    if (tanggal && !kini.tanggal) kini.tanggal = tanggal;

    if (adaMapel || jam) {
      const sesi: Sesi = { nomor: jam === 'I' || jam === 'II' ? jam : '', mapelPerTingkat, baris: r };
      kini.sesi.push(sesi);
    }
  }

  for (const [i, d] of hari.entries()) {
    const semua = d.sesi.flatMap((s) => Object.values(s.mapelPerTingkat).flat());
    d.susulan = semua.length > 0 && semua.every((m) => /^susulan$/i.test(m));
    if (!d.tanggal) {
      peringatan.push({
        tingkat: 'peringatan',
        pesan: `Tanggal hari ke-${i + 1}${d.namaHari ? ` (${d.namaHari})` : ''} tidak terbaca; urutan baris tetap dipakai`,
        lokasi: `${ws.getColumn(h.kolomHari).letter}${d.barisAwal}`,
      });
    }
  }

  const adaUjian = hari.some((d) => !d.susulan && d.sesi.some((s) => Object.values(s.mapelPerTingkat).some((m) => m.length)));
  if (!adaUjian) throw new GalatFormat('Jadwal tidak berisi satu pun mata pelajaran.');

  return {
    namaSheet,
    tingkat: h.tingkat.map((t) => t.nama),
    kolomTingkat,
    hari: hari.map(({ barisAwal: _, ...d }) => d),
    peringatan,
  };
}
