// File contoh "DAFTAR HADIR KELAS MOVING XI <MAPEL>.xlsx" dengan struktur sama seperti file sekolah,
// tetapi semua nama PALSU.

import ExcelJS from 'exceljs';

export async function bukuContohMoving(kelompok: { judul: string; siswa: [string, string][] }[], sheetKosong = true): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  kelompok.forEach((k, i) => {
    const ws = wb.addWorksheet(i === 0 ? '1' : `(${i + 1})`);
    ws.getCell('A1').value = 'DAFTAR HADIR MURID';
    ws.mergeCells('A1:L1');
    ws.getCell('A2').value = k.judul;
    ws.getCell('A3').value = 'NO';
    ws.getCell('B3').value = 'NAMA MURID';
    ws.getCell('C3').value = 'KELAS';
    ws.getCell('D3').value = 'PERTEMUAN';
    ws.mergeCells('A3:A4');
    ws.mergeCells('B3:B4');
    ws.mergeCells('C3:C4');
    ws.mergeCells('D3:L3');
    for (let p = 1; p <= 9; p++) ws.getCell(4, 3 + p).value = p;
    k.siswa.forEach(([nama, kelas], j) => {
      ws.getCell(5 + j, 1).value = j + 1;
      ws.getCell(5 + j, 2).value = nama;
      ws.getCell(5 + j, 3).value = kelas;
    });
  });
  if (sheetKosong) {
    const ws = wb.addWorksheet(`(${kelompok.length + 1})`); // sheet cadangan tanpa murid
    ws.getCell('A1').value = 'DAFTAR HADIR MURID';
    ws.getCell('A3').value = 'NO';
    ws.getCell('B3').value = 'NAMA MURID';
    ws.getCell('C3').value = 'KELAS';
  }
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
