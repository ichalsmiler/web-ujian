// Tipe data sesuai specs/001-konverter-cbt/data-model.md

export interface Mapel {
  /** Bagian akhir shortname, huruf besar, unik. Mis. `BINDO`, `MATEMATIKA LANJUT`. */
  kode: string;
  /** Bagian awal fullname, ditulis apa adanya. Mis. `BHS INDONESIA`, `Matematika`. */
  namaLengkap: string;
  /** Nama ternormalisasi yang muncul di jadwal. Satu alias hanya menunjuk ke satu entri. */
  alias: string[];
}

export interface GrupMapel {
  alias: string[];
  /** Mis. `['PAI', 'PAK']`; setiap kode harus ada di kamus. */
  kodeAnggota: string[];
}

export interface Kamus {
  versi: 1;
  mapel: Mapel[];
  grup: GrupMapel[];
}

export type TingkatPesan = 'info' | 'peringatan' | 'galat';

export interface Peringatan {
  tingkat: TingkatPesan;
  pesan: string;
  /** Sel atau baris sumber, mis. `D14` atau `baris 5`. */
  lokasi?: string;
}

export interface Sesi {
  /** Kosong pada baris susulan. */
  nomor: 'I' | 'II' | '';
  /** Teks sel sudah dipecah koma dan di-trim; sel kosong → []. */
  mapelPerTingkat: Record<string, string[]>;
  /** Nomor baris sumber di sheet (1-based), untuk pesan. */
  baris: number;
}

export interface HariUjian {
  namaHari: string;
  tanggal: Date | null;
  susulan: boolean;
  sesi: Sesi[];
}

export interface JadwalUjian {
  namaSheet: string;
  /** Urut sesuai kolom, mis. `['XII', 'X', 'XI']`. */
  tingkat: string[];
  /** Huruf kolom tiap tingkat, untuk pesan lokasi. */
  kolomTingkat: Record<string, string>;
  hari: HariUjian[];
  peringatan: Peringatan[];
}

export type StatusCocok = 'cocok' | 'tidak-dikenal' | 'duplikat';

export interface HasilCocok {
  teksAsli: string;
  status: StatusCocok;
  /** Kosong jika tidak dikenal; lebih dari satu untuk grup. */
  kode: string[];
  /** Nilai `category`. */
  hariKe: number;
  /** Lokasi sel sumber, mis. `D14`. */
  lokasi: string;
  /** true jika kode berasal dari pilihan operator (kode kosong = diabaikan). */
  dipilih?: boolean;
}

/** Pilihan operator per nama di jadwal; kunci dari `kunciPilihan(lokasi, teks)`. */
export type PilihanMapel = Record<string, string[]>;

export interface BarisMapel {
  category: number;
  format: 'singleactivity';
  shortname: string;
  fullname: string;
}

export interface PesertaMasuk {
  username: string;
  password: string;
  firstname: string;
  lastname: string;
  department: string;
  address: string;
  /** Nilai kolom course1..course14 yang tidak kosong. */
  course: string[];
  baris: number;
  /** Nama sheet sumber (format DATA PESERTA). */
  sheet?: string;
}

export interface PesertaCBT {
  namaPeserta: string;
  namaRombel: string;
  kelasJurusan: string;
  ruang: number | null;
  kelSesi: number | null;
  username: string;
  password: string;
}

/** Galat format file yang harus ditampilkan ke operator (pesan Bahasa Indonesia). */
export class GalatFormat extends Error {
  constructor(pesan: string) {
    super(pesan);
    this.name = 'GalatFormat';
  }
}
