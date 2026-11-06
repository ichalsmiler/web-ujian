// Tab "Jadwal → Mapel": upload jadwal → pilih sheet & tingkat → Konvert → pratinjau → unduh.
// Perilaku sesuai specs/001-konverter-cbt/contracts/ui.md

import { bacaJadwal, daftarSheet } from '../core/jadwal';
import { cocokkanJadwal, kunciPilihan, tambahAlias, tambahMapel } from '../core/kamus';
import { susunBarisMapel, tulisMapelXlsx } from '../core/mapel';
import { formatTanggal } from '../core/tanggal';
import { GalatFormat, type HasilCocok, type JadwalUjian, type Kamus, type Peringatan, type PilihanMapel } from '../core/tipe';
import { muatKamus, muatPilihan, saatKamusBerubah, simpanKamus, simpanPilihan, unduhFile } from './simpan';
import { daftarPesan, el, tabel, type BarisTabel } from './tabel';

interface Status {
  file: ArrayBuffer | null;
  namaFile: string;
  sheet: string[];
  sheetDipilih: string;
  jadwal: JadwalUjian | null;
  galat: Peringatan[];
  tingkat: string;
  sudahKonvert: boolean;
  kamus: Kamus;
  /** Per tingkat. */
  pilihan: Record<string, PilihanMapel>;
}

const PILIH_BARU = '__baru__';
const PILIH_ABAIKAN = '__abaikan__';

export function pasangTabJadwal(akar: HTMLElement): void {
  const s: Status = {
    file: null,
    namaFile: '',
    sheet: [],
    sheetDipilih: '',
    jadwal: null,
    galat: [],
    tingkat: '',
    sudahKonvert: false,
    kamus: muatKamus(),
    pilihan: {},
  };

  saatKamusBerubah((k) => {
    s.kamus = k;
    gambar();
  });

  function pesanGalat(e: unknown): Peringatan[] {
    const pesan = e instanceof GalatFormat ? e.message : `Terjadi kesalahan tak terduga: ${String(e)}`;
    return [{ tingkat: 'galat', pesan }];
  }

  async function pilihFile(f: File): Promise<void> {
    Object.assign(s, { file: null, namaFile: f.name, sheet: [], sheetDipilih: '', jadwal: null, galat: [], tingkat: '', sudahKonvert: false });
    try {
      s.file = await f.arrayBuffer();
      s.sheet = await daftarSheet(s.file);
      await bacaSheet(s.sheet[0]);
    } catch (e) {
      s.galat = pesanGalat(e);
      gambar();
    }
  }

  async function bacaSheet(nama: string): Promise<void> {
    s.sheetDipilih = nama;
    s.jadwal = null;
    s.galat = [];
    s.sudahKonvert = false;
    try {
      s.jadwal = await bacaJadwal(s.file!, nama);
      s.pilihan = muatPilihan(nama);
      if (!s.jadwal.tingkat.includes(s.tingkat)) s.tingkat = s.jadwal.tingkat[0];
    } catch (e) {
      s.galat = pesanGalat(e);
    }
    gambar();
  }

  function aturPilihan(lokasi: string, teks: string, kode: string[] | null): void {
    const p = { ...(s.pilihan[s.tingkat] ?? {}) };
    const k = kunciPilihan(lokasi, teks);
    if (kode === null) delete p[k];
    else p[k] = kode;
    s.pilihan = { ...s.pilihan, [s.tingkat]: p };
    simpanPilihan(s.sheetDipilih, s.pilihan);
    gambar();
  }

  function gantiKamus(f: () => Kamus): string | null {
    try {
      simpanKamus(f()); // memicu gambar() lewat saatKamusBerubah
      return null;
    } catch (e) {
      return e instanceof GalatFormat ? e.message : String(e);
    }
  }

  // ---------- tampilan ----------

  function kartuUpload(): HTMLElement {
    const input = el('input', { type: 'file', accept: '.xlsx', id: 'file-jadwal', class: 'sr-only' });
    input.addEventListener('change', () => {
      const f = input.files?.[0];
      if (f) void pilihFile(f);
      input.value = '';
    });
    const kontrol = el(
      'div',
      { class: 'baris-kontrol' },
      el('label', { class: 'tombol', for: 'file-jadwal' }, s.namaFile ? 'Ganti file…' : 'Pilih file jadwal (.xlsx)…'),
      input,
      s.namaFile ? el('span', {}, s.namaFile) : null,
    );
    let pilihSheet: HTMLElement | null = null;
    if (s.sheet.length > 1) {
      const sel = el('select', { id: 'pilih-sheet' }, ...s.sheet.map((n) => el('option', { value: n, selected: n === s.sheetDipilih }, n)));
      sel.addEventListener('change', () => void bacaSheet(sel.value));
      pilihSheet = el('div', { class: 'baris-kontrol' }, el('label', { for: 'pilih-sheet' }, 'Sheet:'), sel);
    }
    return el(
      'div',
      { class: 'kartu' },
      el('h2', {}, el('span', { class: 'langkah' }, '1'), 'Upload jadwal'),
      kontrol,
      pilihSheet,
      el('p', { class: 'bantu' }, 'Format seperti jadwal.xlsx: header HARI/TGL, JAM, WAKTU, KELAS XII, KELAS X, KELAS XI.'),
      daftarPesan(s.galat),
    );
  }

  function kartuJadwal(j: JadwalUjian): HTMLElement {
    const kolom = [{ judul: 'Hari' }, { judul: 'Tanggal' }, { judul: 'Sesi' }, ...j.tingkat.map((t) => ({ judul: `Kelas ${t}` }))];
    const baris: BarisTabel[] = [];
    for (const h of j.hari) {
      h.sesi.forEach((ses, i) => {
        baris.push({
          tanda: h.susulan ? 'abu' : undefined,
          sel: [
            i === 0 ? h.namaHari || '—' : '',
            i === 0 ? formatTanggal(h.tanggal) : '',
            h.susulan ? 'Susulan' : ses.nomor,
            ...j.tingkat.map((t) => (ses.mapelPerTingkat[t] ?? []).join(', ')),
          ],
        });
      });
    }
    const jumlahHari = j.hari.filter((h) => !h.susulan).length;
    return el(
      'div',
      { class: 'kartu' },
      el('h2', {}, el('span', { class: 'langkah' }, '2'), 'Jadwal terbaca'),
      daftarPesan(j.peringatan),
      tabel(kolom, baris, 'Jadwal ujian yang terbaca dari file'),
      el('p', { class: 'jumlah' }, `${jumlahHari} hari ujian${j.hari.some((h) => h.susulan) ? ' + hari susulan (tidak dikonvert)' : ''}.`),
    );
  }

  function kartuKonvert(j: JadwalUjian): HTMLElement {
    const tombolTingkat = j.tingkat.map((t) => {
      const b = el('button', { class: 'tombol', type: 'button', 'aria-pressed': String(t === s.tingkat) }, `Kelas ${t}`);
      b.addEventListener('click', () => {
        s.tingkat = t;
        s.sudahKonvert = false;
        gambar();
      });
      return b;
    });
    const konvert = el('button', { class: 'tombol utama', type: 'button', id: 'tombol-konvert', disabled: !s.tingkat }, 'Konvert');
    konvert.addEventListener('click', () => {
      s.sudahKonvert = true;
      gambar();
      document.getElementById('kartu-hasil')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return el(
      'div',
      { class: 'kartu' },
      el('h2', {}, el('span', { class: 'langkah' }, '3'), 'Pilih tingkat lalu konvert'),
      el('div', { class: 'baris-kontrol', role: 'group', 'aria-label': 'Tingkat kelas' }, ...tombolTingkat, konvert),
    );
  }

  function pilihanMapel(id: string, tambahan: HTMLOptionElement[]): HTMLSelectElement {
    return el(
      'select',
      { id },
      el('option', { value: '' }, '— pilih mapel —'),
      ...tambahan,
      ...[...s.kamus.mapel]
        .sort((a, b) => a.kode.localeCompare(b.kode))
        .map((m) => el('option', { value: m.kode }, `${m.kode} — ${m.namaLengkap}`)),
    );
  }

  function tindakanTidakDikenal(h: HasilCocok, i: number): HTMLElement {
    const id = `perbaiki-${i}`;
    const sel = pilihanMapel(id, [el('option', { value: PILIH_BARU }, '＋ Mapel baru…')]);
    const kode = el('input', { type: 'text', placeholder: 'Kode, mis. KKA', size: '12', 'aria-label': 'Kode mapel baru' });
    const nama = el('input', { type: 'text', placeholder: 'Nama lengkap', size: '22', 'aria-label': 'Nama lengkap mapel baru' });
    const baru = el('span', { class: 'baris-kontrol', hidden: true }, kode, nama);
    const galat = el('span', { class: 'bantu', role: 'alert' });
    const simpan = el('button', { class: 'tombol', type: 'button' }, 'Simpan ke kamus');
    sel.addEventListener('change', () => {
      baru.hidden = sel.value !== PILIH_BARU;
      if (!baru.hidden && !kode.value) {
        kode.value = h.teksAsli.toUpperCase();
        nama.value = h.teksAsli;
      }
    });
    simpan.addEventListener('click', () => {
      if (!sel.value) {
        galat.textContent = 'Pilih mapel dulu.';
        return;
      }
      const g =
        sel.value === PILIH_BARU
          ? gantiKamus(() => tambahMapel(s.kamus, kode.value, nama.value, h.teksAsli))
          : gantiKamus(() => tambahAlias(s.kamus, h.teksAsli, sel.value));
      if (g) galat.textContent = g;
    });
    return el('div', { class: 'baris-kontrol' }, el('label', { class: 'sr-only', for: id }, `Mapel untuk ${h.teksAsli}`), sel, baru, simpan, galat);
  }

  function tindakanDuplikat(h: HasilCocok, i: number): HTMLElement {
    const id = `ganda-${i}`;
    const sel = pilihanMapel(id, [el('option', { value: PILIH_ABAIKAN }, 'Abaikan (sudah ada)')]);
    const terapkan = el('button', { class: 'tombol', type: 'button' }, 'Terapkan');
    terapkan.addEventListener('click', () => {
      if (!sel.value) return;
      aturPilihan(h.lokasi, h.teksAsli, sel.value === PILIH_ABAIKAN ? [] : [sel.value]);
    });
    return el('div', { class: 'baris-kontrol' }, el('label', { class: 'sr-only', for: id }, `Ganti ${h.teksAsli} dengan`), sel, terapkan);
  }

  function tindakanDipilih(h: HasilCocok): HTMLElement {
    const batal = el('button', { class: 'tombol', type: 'button' }, 'Batalkan pilihan');
    batal.addEventListener('click', () => aturPilihan(h.lokasi, h.teksAsli, null));
    return el('div', { class: 'baris-kontrol' }, el('span', {}, h.kode.length ? `Dipilih: ${h.kode.join(', ')}` : 'Diabaikan'), batal);
  }

  function kartuHasil(j: JadwalUjian): HTMLElement {
    const hasil = cocokkanJadwal(j, s.tingkat, s.kamus, s.pilihan[s.tingkat] ?? {});
    const baris = susunBarisMapel(hasil, s.tingkat, s.kamus);
    const tidakDikenal = hasil.filter((h) => h.status === 'tidak-dikenal');
    const duplikat = hasil.filter((h) => h.status === 'duplikat');
    const masalah = hasil.filter((h) => h.status !== 'cocok' || h.dipilih);

    const pesan: Peringatan[] = [];
    if (tidakDikenal.length) {
      pesan.push({ tingkat: 'galat', pesan: `${tidakDikenal.length} nama mapel belum ada di kamus. Pilih mapelnya di tabel merah sebelum mengunduh.` });
    }
    if (duplikat.length) {
      pesan.push({
        tingkat: 'peringatan',
        pesan: `${duplikat.length} mapel muncul lebih dari sekali dan dilewati. Periksa baris kuning: mungkin maksudnya mapel lanjutan.`,
      });
    }

    const tabelMasalah = masalah.length
      ? tabel(
          [{ judul: 'Hari ke', angka: true }, { judul: 'Sel' }, { judul: 'Nama di jadwal' }, { judul: 'Masalah' }, { judul: 'Tindakan' }],
          masalah.map((h, i) => ({
            tanda: h.status === 'tidak-dikenal' ? 'merah' : h.status === 'duplikat' ? 'kuning' : undefined,
            sel: [
              h.hariKe,
              h.lokasi,
              h.teksAsli,
              h.status === 'tidak-dikenal' ? 'Belum ada di kamus' : h.status === 'duplikat' ? `Sama dengan ${h.kode.join(', ')} di hari lain` : 'Sudah dipilih',
              h.status === 'tidak-dikenal' ? tindakanTidakDikenal(h, i) : h.status === 'duplikat' ? tindakanDuplikat(h, i) : tindakanDipilih(h),
            ],
          })),
          'Nama mapel yang perlu diperiksa',
        )
      : null;

    const unduh = el('button', { class: 'tombol utama', type: 'button', id: 'tombol-unduh', disabled: tidakDikenal.length > 0 || baris.length === 0 }, `Unduh MAPEL ${s.tingkat}.xlsx`);
    unduh.addEventListener('click', async () => {
      unduh.disabled = true;
      try {
        unduhFile(`MAPEL ${s.tingkat}.xlsx`, await tulisMapelXlsx(baris));
      } finally {
        unduh.disabled = false;
      }
    });

    return el(
      'div',
      { class: 'kartu', id: 'kartu-hasil' },
      el('h2', {}, el('span', { class: 'langkah' }, '4'), `Pratinjau mapel kelas ${s.tingkat}`),
      daftarPesan(pesan),
      tabelMasalah,
      masalah.length ? el('p', {}) : null,
      tabel(
        [{ judul: 'category', angka: true }, { judul: 'format' }, { judul: 'shortname' }, { judul: 'fullname' }],
        baris.map((b) => ({ sel: [b.category, b.format, b.shortname, b.fullname] })),
        `Hasil konversi mapel kelas ${s.tingkat}`,
      ),
      el('p', { class: 'jumlah' }, `${baris.length} mapel dalam ${new Set(baris.map((b) => b.category)).size} hari.`),
      el('div', { class: 'baris-kontrol' }, unduh),
    );
  }

  function gambar(): void {
    const fokus = document.activeElement?.id;
    akar.replaceChildren(
      kartuUpload(),
      ...(s.jadwal ? [kartuJadwal(s.jadwal), kartuKonvert(s.jadwal)] : []),
      ...(s.jadwal && s.sudahKonvert ? [kartuHasil(s.jadwal)] : []),
    );
    if (fokus) document.getElementById(fokus)?.focus();
  }

  gambar();
}
