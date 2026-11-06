// Tab "User → CBTAdmin": upload file peserta → pratinjau → unduh template CBTAdmin terisi.
// Perilaku sesuai specs/001-konverter-cbt/contracts/ui.md

import templateUrl from '../assets/template-cbtadmin.xlsx?url';
import { GalatFormat, type Pengaturan, type PesertaCBT, type PesertaMasuk, type Peringatan } from '../core/tipe';
import { bacaUser, keCbt, kodeTidakCocok, tulisCbtXlsx } from '../core/user';
import { ambilHasilMapel, muatPengaturan, saatHasilMapelBerubah, simpanPengaturan, unduhFile } from './simpan';
import { daftarPesan, el, tabel } from './tabel';

interface Status {
  namaFile: string;
  peserta: PesertaMasuk[];
  peringatan: Peringatan[];
  galat: Peringatan[];
  pengaturan: Pengaturan;
  tampilkanPassword: boolean;
}

const BATAS_PRATINJAU = 200;

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

export function pasangTabUser(akar: HTMLElement): void {
  const s: Status = {
    namaFile: '',
    peserta: [],
    peringatan: [],
    galat: [],
    pengaturan: muatPengaturan(),
    tampilkanPassword: false,
  };

  saatHasilMapelBerubah(() => {
    if (s.peserta.length) gambar();
  });

  async function pilihFile(f: File): Promise<void> {
    Object.assign(s, { namaFile: f.name, peserta: [], peringatan: [], galat: [], tampilkanPassword: false });
    try {
      const hasil = await bacaUser(await f.arrayBuffer(), f.name);
      s.peserta = hasil.peserta;
      s.peringatan = hasil.peringatan;
    } catch (e) {
      const pesan = e instanceof GalatFormat ? e.message : `Terjadi kesalahan tak terduga: ${String(e)}`;
      s.galat = [{ tingkat: 'galat', pesan }];
    }
    gambar();
  }

  function kartuUpload(): HTMLElement {
    const input = el('input', { type: 'file', accept: '.csv,.xlsx', id: 'file-user', class: 'sr-only' });
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
        el('label', { class: 'tombol', for: 'file-user' }, s.namaFile ? 'Ganti file…' : 'Pilih file peserta (.csv / .xlsx)…'),
        input,
        s.namaFile ? el('span', {}, s.namaFile) : null,
      ),
      el('p', { class: 'bantu' }, 'Format seperti USER MOODLE.csv: kolom username, password, firstname, lastname, department, address. Pemisah ; atau , keduanya bisa.'),
      daftarPesan(s.galat),
    );
  }

  function kartuPengaturan(): HTMLElement {
    const pilihan = (nilai: Pengaturan['kelasJurusan'], label: string) => {
      const r = el('input', { type: 'radio', name: 'kelas-jurusan', id: `kj-${nilai}`, value: nilai, checked: s.pengaturan.kelasJurusan === nilai });
      r.addEventListener('change', () => {
        s.pengaturan = { kelasJurusan: nilai };
        simpanPengaturan(s.pengaturan);
        gambar();
      });
      return el('label', { for: `kj-${nilai}`, class: 'baris-kontrol' }, r, label);
    };
    return el(
      'div',
      { class: 'kartu' },
      el('h2', {}, el('span', { class: 'langkah' }, '2'), 'Pengaturan'),
      el(
        'fieldset',
        { class: 'polos' },
        el('legend', {}, 'Kolom "Kelas / Jurusan" diisi dengan:'),
        el('div', { class: 'baris-kontrol' }, pilihan('tingkat', 'Tingkat (mis. XII)'), pilihan('rombel', 'Rombel (mis. XII-1)')),
      ),
    );
  }

  function kartuKodeMapel(): HTMLElement {
    const hasilMapel = ambilHasilMapel();
    if (hasilMapel.size === 0) {
      return el(
        'div',
        { class: 'kartu' },
        el('h2', {}, 'Cek kode mapel'),
        el('p', { class: 'kosong' }, 'Konvert jadwal di tab "Jadwal → Mapel" untuk memeriksa apakah kode course1–course14 peserta cocok dengan kode mapel.'),
      );
    }
    const { diperiksa, tidakCocok } = kodeTidakCocok(s.peserta, hasilMapel);
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
            pesan: `${tidakCocok.length} kode mapel di file peserta tidak ada di hasil konversi jadwal. Peserta dengan kode ini tidak akan masuk ke mapelnya. Samakan kodenya di kamus atau di file peserta.`,
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
    const unduh = el('button', { class: 'tombol utama', type: 'button', id: 'tombol-unduh-user' }, 'Unduh file CBTAdmin');
    const galatUnduh = el('span', { class: 'bantu', role: 'alert' });
    unduh.addEventListener('click', async () => {
      unduh.disabled = true;
      galatUnduh.textContent = '';
      try {
        const buf = await tulisCbtXlsx(cbt, await muatTemplate());
        unduhFile(`USER CBTADMIN ${tanggalHariIni()}.xlsx`, buf);
      } catch (e) {
        galatUnduh.textContent = `Gagal membuat file: ${e instanceof Error ? e.message : String(e)}`;
      } finally {
        unduh.disabled = false;
      }
    });
    return el(
      'div',
      { class: 'kartu', id: 'kartu-user' },
      el('h2', {}, el('span', { class: 'langkah' }, '3'), 'Pratinjau & unduh'),
      daftarPesan(s.peringatan),
      el('div', { class: 'baris-kontrol' }, tombolPassword),
      el('p', {}),
      tabel(
        ['Nama Peserta', 'Nama Rombel', 'Kelas / Jurusan', 'Ruang', 'Kel. Sesi', 'Username', 'Password'].map((judul) => ({ judul, angka: judul === 'Ruang' })),
        tampil.map((p) => ({
          sel: [p.namaPeserta, p.namaRombel, p.kelasJurusan, p.ruang, '', p.username, s.tampilkanPassword ? p.password : p.password ? '••••••' : ''],
        })),
        'Pratinjau data peserta untuk CBTAdmin',
      ),
      el(
        'p',
        { class: 'jumlah' },
        `${cbt.length} peserta.${cbt.length > BATAS_PRATINJAU ? ` Pratinjau menampilkan ${BATAS_PRATINJAU} baris pertama; file unduhan berisi semuanya.` : ''}`,
      ),
      el('div', { class: 'baris-kontrol' }, unduh, galatUnduh),
    );
  }

  function gambar(): void {
    const fokus = document.activeElement?.id;
    const ada = s.peserta.length > 0;
    akar.replaceChildren(
      kartuUpload(),
      kartuPengaturan(),
      ...(ada ? [kartuKodeMapel(), kartuPratinjau(keCbt(s.peserta, s.pengaturan))] : []),
    );
    if (fokus) document.getElementById(fokus)?.focus();
  }

  gambar();
}
