// Membuat fixture tes dan aset template dari file contoh asli di root proyek.
// File asli tidak di-commit; hasil skrip ini tidak berisi data pribadi.
//
//   npm run fixture
//
// users-sample.csv TIDAK dibuat dari USER MOODLE.csv; file itu ditulis manual
// dengan data palsu.

import ExcelJS from 'exceljs';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('../', import.meta.url);
const p = (rel: string) => fileURLToPath(new URL(rel, ROOT));

function wajibAda(nama: string): void {
  if (!existsSync(p(nama))) {
    console.error(`File contoh "${nama}" tidak ditemukan di root proyek.`);
    process.exit(1);
  }
}

/** Kosongkan blok tanda tangan (mulai dari baris tempat/tanggal sebelum "Kepala Sekolah"). */
async function jadwalTanpaTandaTangan(): Promise<void> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(p('jadwal.xlsx'));
  for (const ws of wb.worksheets) {
    let barisKepsek = 0;
    ws.eachRow((row, n) => {
      row.eachCell((cell) => {
        if (!barisKepsek && /kepala\s+sekolah/i.test(String(cell.value ?? ''))) barisKepsek = n;
      });
    });
    if (!barisKepsek) continue;
    const mulai = barisKepsek - 1; // baris "Makassar, <tanggal>"
    for (let r = mulai; r <= ws.rowCount; r++) {
      ws.getRow(r).eachCell({ includeEmpty: true }, (cell) => {
        cell.value = null;
      });
    }
  }
  await wb.xlsx.writeFile(p('tests/fixtures/jadwal-2026.xlsx'));
}

/** Template CBTAdmin tanpa 2 baris contoh "User Coba". */
async function templateCbt(): Promise<void> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(p('user cbtadmin.xlsx'));
  const ws = wb.worksheets[0];
  for (let r = 10; r <= ws.rowCount; r++) {
    ws.getRow(r).eachCell({ includeEmpty: true }, (cell) => {
      cell.value = null;
    });
  }
  const tujuan = p('tests/fixtures/template-cbtadmin.xlsx');
  await wb.xlsx.writeFile(tujuan);
  copyFileSync(tujuan, p('src/assets/template-cbtadmin.xlsx'));
}

for (const f of ['jadwal.xlsx', 'MAPEL FIX.xlsx', 'user cbtadmin.xlsx']) wajibAda(f);
mkdirSync(p('tests/fixtures'), { recursive: true });
mkdirSync(p('src/assets'), { recursive: true });

await jadwalTanpaTandaTangan();
copyFileSync(p('MAPEL FIX.xlsx'), p('tests/fixtures/mapel-fix.xlsx'));
await templateCbt();
console.log('Fixture dibuat di tests/fixtures/ dan src/assets/.');
