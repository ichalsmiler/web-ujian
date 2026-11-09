// Tab "User → CBTAdmin": upload data peserta → pratinjau → unduh template CBTAdmin terisi.
// Aturan: Nama Rombel & Kelas / Jurusan = KELAS, Ruang = RG., Kel. Sesi = 1,
// Username = nomor UJIAN, Password = acak 2 huruf + 2 angka + 2 huruf (mis. HJ86KL).

import templateUrl from '../assets/template-cbtadmin.xlsx?url';
import { GalatFormat, type PesertaCBT, type PesertaMasuk, type Peringatan } from '../core/tipe';
import { bacaUser, isiPassword, keCbt, kodeTidakCocok, tulisCbtCsv, tulisCbtXlsx } from '../core/user';
import { ambilHasilMapel, catatPeserta, saatHasilMapelBerubah, unduhCsv, unduhFile } from './simpan';
import { daftarPesan, el, tabel } from './tabel';

interface Status {
  namaFile: string;
  /** Peserta seperti terbaca dari file (password kosong untuk format DATA PESERTA). */
  asli: PesertaMasuk[];
  /** Peserta dengan password terisi; dibuat sekali agar pratinjau = file unduhan. */
  peserta: PesertaMasuk[];
  peringatan: Peringatan[];
  galat: Peringatan[];
  sheet: string[];
  /** '' = semua sheet. */
  sheetDipilih: string;
  tampilkanPassword: boolean;
}

const BATAS_PRATINJAU = 200;
const SEMUA = '';

function tanggalHariIni(): string {
  const d = new Date();
  const dua = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`;
}

let templateCache: Promise<ArrayBuffer> | null = null;
function muatTemplate(): Promise<ArrayBuffer> {
  templateCache ??= fetch(templateUrl).then((r) => {
    if (!r.ok) throw new Error(`template tidak bisa dimuat (${r.status})`);
    return r.arrayBuffer();
  });
  return templateCache;
}

/** Gabungkan banyak keterangan "tanpa nama" menjadi satu pesan agar daftar tidak panjang. */
function ringkasPesan(p: Peringatan[]): Peringatan[] {
  const info = p.filter((x) => x.tingkat === 'info');
  const lain = p.filter((x) => x.tingkat !== 'info');
  if (info.length <= 3) return p;
  const contoh = info.slice(0, 5).map((x) => x.lokasi).join('; ');
  return [
    ...lain,
    { tingkat: 'info', pesan: `${info.length} nomor ujian tanpa nama siswa dilewati (mis. ${contoh}${info.length > 5 ? '; …' : ''})` },
  ];
}

export function pasangTabUser(akar: HTMLElement): void {
  const s: Status = {
    namaFile: '',
    asli: [],
    peserta: [],
    peringatan: [],
    galat: [],
    sheet: [],
    sheetDipilih: SEMUA,
    tampilkanPassword: false,
  };

  saatHasilMapelBerubah(() => {
    if (s.peserta.some((p) => p.course.length)) gambar();
  });

  async function pilihFile(f: File): Promise<void> {
    Object.assign(s, { namaFile: f.name, asli: [], peserta: [], peringatan: [], galat: [], sheet: [], sheetDipilih: SEMUA, tampilkanPassword: false });
    try {
      const hasil = await bacaUser(await f.arrayBuffer(), f.name);
      s.asli = hasil.peserta;
      s.peserta = isiPassword(hasil.peserta);
      s.peringatan = hasil.peringatan;
      s.sheet = hasil.sheet;
      catatPeserta({ namaFile: f.name, peserta: s.peserta });
    } catch (e) {
      const pesan = e instanceof GalatFormat ? e.message : `Terjadi kesalahan tak terduga: ${String(e)}`;
      s.galat = [{ tingkat: 'galat', pesan }];
      catatPeserta(null);
    }
    gambar();
  }

  function terpilih(): PesertaMasuk[] {
    return s.sheetDipilih === SEMUA ? s.peserta : s.peserta.filter((p) => p.sheet === s.sheetDipilih);
  }

  function kartuUpload(): HTMLElement {
    const input = el('input', { type: 'file', accept: '.xlsx,.csv', id: 'file-user', class: 'sr-only' });
    input.addEventListener('change', () => {
      const f = input.files?.[0];
      if (f) void pilihFile(f);
      input.value = '';
    });
    return el(
      'div',
      { class: 'kartu' },
      el('h2', {}, el('span', { class: 'langkah' }, '1'), 'Upload data peserta'),
      el(
        'div',
        { class: 'baris-kontrol' },
        el('label', { class: 'tombol', for: 'file-user' }, s.namaFile ? 'Ganti file…' : 'Pilih file peserta (.xlsx)…'),
        input,
        s.namaFile ? el('span', {}, s.namaFile) : null,
      ),
      el(
        'p',
        { class: 'bantu' },
        'Format seperti "DATA PESERTA NO UJIAN": satu sheet per kelas dengan kolom UJIAN, NAMA SISWA, KELAS, RG. (File lama seperti USER MOODLE.csv juga masih bisa.)',
      ),
      el(
        'p',
        { class: 'bantu' },
        'Hasil: Nama Rombel dan Kelas / Jurusan = KELAS · Ruang = RG. · Kel. Sesi = 1 · Username = nomor UJIAN · Password = acak, mis. HJ86KL.',
      ),
      daftarPesan(s.galat),
    );
  }

  function kartuPilihSheet(): HTMLElement | null {
    if (s.sheet.length <= 1) return null;
    const jumlah = (nama: string) => s.peserta.filter((p) => p.sheet === nama).length;
    const sel = el(
      'select',
      { id: 'pilih-sheet-user' },
      el('option', { value: SEMUA, selected: s.sheetDipilih === SEMUA }, `Semua sheet (${s.peserta.length} peserta)`),
      ...s.sheet.map((n) => el('option', { value: n, selected: n === s.sheetDipilih }, `${n} (${jumlah(n)} peserta)`)),
    );
    sel.addEventListener('change', () => {
      s.sheetDipilih = sel.value;
      gambar();
    });
    return el(
      'div',
      { class: 'kartu' },
      el('h2', {}, el('span', { class: 'langkah' }, '2'), 'Pilih sheet'),
      el('div', { class: 'baris-kontrol' }, el('label', { for: 'pilih-sheet-user' }, 'Peserta dari:'), sel),
    );
  }

  function kartuKodeMapel(): HTMLElement | null {
    const peserta = terpilih();
    if (!peserta.some((p) => p.course.length)) return null; // hanya untuk file format lama yang punya course1..14
    const hasilMapel = ambilHasilMapel();
    if (hasilMapel.size === 0) {
      return el(
        'div',
        { class: 'kartu' },
        el('h2', {}, 'Cek kode mapel'),
        el('p', { class: 'kosong' }, 'Konvert jadwal di tab "Jadwal → Mapel" untuk memeriksa apakah kode course1–course14 peserta cocok dengan kode mapel.'),
      );
    }
    const { diperiksa, tidakCocok } = kodeTidakCocok(peserta, hasilMapel);
    let isi: Node;
    if (diperiksa.length === 0) {
      isi = el('p', { class: 'kosong' }, `Belum ada tingkat yang cocok untuk diperiksa. Mapel yang sudah dikonvert: kelas ${[...hasilMapel.keys()].join(', ')}.`);
    } else if (tidakCocok.length === 0) {
      isi = daftarPesan([{ tingkat: 'info', pesan: `Semua kode mapel peserta kelas ${diperiksa.join(', ')} ada di hasil konversi jadwal.` }])!;
    } else {
      isi = el(
        'div',
        {},
        daftarPesan([
          {
            tingkat: 'peringatan',
            pesan: `${tidakCocok.length} kode mapel di file peserta tidak ada di hasil konversi jadwal. Peserta dengan kode ini tidak akan masuk ke mapelnya.`,
          },
        ])!,
        tabel(
          [{ judul: 'Kode di file peserta' }, { judul: 'Jumlah peserta', angka: true }],
          tidakCocok.map((t) => ({ tanda: 'kuning' as const, sel: [t.kode, t.jumlahPeserta] })),
          'Kode mapel yang tidak cocok',
        ),
      );
    }
    return el('div', { class: 'kartu' }, el('h2', {}, 'Cek kode mapel'), isi);
  }

  function kartuPratinjau(cbt: PesertaCBT[]): HTMLElement {
    const tampil = cbt.slice(0, BATAS_PRATINJAU);
    const tombolPassword = el('button', { class: 'tombol', type: 'button', 'aria-pressed': String(s.tampilkanPassword) }, s.tampilkanPassword ? 'Sembunyikan password' : 'Tampilkan password');
    tombolPassword.addEventListener('click', () => {
      s.tampilkanPassword = !s.tampilkanPassword;
      gambar();
    });
    const adaYangDibuat = s.asli.some((p) => !p.password);
    const ulang = adaYangDibuat ? el('button', { class: 'tombol', type: 'button', id: 'tombol-password-ulang' }, 'Buat ulang password') : null;
    ulang?.addEventListener('click', () => {
      if (!confirm('Buat ulang semua password acak? Password yang sedang tampil akan diganti.')) return;
      s.peserta = isiPassword(s.asli);
      catatPeserta({ namaFile: s.namaFile, peserta: s.peserta });
      gambar();
    });

    const namaFile = `USER CBTADMIN${s.sheetDipilih ? ` ${s.sheetDipilih}` : ''} ${tanggalHariIni()}.xlsx`;
    const unduh = el('button', { class: 'tombol utama', type: 'button', id: 'tombol-unduh-user' }, `Unduh ${namaFile}`);
    const galatUnduh = el('span', { class: 'bantu', role: 'alert' });
    unduh.addEventListener('click', async () => {
      unduh.disabled = true;
      galatUnduh.textContent = '';
      try {
        unduhFile(namaFile, await tulisCbtXlsx(cbt, await muatTemplate()));
      } catch (e) {
        galatUnduh.textContent = `Gagal membuat file: ${e instanceof Error ? e.message : String(e)}`;
      } finally {
        unduh.disabled = false;
      }
    });

    const namaCsv = namaFile.replace(/\.xlsx$/, '.csv');
    const unduhCsvTombol = el('button', { class: 'tombol', type: 'button', id: 'tombol-unduh-user-csv' }, `Unduh ${namaCsv}`);
    unduhCsvTombol.addEventListener('click', () => unduhCsv(namaCsv, tulisCbtCsv(cbt)));

    const langkah = s.sheet.length > 1 ? '3' : '2';
    return el(
      'div',
      { class: 'kartu', id: 'kartu-user' },
      el('h2', {}, el('span', { class: 'langkah' }, langkah), 'Pratinjau & unduh'),
      daftarPesan(
        ringkasPesan(
          s.peringatan.filter((p) => !s.sheetDipilih || p.lokasi === s.sheetDipilih || p.lokasi?.startsWith(`${s.sheetDipilih} baris `)),
        ),
      ),
      el('div', { class: 'baris-kontrol' }, tombolPassword, ulang),
      adaYangDibuat
        ? el('p', { class: 'bantu' }, 'Password dibuat acak saat file di-upload. Simpan file hasil unduhan: password yang sama tidak bisa dibuat lagi.')
        : null,
      tabel(
        ['Nama Peserta', 'Nama Rombel', 'Kelas / Jurusan', 'Ruang', 'Kel. Sesi', 'Username', 'Password'].map((judul) => ({
          judul,
          angka: judul === 'Ruang' || judul === 'Kel. Sesi',
        })),
        tampil.map((p) => ({
          sel: [p.namaPeserta, p.namaRombel, p.kelasJurusan, p.ruang, p.kelSesi, p.username, s.tampilkanPassword ? p.password : p.password ? '••••••' : ''],
        })),
        'Pratinjau data peserta untuk CBTAdmin',
      ),
      el(
        'p',
        { class: 'jumlah' },
        `${cbt.length} peserta.${cbt.length > BATAS_PRATINJAU ? ` Pratinjau menampilkan ${BATAS_PRATINJAU} baris pertama; file unduhan berisi semuanya.` : ''}`,
      ),
      el('div', { class: 'baris-kontrol' }, unduh, unduhCsvTombol, galatUnduh),
      el('p', { class: 'bantu' }, 'File CSV berisi baris judul kolom lalu data peserta, tanpa baris petunjuk template.'),
    );
  }

  function gambar(): void {
    const fokus = document.activeElement?.id;
    const ada = s.peserta.length > 0;
    akar.replaceChildren(
      kartuUpload(),
      ...(ada ? [kartuPilihSheet(), kartuKodeMapel(), kartuPratinjau(keCbt(terpilih()))] : []).filter((x): x is HTMLElement => x !== null),
    );
    if (fokus) document.getElementById(fokus)?.focus();
  }

  gambar();
}
