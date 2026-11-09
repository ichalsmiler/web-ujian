// Tab "User → Moodle": memakai peserta dari tab User → CBTAdmin (password yang sama) dan
// daftar mapel dari tab Jadwal → Mapel, lalu menghasilkan CSV seperti USER MOODLE.csv.

import { keMoodle, pengecualianAwal, tingkatPeserta, tulisMoodleCsv, uraiDaftarShortname } from '../core/moodle';
import { urutTingkat } from '../core/jadwal';
import { keCbt } from '../core/user';
import {
  ambilHasilMapel,
  ambilPeserta,
  mapelLengkap,
  muatPengecualian,
  saatHasilMapelBerubah,
  saatPesertaBerubah,
  simpanPengecualian,
  unduhCsv,
} from './simpan';
import { daftarPesan, el, tabel } from './tabel';

const BATAS_PRATINJAU = 200;
const SEMUA = '';

function tanggalHariIni(): string {
  const d = new Date();
  const dua = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`;
}

/** Tiga course pertama + "+N lainnya"; daftar lengkap ada di tooltip. File CSV tetap berisi semuanya. */
function ringkasCourse(course: string[]): HTMLElement {
  const tampil = course.slice(0, 3).map((c) => c.replace(/^USBK-[IVX]+-/, '')).join(', ');
  const sisa = course.length > 3 ? ` +${course.length - 3} lainnya` : '';
  return el('span', { class: 'ringkas-course', title: course.join('\n') }, tampil + sisa);
}

function bukaTab(id: string): void {
  document.getElementById(id)?.click();
  window.scrollTo({ top: 0 });
}

export function pasangTabMoodle(akar: HTMLElement): void {
  let kecuali = muatPengecualian(pengecualianAwal());
  let sheetDipilih = SEMUA;
  let tampilkanPassword = false;

  saatPesertaBerubah(() => {
    sheetDipilih = SEMUA;
    gambar();
  });
  saatHasilMapelBerubah(() => gambar());

  function tombolKe(tab: string, label: string): HTMLButtonElement {
    const b = el('button', { class: 'tombol', type: 'button' }, label);
    b.addEventListener('click', () => bukaTab(tab));
    return b;
  }

  function kartuSumber(tingkatAda: string[]): HTMLElement {
    const data = ambilPeserta();
    const mapel = ambilHasilMapel();
    const barisPeserta = data
      ? el('p', {}, `Peserta: ${data.peserta.length} siswa dari "${data.namaFile}" (tab User → CBTAdmin). Username, password, dan nama sama dengan file CBTAdmin.`)
      : el(
          'div',
          { class: 'baris-kontrol' },
          el('span', { class: 'kosong' }, 'Belum ada data peserta. Upload file peserta dulu di tab User → CBTAdmin.'),
          tombolKe('tab-btn-user', 'Buka tab User → CBTAdmin'),
        );
    const statusMapel = tingkatAda.length
      ? tabel(
          [{ judul: 'Kelas' }, { judul: 'Mapel dari jadwal' }],
          tingkatAda.map((t) => {
            const d = mapel.get(t);
            const teks = !d ? 'Belum dikonvert' : mapelLengkap(t) ? `${d.length} mapel` : `${d.length} mapel — masih ada nama mapel belum dikenal (baris merah)`;
            return { tanda: !d ? ('merah' as const) : mapelLengkap(t) ? undefined : ('kuning' as const), sel: [t, teks] };
          }),
          'Status daftar mapel per kelas',
        )
      : null;
    const perluJadwal = tingkatAda.some((t) => !mapel.has(t) || !mapelLengkap(t));
    return el(
      'div',
      { class: 'kartu' },
      el('h2', {}, el('span', { class: 'langkah' }, '1'), 'Sumber data'),
      barisPeserta,
      statusMapel,
      perluJadwal
        ? el(
            'div',
            { class: 'baris-kontrol' },
            el('span', { class: 'bantu' }, 'Course diisi dari hasil konversi jadwal. Tekan "Konvert semua kelas" di tab Jadwal → Mapel.'),
            tombolKe('tab-btn-jadwal', 'Buka tab Jadwal → Mapel'),
          )
        : null,
    );
  }

  function kartuPengecualian(tingkatAda: string[]): HTMLElement {
    const daftarTingkat = urutTingkat([...new Set(['X', 'XI', 'XII', ...tingkatAda])]);
    const kolom = daftarTingkat.map((t) => {
      const id = `kecuali-${t}`;
      const area = el('textarea', { id, rows: '8', spellcheck: 'false', class: 'daftar-kode' });
      area.value = (kecuali[t] ?? []).join('\n');
      area.addEventListener('change', () => {
        kecuali = { ...kecuali, [t]: uraiDaftarShortname(area.value) };
        simpanPengecualian(kecuali);
        gambar();
      });
      return el('div', { class: 'kolom-kecuali' }, el('label', { for: id }, `Kelas ${t}`), area);
    });
    const kembali = el('button', { class: 'tombol', type: 'button' }, 'Kembalikan ke awal');
    kembali.addEventListener('click', () => {
      if (!confirm('Kembalikan daftar mapel pilihan ke daftar awal?')) return;
      kecuali = pengecualianAwal();
      simpanPengecualian(kecuali);
      gambar();
    });
    return el(
      'div',
      { class: 'kartu' },
      el('h2', {}, el('span', { class: 'langkah' }, '2'), 'Mapel pilihan (tidak didaftarkan)'),
      el(
        'p',
        { class: 'bantu' },
        'Siswa didaftarkan ke semua mapel kelasnya, kecuali shortname di bawah ini. Satu shortname per baris; perubahan disimpan otomatis.',
      ),
      el('div', { class: 'grid-kecuali' }, ...kolom),
      el('div', { class: 'baris-kontrol' }, kembali),
    );
  }

  function kartuHasil(): HTMLElement | null {
    const data = ambilPeserta();
    if (!data) return null;
    const sheet = [...new Set(data.peserta.map((p) => p.sheet).filter((x): x is string => !!x))];
    const peserta = sheetDipilih ? data.peserta.filter((p) => p.sheet === sheetDipilih) : data.peserta;
    const { baris, peringatan, tingkatTanpaMapel } = keMoodle(peserta, keCbt(peserta), ambilHasilMapel(), kecuali);
    const belumLengkap = [...new Set(baris.map((b) => b.tingkat))].filter((t) => ambilHasilMapel().has(t) && !mapelLengkap(t));
    const pesan = [
      ...peringatan,
      ...belumLengkap.map((t) => ({
        tingkat: 'peringatan' as const,
        pesan: `Daftar mapel kelas ${t} belum lengkap: masih ada nama mapel belum dikenal di tab Jadwal → Mapel, jadi mapel itu tidak ikut di course`,
      })),
    ];

    let pilihSheet: HTMLElement | null = null;
    if (sheet.length > 1) {
      const sel = el(
        'select',
        { id: 'pilih-sheet-moodle' },
        el('option', { value: SEMUA, selected: !sheetDipilih }, `Semua sheet (${data.peserta.length} peserta)`),
        ...sheet.map((n) => el('option', { value: n, selected: n === sheetDipilih }, `${n} (${data.peserta.filter((p) => p.sheet === n).length} peserta)`)),
      );
      sel.addEventListener('change', () => {
        sheetDipilih = sel.value;
        gambar();
      });
      pilihSheet = el('div', { class: 'baris-kontrol' }, el('label', { for: 'pilih-sheet-moodle' }, 'Peserta dari:'), sel);
    }

    const tombolPassword = el('button', { class: 'tombol', type: 'button', 'aria-pressed': String(tampilkanPassword) }, tampilkanPassword ? 'Sembunyikan password' : 'Tampilkan password');
    tombolPassword.addEventListener('click', () => {
      tampilkanPassword = !tampilkanPassword;
      gambar();
    });

    const namaFile = `USER MOODLE${sheetDipilih ? ` ${sheetDipilih}` : ''} ${tanggalHariIni()}.csv`;
    const unduh = el('button', { class: 'tombol utama', type: 'button', id: 'tombol-unduh-moodle', disabled: tingkatTanpaMapel.length > 0 }, `Unduh ${namaFile}`);
    unduh.addEventListener('click', () => unduhCsv(namaFile, tulisMoodleCsv(baris)));
    const maksCourse = Math.max(0, ...baris.map((b) => b.course.length));

    return el(
      'div',
      { class: 'kartu', id: 'kartu-moodle' },
      el('h2', {}, el('span', { class: 'langkah' }, '3'), 'Pratinjau & unduh'),
      pilihSheet,
      daftarPesan(pesan),
      el('div', { class: 'baris-kontrol' }, tombolPassword),
      el('p', {}),
      tabel(
        [
          { judul: 'username' },
          { judul: 'password' },
          { judul: 'firstname' },
          { judul: 'lastname' },
          { judul: 'email' },
          { judul: 'department' },
          { judul: 'address', angka: true },
          { judul: 'Jumlah course', angka: true },
          { judul: 'course' },
        ],
        baris.slice(0, BATAS_PRATINJAU).map((b) => ({
          tanda: b.course.length === 0 ? ('merah' as const) : undefined,
          sel: [
            b.username,
            tampilkanPassword ? b.password : '••••••',
            b.firstname,
            b.lastname,
            b.email,
            b.department,
            b.address,
            b.course.length,
            ringkasCourse(b.course),
          ],
        })),
        'Pratinjau data user Moodle',
      ),
      el(
        'p',
        { class: 'jumlah' },
        `${baris.length} peserta, paling banyak ${maksCourse} course per siswa (kolom course1–course${Math.max(14, maksCourse)}).` +
          (baris.length > BATAS_PRATINJAU ? ` Pratinjau menampilkan ${BATAS_PRATINJAU} baris pertama; file unduhan berisi semuanya.` : ''),
      ),
      el('div', { class: 'baris-kontrol' }, unduh),
      el('p', { class: 'bantu' }, 'Format sama dengan USER MOODLE.csv: pemisah titik koma (;), email = username@smada.id.'),
    );
  }

  function gambar(): void {
    const fokus = document.activeElement?.id;
    const data = ambilPeserta();
    const tingkatAda = urutTingkat([...new Set((data?.peserta ?? []).map(tingkatPeserta).filter(Boolean))]);
    akar.replaceChildren(...[kartuSumber(tingkatAda), kartuPengecualian(tingkatAda), kartuHasil()].filter((x): x is HTMLElement => x !== null));
    if (fokus) document.getElementById(fokus)?.focus();
  }

  gambar();
}
