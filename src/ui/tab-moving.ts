// Tab "Kelas Moving": upload daftar hadir kelas moving (mapel pilihan), cocokkan nama murid ke
// peserta dari tab User → CBTAdmin, perbaiki yang tidak cocok, dan tambah siswa secara manual.
// Hasilnya (mapel moving per siswa) dipakai tab User → Moodle untuk kolom course.

import { urutTingkat } from '../core/jadwal';
import { PETA_MAPEL_MOVING, bacaFileMoving, cocokkanMoving, kunciPasangan, movingPerSiswa, pasanganGanda, type KelompokMoving, type PasanganMoving, type TambahanManual } from '../core/moving';
import { tingkatPeserta } from '../core/moodle';
import { GalatFormat, type PesertaMasuk, type Peringatan } from '../core/tipe';
import { ambilPeserta, catatMoving, muatKamus, muatMoving, saatKamusBerubah, saatPesertaBerubah, simpanMoving } from './simpan';
import { daftarPesan, el, tabel } from './tabel';

const BATAS_BARIS = 200;
const ABAIKAN = '__abaikan__';
const CARI = '__cari__';

type Saring = 'perlu' | 'mirip' | 'semua';

interface Status {
  kelompok: KelompokMoving[];
  galat: Peringatan[];
  /** Kode mapel yang diganti operator, per singkatan (mis. BIO → BIOLOGI LANJUTAN). */
  kodeDiganti: Record<string, string>;
  /** Pilihan operator per baris file: username, atau '' = abaikan. */
  pilihan: Record<string, string>;
  manual: TambahanManual[];
  saring: Saring;
}

function labelSiswa(p: PesertaMasuk): string {
  return `${p.username} — ${p.firstname} (${p.department})`;
}

export function pasangTabMoving(akar: HTMLElement): void {
  const tersimpan = muatMoving();
  const s: Status = { kelompok: [], galat: [], ...tersimpan, saring: 'perlu' };

  saatPesertaBerubah(() => gambar());
  saatKamusBerubah(() => gambar());

  function kelompokAktif(): KelompokMoving[] {
    return s.kelompok.map((k) => ({ ...k, kode: s.kodeDiganti[k.singkatan] ?? k.kode }));
  }

  /** Peserta per tingkat (dari nama sheet), untuk dicocokkan. */
  function pesertaTingkat(t: string): PesertaMasuk[] {
    return (ambilPeserta()?.peserta ?? []).filter((p) => tingkatPeserta(p) === t);
  }

  function hitungPasangan(): PasanganMoving[] {
    const kel = kelompokAktif();
    const tingkat = [...new Set(kel.map((k) => k.tingkat))];
    return tingkat.flatMap((t) => cocokkanMoving(kel.filter((k) => k.tingkat === t), pesertaTingkat(t)));
  }

  async function pilihFile(files: FileList): Promise<void> {
    s.galat = [];
    for (const f of Array.from(files)) {
      try {
        const kel = await bacaFileMoving(await f.arrayBuffer(), f.name);
        s.kelompok = [...s.kelompok.filter((k) => k.namaFile !== f.name), ...kel]; // upload ulang file yang sama = ganti
      } catch (e) {
        s.galat.push({ tingkat: 'galat', pesan: e instanceof GalatFormat ? e.message : `${f.name}: ${String(e)}` });
      }
    }
    s.kelompok.sort((a, b) => a.judul.localeCompare(b.judul, 'id', { numeric: true }));
    gambar();
  }

  // ---------- kartu ----------

  function kartuUpload(): HTMLElement {
    const input = el('input', { type: 'file', accept: '.xlsx', id: 'file-moving', class: 'sr-only', multiple: true });
    input.addEventListener('change', () => {
      if (input.files?.length) void pilihFile(input.files);
      input.value = '';
    });
    const hapus = el('button', { class: 'tombol', type: 'button' }, 'Lepas semua file');
    hapus.addEventListener('click', () => {
      Object.assign(s, { kelompok: [], galat: [] }); // pilihan & entri manual tetap tersimpan
      gambar();
    });
    const jumlahTersimpan = Object.keys(s.pilihan).length + s.manual.length;
    const hapusSimpanan = el('button', { class: 'tombol', type: 'button', id: 'hapus-simpanan-moving', disabled: jumlahTersimpan === 0 }, `Hapus pilihan tersimpan (${jumlahTersimpan})`);
    hapusSimpanan.addEventListener('click', () => {
      if (!confirm(`Hapus ${jumlahTersimpan} pilihan pencocokan dan entri manual yang tersimpan di browser ini? Ini tidak bisa dibatalkan.`)) return;
      Object.assign(s, { pilihan: {}, manual: [], kodeDiganti: {} });
      gambar();
    });

    const semuaKode = [...new Set([...Object.values(PETA_MAPEL_MOVING), ...muatKamus().mapel.map((m) => m.kode)])].sort();
    const perSingkatan = new Map<string, KelompokMoving[]>();
    for (const k of kelompokAktif()) perSingkatan.set(k.singkatan, [...(perSingkatan.get(k.singkatan) ?? []), k]);

    const tabelMapel = perSingkatan.size
      ? tabel(
          [{ judul: 'Mapel di file' }, { judul: 'Kelompok' }, { judul: 'Siswa', angka: true }, { judul: 'Didaftarkan ke' }],
          [...perSingkatan].map(([singkatan, kel]) => {
            const kode = kel[0].kode;
            const sel = el(
              'select',
              { 'aria-label': `Kode mapel untuk ${singkatan}` },
              el('option', { value: '', selected: !kode }, '— pilih kode mapel —'),
              ...semuaKode.map((k) => el('option', { value: k, selected: k === kode }, k)),
            );
            sel.addEventListener('change', () => {
              s.kodeDiganti = { ...s.kodeDiganti, [singkatan]: sel.value };
              gambar();
            });
            return {
              tanda: kode ? undefined : ('merah' as const),
              sel: [
                singkatan,
                kel.map((k) => k.judul).join(', '),
                kel.reduce((n, k) => n + k.siswa.length, 0),
                el('span', { class: 'baris-kontrol' }, `USBK-${kel[0].tingkat}-`, sel),
              ],
            };
          }),
          'Mapel moving dan kode yang dipakai',
        )
      : null;

    return el(
      'div',
      { class: 'kartu' },
      el('h2', {}, el('span', { class: 'langkah' }, '1'), 'Upload daftar kelas moving'),
      el(
        'div',
        { class: 'baris-kontrol' },
        el('label', { class: 'tombol', for: 'file-moving' }, s.kelompok.length ? 'Tambah / ganti file…' : 'Pilih file moving (.xlsx, bisa banyak sekaligus)…'),
        input,
        s.kelompok.length ? hapus : null,
        hapusSimpanan,
      ),
      el('p', { class: 'bantu' }, 'Format seperti "DAFTAR HADIR KELAS MOVING XI BIO.xlsx": satu sheet per kelompok, judul kelompok di baris 2, kolom NAMA MURID dan KELAS.'),
      daftarPesan(s.galat),
      tabelMapel,
    );
  }

  function kartuSumberKosong(): HTMLElement {
    const buka = el('button', { class: 'tombol', type: 'button' }, 'Buka tab User → CBTAdmin');
    buka.addEventListener('click', () => document.getElementById('tab-btn-user')?.click());
    return el(
      'div',
      { class: 'kartu' },
      el('h2', {}, el('span', { class: 'langkah' }, '2'), 'Cocokkan nama'),
      el(
        'div',
        { class: 'baris-kontrol' },
        el('span', { class: 'kosong' }, 'Nama murid dicocokkan ke data peserta. Upload file peserta dulu di tab User → CBTAdmin.'),
        buka,
      ),
    );
  }

  function pemilih(p: PasanganMoving, semua: PesertaMasuk[], idDaftar: string): HTMLElement {
    const k = kunciPasangan(p);
    const sekarang = k in s.pilihan ? s.pilihan[k] : p.username;
    const opsi = new Map(p.kandidat.map((c) => [c.username, `${c.username} — ${c.nama} (${c.kelas}) · ${Math.round(c.skor * 100)}%`]));
    if (sekarang && !opsi.has(sekarang)) {
      const x = semua.find((q) => q.username === sekarang);
      if (x) opsi.set(sekarang, labelSiswa(x));
    }
    const sel = el(
      'select',
      { 'aria-label': `Siswa untuk ${p.siswa.nama}` },
      el('option', { value: '', selected: sekarang === '' && !(k in s.pilihan) }, '— pilih siswa —'),
      ...[...opsi].map(([u, label]) => el('option', { value: u, selected: u === sekarang }, label)),
      el('option', { value: CARI }, 'Cari siswa lain…'),
      el('option', { value: ABAIKAN, selected: k in s.pilihan && s.pilihan[k] === '' }, 'Abaikan baris ini'),
    );
    const cari = el('input', { type: 'text', list: idDaftar, placeholder: 'Ketik nama atau no ujian', size: '34', hidden: true, 'aria-label': 'Cari siswa' });
    sel.addEventListener('change', () => {
      if (sel.value === CARI) {
        cari.hidden = false;
        cari.focus();
        return;
      }
      s.pilihan = { ...s.pilihan, [k]: sel.value === ABAIKAN ? '' : sel.value };
      gambar();
    });
    cari.addEventListener('change', () => {
      const u = cari.value.split(' — ')[0].trim();
      if (semua.some((q) => q.username === u)) {
        s.pilihan = { ...s.pilihan, [k]: u };
        gambar();
      }
    });
    return el('span', { class: 'baris-kontrol' }, sel, cari);
  }

  function kartuCocok(pasangan: PasanganMoving[]): HTMLElement {
    const semua = [...new Set(pasangan.map((p) => p.kelompok.tingkat))].flatMap((t) => pesertaTingkat(t));
    const statusAkhir = (p: PasanganMoving) => {
      const k = kunciPasangan(p);
      if (k in s.pilihan) return s.pilihan[k] ? 'dipilih' : 'diabaikan';
      return p.status;
    };
    const hitung = (st: string) => pasangan.filter((p) => statusAkhir(p) === st).length;
    const perlu = hitung('pilih');

    const tombolSaring = (nilai: Saring, label: string) => {
      const b = el('button', { class: 'tombol', type: 'button', 'aria-pressed': String(s.saring === nilai) }, label);
      b.addEventListener('click', () => {
        s.saring = nilai;
        gambar();
      });
      return b;
    };
    const tampil = pasangan.filter((p) => {
      const st = statusAkhir(p);
      if (s.saring === 'perlu') return st === 'pilih';
      if (s.saring === 'mirip') return st === 'mirip' || st === 'dipilih' || st === 'diabaikan';
      return true;
    });

    const idDaftar = 'daftar-siswa-moving';
    const datalist = el('datalist', { id: idDaftar }, ...semua.map((q) => el('option', { value: labelSiswa(q) })));
    const nama = new Map(semua.map((q) => [q.username, q]));

    const pesan: Peringatan[] = [];
    if (perlu) pesan.push({ tingkat: 'galat', pesan: `${perlu} nama belum dicocokkan. Pilih siswanya di tabel merah, atau abaikan barisnya.` });
    pesan.push({
      tingkat: 'info',
      pesan: 'Pilihan dan entri manual tersimpan di browser komputer ini, jadi tidak hilang saat halaman dimuat ulang (upload ulang file peserta dan file moving untuk melanjutkan). Di komputer bersama, tekan "Hapus pilihan tersimpan" setelah selesai.',
    });

    return el(
      'div',
      { class: 'kartu', id: 'kartu-cocok-moving' },
      el('h2', {}, el('span', { class: 'langkah' }, '2'), 'Cocokkan nama'),
      el(
        'p',
        {},
        `${pasangan.length} baris: ${hitung('persis')} sama persis, ${hitung('mirip')} mirip (dicocokkan otomatis, perlu dicek), ` +
          `${perlu} perlu dipilih, ${hitung('dipilih')} dipilih operator, ${hitung('diabaikan')} diabaikan.`,
      ),
      daftarPesan(pesan),
      el(
        'div',
        { class: 'baris-kontrol', role: 'group', 'aria-label': 'Saring baris' },
        tombolSaring('perlu', `Perlu dipilih (${perlu})`),
        tombolSaring('mirip', `Mirip & sudah dipilih (${hitung('mirip') + hitung('dipilih') + hitung('diabaikan')})`),
        tombolSaring('semua', `Semua (${pasangan.length})`),
      ),
      el('p', {}),
      datalist,
      tampil.length
        ? tabel(
            [{ judul: 'Kelompok' }, { judul: 'Nama di file moving' }, { judul: 'Kelas' }, { judul: 'Dicocokkan ke' }],
            tampil.slice(0, BATAS_BARIS).map((p) => {
              const st = statusAkhir(p);
              const u = kunciPasangan(p) in s.pilihan ? s.pilihan[kunciPasangan(p)] : p.username;
              const siswa = u ? nama.get(u) : undefined;
              return {
                tanda: st === 'pilih' ? ('merah' as const) : st === 'mirip' ? ('kuning' as const) : st === 'diabaikan' ? ('abu' as const) : undefined,
                sel: [p.kelompok.judul, p.siswa.nama, p.siswa.kelas, st === 'persis' && siswa ? labelSiswa(siswa) : pemilih(p, semua, idDaftar)],
              };
            }),
            'Pencocokan nama murid kelas moving',
          )
        : el('p', { class: 'kosong' }, s.saring === 'perlu' ? 'Semua nama sudah dicocokkan.' : 'Tidak ada baris.'),
      tampil.length > BATAS_BARIS ? el('p', { class: 'jumlah' }, `Menampilkan ${BATAS_BARIS} dari ${tampil.length} baris.`) : null,
    );
  }

  function kartuManual(): HTMLElement {
    const tingkat = urutTingkat([...new Set(kelompokAktif().map((k) => k.tingkat))].concat(s.kelompok.length ? [] : ['XI']));
    const semua = tingkat.flatMap((t) => pesertaTingkat(t));
    const shortname = [...new Set(kelompokAktif().filter((k) => k.kode).map((k) => `USBK-${k.tingkat}-${k.kode}`))].sort();

    const idDaftar = 'daftar-siswa-manual';
    const siswa = el('input', { type: 'text', list: idDaftar, placeholder: 'Ketik nama atau no ujian', size: '38', id: 'manual-siswa' });
    const mapel = el('select', { id: 'manual-mapel' }, el('option', { value: '' }, '— pilih mapel moving —'), ...shortname.map((x) => el('option', { value: x }, x)));
    const galat = el('span', { class: 'bantu', role: 'alert' });
    const tambah = el('button', { class: 'tombol utama', type: 'button' }, 'Tambah');
    tambah.addEventListener('click', () => {
      const u = siswa.value.split(' — ')[0].trim();
      if (!semua.some((q) => q.username === u)) {
        galat.textContent = 'Pilih siswa dari daftar.';
        return;
      }
      if (!mapel.value) {
        galat.textContent = 'Pilih mapel moving.';
        return;
      }
      if (!s.manual.some((m) => m.username === u && m.shortname === mapel.value)) s.manual = [...s.manual, { username: u, shortname: mapel.value }];
      gambar();
    });

    const nama = new Map(semua.map((q) => [q.username, q]));
    const daftar = s.manual.length
      ? tabel(
          [{ judul: 'Siswa' }, { judul: 'Mapel moving' }, { judul: '' }],
          s.manual.map((m, i) => {
            const hapus = el('button', { class: 'tombol', type: 'button' }, 'Hapus');
            hapus.addEventListener('click', () => {
              s.manual = s.manual.filter((_, j) => j !== i);
              gambar();
            });
            const q = nama.get(m.username);
            return { sel: [q ? labelSiswa(q) : m.username, m.shortname, hapus] };
          }),
          'Siswa yang ditambahkan manual',
        )
      : null;

    return el(
      'div',
      { class: 'kartu' },
      el('h2', {}, el('span', { class: 'langkah' }, '3'), 'Tambah siswa ke kelas moving (manual)'),
      el('p', { class: 'bantu' }, 'Untuk siswa yang tidak ada di file moving, atau pindah kelompok.'),
      el('datalist', { id: idDaftar }, ...semua.map((q) => el('option', { value: labelSiswa(q) }))),
      el(
        'div',
        { class: 'baris-kontrol' },
        el('label', { class: 'sr-only', for: 'manual-siswa' }, 'Siswa'),
        siswa,
        el('label', { class: 'sr-only', for: 'manual-mapel' }, 'Mapel moving'),
        mapel,
        tambah,
        galat,
      ),
      daftar,
    );
  }

  function kartuRekap(moving: Map<string, string[]>, pasangan: PasanganMoving[]): HTMLElement {
    const tingkat = [...new Set(kelompokAktif().map((k) => k.tingkat))];
    const semua = tingkat.flatMap((t) => pesertaTingkat(t));
    const jumlah = new Map<number, number>();
    for (const q of semua) {
      const n = moving.get(q.username)?.length ?? 0;
      jumlah.set(n, (jumlah.get(n) ?? 0) + 1);
    }
    const ringkas = [...jumlah].sort((a, b) => a[0] - b[0]).map(([n, c]) => `${c} siswa dengan ${n} mapel`).join(' · ');
    const umum = [...jumlah].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
    const tidakBiasa = semua.filter((q) => (moving.get(q.username)?.length ?? 0) !== umum);
    const nama = new Map(semua.map((q) => [q.username, q]));
    const ganda = pasanganGanda(pasangan, s.pilihan);
    const bagianGanda = ganda.length
      ? el(
          'div',
          {},
          daftarPesan([
            {
              tingkat: 'peringatan',
              pesan: `${ganda.length} siswa terpasang lebih dari sekali ke mapel yang sama. Mungkin dua nama berbeda dicocokkan ke siswa yang sama: abaikan atau ganti baris yang salah.`,
            },
          ]),
          tabel(
            [{ judul: 'Siswa' }, { judul: 'Mapel' }, { judul: 'Baris di file moving' }],
            ganda.map((x) => {
              const q = nama.get(x.username);
              const daftar = el(
                'div',
                {},
                ...x.baris.map((b) => {
                  const abaikan = el('button', { class: 'tombol', type: 'button' }, 'Abaikan baris ini');
                  abaikan.addEventListener('click', () => {
                    s.pilihan = { ...s.pilihan, [kunciPasangan(b)]: '' };
                    gambar();
                  });
                  return el('div', { class: 'baris-kontrol' }, `${b.kelompok.judul}: ${b.siswa.nama} (${b.siswa.kelas})`, abaikan);
                }),
              );
              return { tanda: 'kuning' as const, sel: [q ? labelSiswa(q) : x.username, x.kode, daftar] };
            }),
            'Siswa yang terpasang dua kali ke mapel yang sama',
          ),
          el('p', {}),
        )
      : null;
    return el(
      'div',
      { class: 'kartu' },
      el('h2', {}, el('span', { class: 'langkah' }, '4'), 'Rekap per siswa'),
      el('p', {}, `Kelas ${tingkat.join(', ')}: ${semua.length} siswa. ${ringkas}.`),
      bagianGanda,
      tidakBiasa.length
        ? el(
            'div',
            {},
            el('p', { class: 'bantu' }, `Siswa yang jumlah mapel moving-nya bukan ${umum} (perlu dicek):`),
            tabel(
              [{ judul: 'Siswa' }, { judul: 'Jumlah', angka: true }, { judul: 'Mapel moving' }],
              tidakBiasa.slice(0, BATAS_BARIS).map((q) => {
                const m = moving.get(q.username) ?? [];
                return { tanda: m.length === 0 ? ('merah' as const) : ('kuning' as const), sel: [labelSiswa(q), m.length, m.map((x) => x.replace(/^USBK-[IVX]+-/, '')).join(', ')] };
              }),
              'Siswa dengan jumlah mapel moving tidak biasa',
            ),
          )
        : el('p', { class: 'kosong' }, `Semua siswa punya ${umum} mapel moving.`),
      el('p', { class: 'bantu' }, 'Mapel moving ini otomatis ditambahkan ke kolom course di tab User → Moodle.'),
    );
  }

  function gambar(): void {
    const fokus = document.activeElement?.id;
    const adaPeserta = !!ambilPeserta();
    const pasangan = adaPeserta && s.kelompok.length ? hitungPasangan() : [];
    const moving = movingPerSiswa(pasangan, s.pilihan, s.manual);
    catatMoving(moving);
    simpanMoving({ pilihan: s.pilihan, manual: s.manual, kodeDiganti: s.kodeDiganti });
    akar.replaceChildren(
      ...[
        kartuUpload(),
        s.kelompok.length ? (adaPeserta ? kartuCocok(pasangan) : kartuSumberKosong()) : null,
        adaPeserta && s.kelompok.length ? kartuManual() : null,
        adaPeserta && s.kelompok.length ? kartuRekap(moving, pasangan) : null,
      ].filter((x): x is HTMLElement => x !== null),
    );
    if (fokus) document.getElementById(fokus)?.focus();
  }

  gambar();
}
