// Membuat file contoh "DATA PESERTA NO UJIAN" dengan struktur sama seperti file sekolah,
// tetapi seluruh isinya PALSU (nama, nomor ujian, NIS, NISN).

import ExcelJS from 'exceljs';

export interface BarisContoh {
  ujian: string;
  nama: string;
  kelas: string;
  rg: number | string;
}

function sheetPeserta(wb: ExcelJS.Workbook, namaSheet: string, data: BarisContoh[], kolomBantu = false): void {
  const ws = wb.addWorksheet(namaSheet);
  const judul = ['UPT SMA CONTOH', 'DAFTAR PESERTA', 'PENILAIAN SUMATIF AKHIR SEMESTER GANJIL', 'TAHUN AJARAN 2026/2027'];
  judul.forEach((t, i) => {
    ws.getCell(i + 1, 1).value = t;
    ws.mergeCells(i + 1, 1, i + 1, 8);
  });
  ws.getCell('A6').value = 'NOMOR';
  ws.mergeCells('A6:D6');
  ws.getCell('A7').value = 'URT';
  ws.getCell('B7').value = 'UJIAN';
  ws.getCell('C7').value = 'NIS';
  ws.getCell('D7').value = 'NISN';
  for (const [kol, teks] of [['E', 'NAMA  SISWA'], ['F', 'JK'], ['G', 'KELAS'], ['H', 'RG.']] as const) {
    ws.getCell(`${kol}6`).value = teks;
    ws.mergeCells(`${kol}6:${kol}7`);
  }
  data.forEach((d, i) => {
    const r = 8 + i;
    ws.getCell(r, 1).value = i + 1;
    ws.getCell(r, 2).value = d.ujian;
    ws.getCell(r, 3).value = d.nama ? 9000000 + i : null;
    ws.getCell(r, 4).value = d.nama ? String(1000000000 + i) : null;
    ws.getCell(r, 5).value = d.nama || null;
    ws.getCell(r, 6).value = d.nama ? (i % 2 ? 'L' : 'P') : null;
    ws.getCell(r, 7).value = d.kelas;
    ws.getCell(r, 8).value = d.rg;
    if (kolomBantu) {
      ws.getCell(r, 9).value = i + 1; // tabel bantu di kanan, harus diabaikan
      ws.getCell(r, 10).value = i + 1;
    }
  });
}

/** 3 sheet seperti file asli. Sheet KLS. XI sengaja berisi KELAS "X-…" (seperti data asli yang belum diperbarui). */
export async function bukuContohPeserta(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  sheetPeserta(
    wb,
    'KLS. X',
    [
      { ujian: '91-26-0001', nama: 'Siswa Contoh Satu', kelas: 'X-1', rg: 1 },
      { ujian: '91-26-0002', nama: 'SISWA  CONTOH   DUA', kelas: 'X-1', rg: 1 },
      { ujian: '91-26-0003', nama: '', kelas: 'X-1', rg: 1 }, // slot kosong
      { ujian: '91-26-0004', nama: 'Siswa Contoh Empat.', kelas: 'X-2', rg: '2' },
    ],
    true,
  );
  sheetPeserta(wb, 'KLS. XI', [
    { ujian: '92-26-0001', nama: 'Siswa Sebelas Satu', kelas: 'X-1', rg: 1 },
    { ujian: '92-26-0002', nama: 'Siswa Sebelas Dua', kelas: 'X-2', rg: 2 },
  ]);
  sheetPeserta(wb, 'KLS. XII', [
    { ujian: '93-26-0001', nama: 'Siswa Duabelas Satu', kelas: 'XII-1', rg: 11 },
    { ujian: '93-26-0002', nama: '', kelas: 'XII-1', rg: 11 },
  ]);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
